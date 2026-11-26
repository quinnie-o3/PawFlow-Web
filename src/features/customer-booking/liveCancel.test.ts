import test from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "../../lib/api/errors";
import { formatMessage, vi } from "../../lib/locale";
import {
  classifyBookingError,
  type LiveCustomerBooking,
  type LiveCustomerBookingDetail,
} from "./liveApi";
import type { LiveBookingActor } from "./liveSubmission";
import {
  beginCancelReconcile,
  beginCancelSubmit,
  buildCancelBookingInput,
  cancelCooldownRemainingMs,
  closeCancelFlow,
  createInitialCancelState,
  evaluateCancelEligibility,
  filterLiveBookings,
  formatVietnamAppointment,
  formatVietnamDateTime,
  isCancelDialogOpen,
  isCancelInFlight,
  openCancelFlow,
  parseVietnamSlotStartMs,
  resetCancelForSessionBoundary,
  resolveBookingRouteSource,
  settleCancelReconcile,
  settleCancelSubmit,
  syncCancelWithRefreshedDetail,
  toLiveCancelError,
  updateCancelReason,
} from "./liveCancel";

const CUSTOMER_A: LiveBookingActor = {
  id: "101",
  role: "CUSTOMER",
  generation: "gen-a",
};

const CUSTOMER_A_NEW_SESSION: LiveBookingActor = {
  id: "101",
  role: "CUSTOMER",
  generation: "gen-a2",
};

const CUSTOMER_B: LiveBookingActor = {
  id: "202",
  role: "CUSTOMER",
  generation: "gen-b",
};

const PROVIDER_ACTOR: LiveBookingActor = {
  id: "303",
  role: "PROVIDER_OWNER",
  generation: "gen-p",
};

function bookingFixture(
  overrides: Partial<LiveCustomerBooking> = {},
): LiveCustomerBooking {
  return {
    id: "9007199254740993",
    status: "PENDING_CONFIRMATION",
    bookedPrice: "250000.00",
    customerNote: "Bé hơi nhát nước",
    createdAt: "2026-11-04T03:15:00.000Z",
    updatedAt: "2026-11-04T03:15:00.000Z",
    service: {
      id: "40",
      name: "Tắm spa toàn diện",
      durationMinutes: 60,
    },
    slot: {
      id: "50",
      slotDate: "2026-11-05",
      startTime: "09:00:00",
      endTime: "10:00:00",
    },
    pet: {
      id: "12",
      name: "Miu",
      breed: "Anh lông ngắn",
      petType: { id: "2", name: "Mèo" },
    },
    provider: {
      id: "7",
      businessName: "PawCare Quận 3",
      address: "123 Võ Văn Tần, Quận 3",
    },
    ...overrides,
  };
}

function bookingDetailFixture(
  overrides: Partial<LiveCustomerBookingDetail> = {},
): LiveCustomerBookingDetail {
  const base = bookingFixture(overrides);
  return {
    ...base,
    statusLogs: [
      {
        id: "1001",
        oldStatus: null,
        newStatus: "PENDING_CONFIRMATION",
        reason: null,
        createdAt: "2026-11-04T03:15:00.000Z",
      },
    ],
    ...overrides,
  };
}

test("parseVietnamSlotStartMs enforces real calendar dates and Asia/Ho_Chi_Minh (+07:00) offset", () => {
  const expected = Date.parse("2026-11-05T02:00:00Z");
  assert.equal(
    parseVietnamSlotStartMs({ slotDate: "2026-11-05", startTime: "09:00:00" }),
    expected,
  );
  // Cross-midnight Vietnam time (01:00+07:00 === 18:00Z previous day).
  assert.equal(
    parseVietnamSlotStartMs({ slotDate: "2026-11-05", startTime: "01:00:00" }),
    Date.parse("2026-11-04T18:00:00Z"),
  );
  // Leap day valid vs non-leap / calendar overflow dates rejected.
  assert.equal(
    parseVietnamSlotStartMs({ slotDate: "2028-02-29", startTime: "08:30:00" }),
    Date.parse("2028-02-29T01:30:00Z"),
  );
  for (const invalid of [
    { slotDate: "2026-02-29", startTime: "09:00:00" },
    { slotDate: "2026-02-31", startTime: "09:00:00" },
    { slotDate: "2026-04-31", startTime: "09:00:00" },
    { slotDate: "2026-13-01", startTime: "09:00:00" },
    { slotDate: "2026-11-05", startTime: "24:00:00" },
    { slotDate: "2026-11-05", startTime: "09:00" },
  ]) {
    assert.equal(parseVietnamSlotStartMs(invalid), null);
  }
});

test("evaluateCancelEligibility enforces BR-06 statuses and BR-07 exact start boundary in Asia/Ho_Chi_Minh", () => {
  const startMs = Date.parse("2026-11-05T09:00:00+07:00");
  const pending = bookingFixture({ status: "PENDING_CONFIRMATION" });
  const confirmed = bookingFixture({ status: "CONFIRMED" });

  // 1ms before appointment start -> eligible for both PENDING_CONFIRMATION and CONFIRMED.
  assert.deepEqual(evaluateCancelEligibility(pending, startMs - 1), {
    eligible: true,
    reasonCode: null,
    slotStartMs: startMs,
  });
  assert.deepEqual(evaluateCancelEligibility(confirmed, startMs - 1), {
    eligible: true,
    reasonCode: null,
    slotStartMs: startMs,
  });

  // Exact appointment start time and after -> CANCEL_TIME (BR-07).
  assert.equal(evaluateCancelEligibility(pending, startMs).reasonCode, "CANCEL_TIME");
  assert.equal(evaluateCancelEligibility(confirmed, startMs).reasonCode, "CANCEL_TIME");
  assert.equal(evaluateCancelEligibility(confirmed, startMs + 60_000).reasonCode, "CANCEL_TIME");

  // Terminal / non-cancellable statuses -> CANCEL_STATUS (BR-06).
  for (const status of ["REJECTED", "COMPLETED", "CANCELLED", "NO_SHOW"] as const) {
    const res = evaluateCancelEligibility(bookingFixture({ status }), startMs - 60_000);
    assert.equal(res.eligible, false);
    assert.equal(res.reasonCode, "CANCEL_STATUS");
  }

  // Invalid clock or malformed slot date -> CLOCK_INVALID.
  assert.equal(
    evaluateCancelEligibility(pending, Number.NaN).reasonCode,
    "CLOCK_INVALID",
  );
  assert.equal(
    evaluateCancelEligibility(
      bookingFixture({
        slot: {
          id: "50",
          slotDate: "2026-02-31",
          startTime: "09:00:00",
          endTime: "10:00:00",
        },
      }),
      startMs - 1,
    ).reasonCode,
    "CLOCK_INVALID",
  );
});

test("buildCancelBookingInput sends empty object when reason is blank and trims non-empty reason", () => {
  assert.deepEqual(buildCancelBookingInput(""), {});
  assert.deepEqual(buildCancelBookingInput("   \t\n "), {});
  assert.equal("reason" in buildCancelBookingInput("   "), false);
  assert.deepEqual(buildCancelBookingInput("  Đổi lịch đột xuất  "), {
    reason: "Đổi lịch đột xuất",
  });
});

test("double-submit guard blocks concurrent submit/edit/close and ignores stale responses", () => {
  const booking = bookingFixture();
  const now = Date.parse("2026-11-05T08:00:00+07:00");

  // Non-customer cannot open cancel flow.
  const denied = openCancelFlow(
    createInitialCancelState(),
    PROVIDER_ACTOR,
    booking,
    now,
  );
  assert.equal(denied.ok, false);
  assert.equal(denied.reason, "CUSTOMER_REQUIRED");

  const opened = openCancelFlow(
    createInitialCancelState(),
    CUSTOMER_A,
    booking,
    now,
  );
  assert.equal(opened.ok, true);
  assert.equal(isCancelDialogOpen(opened.state), true);

  const edited = updateCancelReason(opened.state, "  Bận họp  ");
  const first = beginCancelSubmit(edited, CUSTOMER_A, booking, 1, now);
  assert.equal(first.ok, true);
  assert.equal(first.state.phase, "submitting");
  assert.deepEqual(first.input, { reason: "Bận họp" });
  assert.equal(isCancelInFlight(first.state), true);

  // Rapid second click, editing, and closing are synchronously blocked.
  const duplicate = beginCancelSubmit(first.state, CUSTOMER_A, booking, 2, now);
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.reason, "BLOCKED");
  assert.equal(updateCancelReason(first.state, "khác"), first.state);
  assert.equal(closeCancelFlow(first.state), first.state);

  // Stale requestId or wrong identity cannot settle active submission.
  const cancelledBooking = bookingFixture({ status: "CANCELLED" });
  assert.equal(
    settleCancelSubmit(first.state, 999, "gen-a:101:CUSTOMER", {
      kind: "success",
      booking: cancelledBooking,
    }),
    first.state,
  );
  assert.equal(
    settleCancelSubmit(first.state, 1, "gen-b:202:CUSTOMER", {
      kind: "success",
      booking: cancelledBooking,
    }),
    first.state,
  );

  // Matching requestId + identity settles cleanly to succeeded.
  const done = settleCancelSubmit(first.state, 1, "gen-a:101:CUSTOMER", {
    kind: "success",
    booking: cancelledBooking,
  });
  assert.equal(done.phase, "succeeded");
  assert.equal(done.viaReconcile, false);
  assert.equal(isCancelDialogOpen(done), false);
});

test("unknown cancel outcome preserves reason, blocks direct re-POST, and reconciles via GET detail across all server branches", () => {
  const booking = bookingFixture({ status: "CONFIRMED" });
  const now = Date.parse("2026-11-05T08:30:00+07:00");
  const opened = openCancelFlow(
    createInitialCancelState(),
    CUSTOMER_A,
    booking,
    now,
  );
  assert.equal(opened.ok, true);
  const edited = updateCancelReason(opened.state, "Bé bị ốm");
  const submitted = beginCancelSubmit(edited, CUSTOMER_A, booking, 1, now);
  assert.equal(submitted.ok, true);

  const networkUnknown = toLiveCancelError(
    classifyBookingError(new ApiError("network"), "cancel-booking"),
  );
  assert.equal(networkUnknown.outcome, "unknown");

  const unknownState = settleCancelSubmit(
    submitted.state,
    1,
    "gen-a:101:CUSTOMER",
    { kind: "error", error: networkUnknown, failedAt: now },
  );
  assert.equal(unknownState.phase, "unknown");
  assert.equal(unknownState.reason, "Bé bị ốm");

  // Direct re-POST is strictly blocked until reconciled.
  const blockedRetry = beginCancelSubmit(unknownState, CUSTOMER_A, booking, 2, now);
  assert.equal(blockedRetry.ok, false);
  assert.equal(blockedRetry.reason, "BLOCKED");

  // Branch A: reconcile fails transiently -> stays unknown, preserves reason, records reconcileError.
  const rec1 = beginCancelReconcile(unknownState, CUSTOMER_A, 10, now);
  assert.equal(rec1.ok, true);
  assert.equal(isCancelInFlight(rec1.state), true);
  const dupRec = beginCancelReconcile(rec1.state, CUSTOMER_A, 11, now);
  assert.equal(dupRec.ok, false);
  assert.equal(dupRec.reason, "BLOCKED");

  const rateLimitedReconcile = toLiveCancelError(
    classifyBookingError(
      new ApiError("http", 429, "RATE_LIMITED", null, 5),
      "get-booking",
    ),
  );
  const stillUnknown = settleCancelReconcile(
    rec1.state,
    10,
    "gen-a:101:CUSTOMER",
    { kind: "error", error: rateLimitedReconcile, failedAt: now + 1000 },
    now + 1000,
  );
  assert.equal(stillUnknown.resolution, "reconcile-failed");
  assert.equal(stillUnknown.state.phase, "unknown");
  assert.equal(stillUnknown.state.reason, "Bé bị ốm");
  assert.equal(stillUnknown.state.reconcileError?.code, "RATE_LIMITED");
  assert.equal(cancelCooldownRemainingMs(stillUnknown.state, now + 2000), 4000);
  // Cooldown enforced before next reconcile.
  const recDuringCooldown = beginCancelReconcile(
    stillUnknown.state,
    CUSTOMER_A,
    12,
    now + 2000,
  );
  assert.equal(recDuringCooldown.ok, false);
  assert.equal(recDuringCooldown.reason, "COOLDOWN");

  // Branch B: server already CANCELLED -> settles succeeded via reconcile.
  const rec2 = beginCancelReconcile(stillUnknown.state, CUSTOMER_A, 13, now + 6000);
  assert.equal(rec2.ok, true);
  const cancelledRes = settleCancelReconcile(
    rec2.state,
    13,
    "gen-a:101:CUSTOMER",
    { kind: "detail", detail: bookingDetailFixture({ status: "CANCELLED" }) },
    now + 6100,
  );
  assert.equal(cancelledRes.resolution, "cancelled");
  assert.equal(cancelledRes.state.phase, "succeeded");
  assert.equal(cancelledRes.state.viaReconcile, true);

  // Branch C: server still PENDING_CONFIRMATION before start -> reopens confirming with draft preserved.
  const rec3 = beginCancelReconcile(unknownState, CUSTOMER_A, 14, now + 1000);
  assert.equal(rec3.ok, true);
  const stillOpenRes = settleCancelReconcile(
    rec3.state,
    14,
    "gen-a:101:CUSTOMER",
    {
      kind: "detail",
      detail: bookingDetailFixture({ status: "PENDING_CONFIRMATION" }),
    },
    now + 1100,
  );
  assert.equal(stillOpenRes.resolution, "still-cancellable");
  assert.equal(stillOpenRes.state.phase, "confirming");
  assert.equal(stillOpenRes.state.reason, "Bé bị ốm");
  // Now safe to submit cancel again.
  const safeResubmit = beginCancelSubmit(
    stillOpenRes.state,
    CUSTOMER_A,
    booking,
    15,
    now + 1200,
  );
  assert.equal(safeResubmit.ok, true);
  assert.deepEqual(safeResubmit.input, { reason: "Bé bị ốm" });

  // Branch D: server moved to COMPLETED (or past start time) -> closes cancel flow cleanly.
  const rec4 = beginCancelReconcile(unknownState, CUSTOMER_A, 16, now + 1000);
  assert.equal(rec4.ok, true);
  const completedRes = settleCancelReconcile(
    rec4.state,
    16,
    "gen-a:101:CUSTOMER",
    { kind: "detail", detail: bookingDetailFixture({ status: "COMPLETED" }) },
    now + 1100,
  );
  assert.equal(completedRes.resolution, "no-longer-cancellable");
  assert.equal(completedRes.reasonCode, "CANCEL_STATUS");
  assert.equal(completedRes.state.phase, "idle");

  // Branch E: server still CONFIRMED, but appointment time has now passed -> closes cancel flow with CANCEL_TIME.
  const rec5 = beginCancelReconcile(unknownState, CUSTOMER_A, 17, now + 1000);
  assert.equal(rec5.ok, true);
  const lateTime = Date.parse("2026-11-05T09:00:00+07:00");
  const pastStartRes = settleCancelReconcile(
    rec5.state,
    17,
    "gen-a:101:CUSTOMER",
    { kind: "detail", detail: bookingDetailFixture({ status: "CONFIRMED" }) },
    lateTime,
  );
  assert.equal(pastStartRes.resolution, "no-longer-cancellable");
  assert.equal(pastStartRes.reasonCode, "CANCEL_TIME");
  assert.equal(pastStartRes.state.phase, "idle");
});

test("409 CANCEL_TIME and 409 CANCEL_STATUS refresh sync reflects cancelled-in-other-tab and non-cancellable states", () => {
  const booking = bookingFixture({ status: "CONFIRMED" });
  const now = Date.parse("2026-11-05T08:55:00+07:00");
  const opened = openCancelFlow(
    createInitialCancelState(),
    CUSTOMER_A,
    booking,
    now,
  );
  assert.equal(opened.ok, true);
  const submitted = beginCancelSubmit(opened.state, CUSTOMER_A, booking, 1, now);
  assert.equal(submitted.ok, true);

  // 409 CANCEL_TIME from backend PR #22.
  const cancelTimeErr = toLiveCancelError(
    classifyBookingError(
      new ApiError(
        "http",
        409,
        "CANCEL_TIME",
        "Bookings can only be cancelled before the appointment starts",
      ),
      "cancel-booking",
    ),
  );
  assert.equal(cancelTimeErr.code, "CANCEL_TIME");
  assert.equal(cancelTimeErr.shouldRefreshBookings, true);

  const failedTime = settleCancelSubmit(
    submitted.state,
    1,
    "gen-a:101:CUSTOMER",
    { kind: "error", error: cancelTimeErr, failedAt: now + 5000 },
  );
  assert.equal(failedTime.phase, "failed");
  assert.equal(failedTime.canRetry, false);

  // Sync after detail reload when start time has passed -> closes to idle.
  const syncedTime = syncCancelWithRefreshedDetail(
    failedTime,
    bookingDetailFixture({ status: "CONFIRMED" }),
    Date.parse("2026-11-05T09:00:00+07:00"),
  );
  assert.equal(syncedTime.resolution, "no-longer-cancellable");
  assert.equal(syncedTime.reasonCode, "CANCEL_TIME");
  assert.equal(syncedTime.state.phase, "idle");

  // 409 CANCEL_STATUS when another tab already cancelled -> sync resolves as already-cancelled.
  const cancelStatusErr = toLiveCancelError(
    classifyBookingError(
      new ApiError(
        "http",
        409,
        "CANCEL_STATUS",
        "Only pending confirmation or confirmed bookings can be cancelled",
      ),
      "cancel-booking",
    ),
  );
  const failedStatus = settleCancelSubmit(
    submitted.state,
    1,
    "gen-a:101:CUSTOMER",
    { kind: "error", error: cancelStatusErr, failedAt: now + 1000 },
  );
  assert.equal(failedStatus.phase, "failed");
  assert.equal(failedStatus.canRetry, false);

  const syncedCancelled = syncCancelWithRefreshedDetail(
    failedStatus,
    bookingDetailFixture({ status: "CANCELLED" }),
    now + 1500,
  );
  assert.equal(syncedCancelled.resolution, "already-cancelled");
  assert.equal(syncedCancelled.state.phase, "succeeded");
  assert.equal(syncedCancelled.state.viaReconcile, true);
});

test("SESSION_BUSY, RATE_LIMITED, and RATE_LIMIT_UNAVAILABLE preserve reason draft and enforce cooldownUntil", () => {
  const booking = bookingFixture();
  const now = Date.parse("2026-11-05T08:00:00+07:00");

  for (const [code, status, retryAfter] of [
    ["SESSION_BUSY", 503, 3],
    ["RATE_LIMITED", 429, 10],
    ["RATE_LIMIT_UNAVAILABLE", 503, 5],
  ] as const) {
    const opened = openCancelFlow(
      createInitialCancelState(),
      CUSTOMER_A,
      booking,
      now,
    );
    assert.equal(opened.ok, true);
    const drafted = updateCancelReason(opened.state, "Giữ lại lý do");
    const submitted = beginCancelSubmit(drafted, CUSTOMER_A, booking, 1, now);
    assert.equal(submitted.ok, true);

    const err = toLiveCancelError(
      classifyBookingError(
        new ApiError("http", status, code, null, retryAfter),
        "cancel-booking",
      ),
    );
    const failed = settleCancelSubmit(
      submitted.state,
      1,
      "gen-a:101:CUSTOMER",
      { kind: "error", error: err, failedAt: now },
    );
    assert.equal(failed.phase, "failed");
    assert.equal(failed.canRetry, true);
    assert.equal(failed.reason, "Giữ lại lý do");
    assert.equal(failed.cooldownUntil, now + retryAfter * 1000);

    // Blocked during cooldown, allowed once cooldown expires.
    const duringCooldown = beginCancelSubmit(
      failed,
      CUSTOMER_A,
      booking,
      2,
      now + retryAfter * 1000 - 1,
    );
    assert.equal(duringCooldown.ok, false);
    assert.equal(duringCooldown.reason, "COOLDOWN");

    const afterCooldown = beginCancelSubmit(
      failed,
      CUSTOMER_A,
      booking,
      2,
      now + retryAfter * 1000,
    );
    assert.equal(afterCooldown.ok, true);
    assert.deepEqual(afterCooldown.input, { reason: "Giữ lại lý do" });
  }
});

test("resetCancelForSessionBoundary wipes cancel state immediately on logout, 401, or identity change", () => {
  const booking = bookingFixture();
  const now = Date.parse("2026-11-05T08:00:00+07:00");
  const opened = openCancelFlow(
    createInitialCancelState(),
    CUSTOMER_A,
    booking,
    now,
  );
  assert.equal(opened.ok, true);
  const drafted = updateCancelReason(opened.state, "Lý do riêng tư");

  // Same identity keeps draft.
  assert.equal(
    resetCancelForSessionBoundary(drafted, "gen-a:101:CUSTOMER"),
    drafted,
  );
  // Logout / 401 -> idle.
  assert.deepEqual(resetCancelForSessionBoundary(drafted, null), {
    phase: "idle",
  });
  // Account switch -> idle.
  assert.deepEqual(
    resetCancelForSessionBoundary(drafted, "gen-b:202:CUSTOMER"),
    { phase: "idle" },
  );
  // Same user ID but rotated session generation -> idle.
  assert.deepEqual(
    resetCancelForSessionBoundary(drafted, "gen-a2:101:CUSTOMER"),
    { phase: "idle" },
  );
  // Submission rejects mismatched identity even if called directly.
  const wrongUserSubmit = beginCancelSubmit(drafted, CUSTOMER_B, booking, 1, now);
  assert.equal(wrongUserSubmit.ok, false);
  assert.equal(wrongUserSubmit.reason, "IDENTITY_MISMATCH");

  const rotatedGenSubmit = beginCancelSubmit(
    drafted,
    CUSTOMER_A_NEW_SESSION,
    booking,
    1,
    now,
  );
  assert.equal(rotatedGenSubmit.ok, false);
  assert.equal(rotatedGenSubmit.reason, "IDENTITY_MISMATCH");
});

test("resolveBookingRouteSource requires explicit catalog=demo or valid fromInbox provenance", () => {
  // Default and non-demo values stay live (never infer demo from ID shape).
  assert.equal(resolveBookingRouteSource({}), "live");
  assert.equal(resolveBookingRouteSource(new URLSearchParams("")), "live");
  assert.equal(resolveBookingRouteSource({ catalog: "live" }), "live");
  assert.equal(
    resolveBookingRouteSource({ catalog: ["demo", "live"] }),
    "live",
  );
  assert.equal(resolveBookingRouteSource({ fromInbox: "abc" }), "live");
  assert.equal(resolveBookingRouteSource({ fromInbox: "0" }), "live");
  assert.equal(
    resolveBookingRouteSource({ fromInbox: ["105", "106"] }),
    "live",
  );
  // Query parameter named getAll must not confuse object vs URLSearchParams detection.
  assert.equal(resolveBookingRouteSource({ getAll: "demo" }), "live");

  // Explicit demo provenance.
  assert.equal(resolveBookingRouteSource({ catalog: "demo" }), "demo");
  assert.equal(
    resolveBookingRouteSource(new URLSearchParams("catalog=demo&status=CONFIRMED")),
    "demo",
  );
  assert.equal(resolveBookingRouteSource({ fromInbox: "105" }), "demo");
  assert.equal(
    resolveBookingRouteSource(new URLSearchParams("fromInbox=105")),
    "demo",
  );
});

test("filterLiveBookings filters locally by status and Vietnamese query without reordering server rows", () => {
  const b1 = bookingFixture({
    id: "9001",
    status: "CONFIRMED",
    service: { id: "1", name: "Cắt tỉa lông", durationMinutes: 45 },
    provider: { id: "2", businessName: "Đà Nẵng Pet Spa", address: "Q1" },
    pet: { id: "3", name: "Bông", breed: null, petType: { id: "1", name: "Chó" } },
  });
  const b2 = bookingFixture({
    id: "9002",
    status: "PENDING_CONFIRMATION",
    service: { id: "4", name: "Tắm vệ sinh", durationMinutes: 30 },
    provider: { id: "5", businessName: "PawCare Quận 3", address: "Q3" },
    pet: { id: "6", name: "Miu", breed: "ALN", petType: { id: "2", name: "Mèo" } },
  });

  // Preserves server order.
  assert.deepEqual(
    filterLiveBookings([b1, b2], { status: "", query: "" }).map((b) => b.id),
    ["9001", "9002"],
  );
  // Filter by status.
  assert.deepEqual(
    filterLiveBookings([b1, b2], {
      status: "PENDING_CONFIRMATION",
      query: "",
    }).map((b) => b.id),
    ["9002"],
  );
  // Diacritics-insensitive match on provider/service/pet/id.
  assert.deepEqual(
    filterLiveBookings([b1, b2], { status: "", query: "da nang" }).map(
      (b) => b.id,
    ),
    ["9001"],
  );
  assert.deepEqual(
    filterLiveBookings([b1, b2], { status: "", query: "cat tia" }).map(
      (b) => b.id,
    ),
    ["9001"],
  );
  assert.deepEqual(
    filterLiveBookings([b1, b2], { status: "", query: "9002" }).map(
      (b) => b.id,
    ),
    ["9002"],
  );
  assert.deepEqual(
    filterLiveBookings([b1, b2], { status: "", query: "bong" }).map(
      (b) => b.id,
    ),
    ["9001"],
  );
});

test("formatVietnamAppointment, formatVietnamDateTime, and booking.live locale keys are complete", () => {
  assert.equal(
    formatVietnamAppointment({
      slotDate: "2026-11-05",
      startTime: "09:00:00",
      endTime: "10:00:00",
    }),
    "05/11/2026 · 09:00–10:00",
  );
  // 03:15 UTC === 10:15 Asia/Ho_Chi_Minh.
  const formatted = formatVietnamDateTime("2026-11-04T03:15:00.000Z");
  assert.match(formatted, /10:15/);
  assert.match(formatted, /04\/11\/2026/);

  const t = vi.booking.live;
  for (const value of [
    t.loading,
    t.detailLoading,
    t.reloadList,
    t.reloadDetail,
    t.listEmpty,
    t.listSubtitle,
    t.shellNotice,
    t.detailNotFoundTitle,
    t.detailNotFoundDescription,
    t.createdAtLabel,
    t.providerAddressLabel,
    t.currentDurationHint,
    t.noStatusLogs,
    t.feedbackDeferredNotice,
    t.cancelDescription,
    t.cancelReasonPlaceholder,
    t.cancelLockedByTime,
    t.cancelSucceeded,
    t.cancelConfirmedAfterSync,
    t.cancelSyncedTimePassed,
    t.cancelUnknownTitle,
    t.cancelUnknownDescription,
    t.cancelReconcileAction,
    t.cancelReconciling,
    t.cancelReconcileStillOpen,
    t.cancelCloseAndRefresh,
  ]) {
    assert.equal(typeof value, "string");
    assert.ok(value.trim().length > 0);
  }
  assert.equal(
    formatMessage(t.statusTransition, { from: "Chờ xác nhận", to: "Đã hủy" }),
    "Chờ xác nhận → Đã hủy",
  );
  assert.equal(formatMessage(t.logReason, { reason: "Bận" }), "Lý do: Bận");
  assert.equal(
    formatMessage(t.cancelSyncedNotCancellable, { status: "Hoàn thành" }),
    "Trạng thái lịch hẹn trên máy chủ đã thay đổi (Hoàn thành) nên không thể hủy nữa.",
  );
});
