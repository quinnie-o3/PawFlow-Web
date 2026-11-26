import { test } from "node:test";
import { strict as assert } from "node:assert";
import { ApiError } from "../../lib/api/errors";
import {
  classifyProviderError,
  type ProviderBooking,
  type ProviderBookingDetail,
  type ProviderBookingStatus,
} from "../provider-workspace/liveApi";
import { getProviderLifecyclePermissions } from "../provider-workspace/lifecycle";
import {
  EMPTY_BOOKING_DETAIL,
  EMPTY_BOOKING_DRAFT,
  EMPTY_PENDING_UNKNOWN_BOOKINGS,
  buildReasonPayload,
  clearPendingUnknownBooking,
  createBookingDetailLoader,
  evaluateBookingTimeNotice,
  filterProviderBookings,
  formatBookingSlotRange,
  formatBookingTimestamp,
  formatVndAmount,
  getAvailableBookingActions,
  getPendingUnknownBooking,
  isBookingConflictOrNotFoundCode,
  parseDecimalAmountToCents,
  parseStatusFilterParam,
  reconcileUnknownMutation,
  recoverAbortedBookingDraft,
  storePendingUnknownBooking,
  summarizeProviderBookings,
  validateBookingDateFilter,
} from "./bookingLogic";
import type { BookingDetailLoadState } from "./types";

function makeBooking(overrides: Partial<ProviderBooking> = {}): ProviderBooking {
  return {
    id: "90071992547409951",
    status: "PENDING_CONFIRMATION",
    bookedPrice: "350000.00",
    customerNote: "Miu sợ tiếng máy sấy.",
    createdAt: "2026-11-20T02:00:00.000Z",
    updatedAt: "2026-11-20T02:00:00.000Z",
    service: {
      id: "101",
      name: "Grooming toàn diện",
      durationMinutes: 90,
    },
    slot: {
      id: "501",
      slotDate: "2026-11-25",
      startTime: "09:00:00",
      endTime: "10:30:00",
    },
    customer: {
      id: "90071992547409988",
      fullName: "Hà Linh",
    },
    pet: {
      id: "301",
      name: "Miu",
      breed: "Anh lông ngắn",
      birthDate: "2024-03-12",
      weight: "4.20",
      healthNote: "Da nhạy cảm",
      petType: { id: "2", name: "Mèo" },
    },
    ...overrides,
  };
}

test("parseStatusFilterParam supports both canonical API enums and legacy camelCase query values", () => {
  assert.equal(parseStatusFilterParam("PENDING_CONFIRMATION"), "PENDING_CONFIRMATION");
  assert.equal(parseStatusFilterParam("pendingConfirmation"), "PENDING_CONFIRMATION");
  assert.equal(parseStatusFilterParam("CONFIRMED"), "CONFIRMED");
  assert.equal(parseStatusFilterParam("confirmed"), "CONFIRMED");
  assert.equal(parseStatusFilterParam("noShow"), "NO_SHOW");
  assert.equal(parseStatusFilterParam("NO_SHOW"), "NO_SHOW");
  assert.equal(parseStatusFilterParam("invalid"), "all");
  assert.equal(parseStatusFilterParam(null), "all");
});

test("Available actions strictly follow backend lifecycle policy and never expose provider cancel", () => {
  const approved = getProviderLifecyclePermissions("APPROVED");
  const pending = getProviderLifecyclePermissions("PENDING");
  const rejected = getProviderLifecyclePermissions("REJECTED");
  const suspended = getProviderLifecyclePermissions("SUSPENDED");

  const pendingBooking = makeBooking({ status: "PENDING_CONFIRMATION" });
  const approvedActions = getAvailableBookingActions(pendingBooking, approved);
  assert.deepEqual(
    approvedActions.map((a) => [a.action, a.disabledReason === null]),
    [
      ["confirm", true],
      ["reject", true],
    ],
  );

  // PENDING, REJECTED, SUSPENDED lock confirm (BR-01) while keeping wind-down reject enabled.
  for (const perms of [pending, rejected, suspended]) {
    const actions = getAvailableBookingActions(pendingBooking, perms);
    const confirmAction = actions.find((a) => a.action === "confirm")!;
    const rejectAction = actions.find((a) => a.action === "reject")!;
    assert.ok(confirmAction.disabledReason);
    assert.equal(rejectAction.disabledReason, null);
  }

  // CONFIRMED exposes ONLY complete and no-show across all 4 lifecycle statuses (no cancel).
  const confirmedBooking = makeBooking({ status: "CONFIRMED" });
  for (const perms of [approved, pending, rejected, suspended, null]) {
    const actions = getAvailableBookingActions(confirmedBooking, perms);
    assert.deepEqual(
      actions.map((a) => a.action),
      ["complete", "no-show"],
    );
    assert.ok(actions.every((a) => a.disabledReason === null));
  }

  // Terminal statuses expose zero actions.
  for (const terminal of [
    "COMPLETED",
    "REJECTED",
    "CANCELLED",
    "NO_SHOW",
  ] as ProviderBookingStatus[]) {
    assert.deepEqual(
      getAvailableBookingActions(makeBooking({ status: terminal }), approved),
      [],
    );
  }
});

test("evaluateBookingTimeNotice warns before start/end in Asia/Ho_Chi_Minh without locking mutations", () => {
  const slot = {
    slotDate: "2026-11-25",
    startTime: "09:00:00",
    endTime: "10:30:00",
  };
  const beforeStart = Date.parse("2026-11-25T08:59:59+07:00");
  const atStart = Date.parse("2026-11-25T09:00:00+07:00");
  const beforeEnd = Date.parse("2026-11-25T10:29:59+07:00");
  const atEnd = Date.parse("2026-11-25T10:30:00+07:00");

  assert.equal(evaluateBookingTimeNotice(slot, "no-show", beforeStart), "no-show-before-start");
  assert.equal(evaluateBookingTimeNotice(slot, "no-show", atStart), null);
  assert.equal(evaluateBookingTimeNotice(slot, "complete", beforeStart), "complete-before-start");
  assert.equal(evaluateBookingTimeNotice(slot, "complete", beforeEnd), "complete-before-end");
  assert.equal(evaluateBookingTimeNotice(slot, "complete", atEnd), null);
  assert.equal(evaluateBookingTimeNotice(slot, "confirm", beforeStart), null);
  assert.equal(evaluateBookingTimeNotice(slot, "reject", beforeStart), null);
});

test("reconcileUnknownMutation distinguishes applied, not-applied, and changed-elsewhere", () => {
  assert.equal(reconcileUnknownMutation("CONFIRMED", "confirm"), "applied");
  assert.equal(reconcileUnknownMutation("PENDING_CONFIRMATION", "confirm"), "not-applied");
  assert.equal(reconcileUnknownMutation("CANCELLED", "confirm"), "changed-elsewhere");
  assert.equal(reconcileUnknownMutation("REJECTED", "confirm"), "changed-elsewhere");

  assert.equal(reconcileUnknownMutation("COMPLETED", "complete"), "applied");
  assert.equal(reconcileUnknownMutation("CONFIRMED", "complete"), "not-applied");
  assert.equal(reconcileUnknownMutation("CANCELLED", "complete"), "changed-elsewhere");

  assert.equal(reconcileUnknownMutation("NO_SHOW", "no-show"), "applied");
  assert.equal(reconcileUnknownMutation("CONFIRMED", "no-show"), "not-applied");
  assert.equal(reconcileUnknownMutation("COMPLETED", "no-show"), "changed-elsewhere");
});

test("buildReasonPayload trims optional reason and omits blank-only input", () => {
  assert.deepEqual(buildReasonPayload("  Khách không tới  "), {
    reason: "Khách không tới",
  });
  assert.deepEqual(buildReasonPayload("   \n\t  "), {});
  assert.deepEqual(buildReasonPayload(""), {});
});

test("filterProviderBookings combines status, slot date range, and accent-insensitive BIGINT/customer/pet/service search", () => {
  const list: ProviderBooking[] = [
    makeBooking({
      id: "90071992547409951",
      status: "PENDING_CONFIRMATION",
      slot: { id: "1", slotDate: "2026-11-25", startTime: "09:00:00", endTime: "10:30:00" },
    }),
    makeBooking({
      id: "90071992547409952",
      status: "CONFIRMED",
      customer: { id: "22", fullName: "Đức Huy" },
      pet: {
        id: "302",
        name: "Bắp",
        breed: "Corgi",
        birthDate: null,
        weight: "11.50",
        healthNote: null,
        petType: { id: "1", name: "Chó" },
      },
      service: { id: "102", name: "Tắm & vệ sinh", durationMinutes: 60 },
      slot: { id: "2", slotDate: "2026-11-28", startTime: "14:00:00", endTime: "15:00:00" },
    }),
  ];

  assert.deepEqual(
    filterProviderBookings(list, {
      status: "all",
      query: "90071992547409951",
      fromDate: "",
      toDate: "",
    }).map((b) => b.id),
    ["90071992547409951"],
  );
  assert.deepEqual(
    filterProviderBookings(list, {
      status: "CONFIRMED",
      query: "DUC HUY",
      fromDate: "2026-11-26",
      toDate: "2026-11-30",
    }).map((b) => b.id),
    ["90071992547409952"],
  );
  assert.deepEqual(
    filterProviderBookings(list, {
      status: "all",
      query: "tam & ve sinh",
      fromDate: "",
      toDate: "",
    }).map((b) => b.id),
    ["90071992547409952"],
  );
  assert.equal(validateBookingDateFilter("2026-11-28", "2026-11-25") !== null, true);
  assert.equal(validateBookingDateFilter("2026-11-25", "2026-11-28"), null);

  const summary = summarizeProviderBookings(list);
  assert.deepEqual(
    summary.map((s) => [s.status, s.count]),
    [
      ["PENDING_CONFIRMATION", 1],
      ["CONFIRMED", 1],
      ["COMPLETED", 0],
    ],
  );
});

test("BigInt VND amount formatting, conflict code checks, and Vietnam timezone formatting stay exact", () => {
  assert.equal(parseDecimalAmountToCents("350000.00"), BigInt(35000000));
  assert.equal(parseDecimalAmountToCents("9999999999.99"), BigInt("999999999999"));
  assert.equal(formatVndAmount("350000.00"), "350.000 ₫");
  assert.equal(formatVndAmount("1250000.50"), "1.250.000,50 ₫");
  assert.equal(
    formatBookingSlotRange({
      slotDate: "2026-11-25",
      startTime: "09:00:00",
      endTime: "10:30:00",
    }),
    "25/11/2026 · 09:00–10:30",
  );
  assert.match(formatBookingTimestamp("2026-11-20T02:00:00.000Z"), /20\/11\/2026 · 09:00/);
  assert.equal(isBookingConflictOrNotFoundCode("BOOKING_NOT_PENDING"), true);
  assert.equal(isBookingConflictOrNotFoundCode("NO_SHOW_TIME"), true);
  assert.equal(isBookingConflictOrNotFoundCode("BOOKING_NOT_FOUND"), true);
  assert.equal(isBookingConflictOrNotFoundCode("PROVIDER_CONFIRM_FORBIDDEN"), false);
});

test("R1 & R2 provider bookings: 503 same-identity abort moves draft to unknown, persists across close/reopen, and purges on 401/switch", () => {
  const identityA = "gen-1:30:PROVIDER_OWNER";
  const identityB = "gen-2:31:PROVIDER_OWNER";
  const fallbackError = {
    code: "NETWORK_ERROR",
    category: "uncertain",
    outcome: "unknown",
    status: null,
    retryAfterSeconds: null,
    shouldReconcile: true,
  } as const;

  const submittingDraft = {
    identity: identityA,
    bookingId: "90071992547409951",
    action: "reject" as const,
    reason: "Hết nhân sự ca chiều",
    openedAtMs: 1_700_000_000_000,
    phase: "submitting" as const,
    error: null,
    reconcileError: null,
  };

  // Same-identity 503 abort releases submitting -> unknown preserving bookingId, action & reason.
  const recovered = recoverAbortedBookingDraft(
    submittingDraft,
    identityA,
    identityA,
    fallbackError,
  );
  assert.equal(recovered.phase, "unknown");
  assert.equal(recovered.bookingId, "90071992547409951");
  assert.equal(recovered.action, "reject");
  assert.equal(recovered.reason, "Hết nhân sự ca chiều");
  assert.deepEqual(recovered.error, fallbackError);

  // R2: store pending unknown booking across dialog close & reopen.
  const stored = storePendingUnknownBooking(
    EMPTY_PENDING_UNKNOWN_BOOKINGS,
    recovered,
  );
  assert.deepEqual(
    getPendingUnknownBooking(stored, identityA, "90071992547409951"),
    recovered,
  );
  assert.equal(
    getPendingUnknownBooking(stored, identityA, "90071992547409999"),
    null,
  );
  assert.equal(
    getPendingUnknownBooking(stored, identityB, "90071992547409951"),
    null,
  );

  // Reconcile GET aborted on same-identity 503 returns cleanly to unknown (never stuck reconciling).
  const reconcilingDraft = {
    ...recovered,
    phase: "reconciling" as const,
  };
  const recoveredReconcile = recoverAbortedBookingDraft(
    reconcilingDraft,
    identityA,
    identityA,
    fallbackError,
  );
  assert.equal(recoveredReconcile.phase, "unknown");
  assert.equal(recoveredReconcile.reason, "Hết nhân sự ca chiều");

  // Clear after reconciliation removes only target bookingId.
  const cleared = clearPendingUnknownBooking(
    stored,
    identityA,
    "90071992547409951",
  );
  assert.equal(
    getPendingUnknownBooking(cleared, identityA, "90071992547409951"),
    null,
  );

  // 401/logout or account switch purges 100% back to EMPTY_BOOKING_DRAFT.
  assert.deepEqual(
    recoverAbortedBookingDraft(submittingDraft, identityA, null, fallbackError),
    EMPTY_BOOKING_DRAFT,
  );
  assert.deepEqual(
    recoverAbortedBookingDraft(
      reconcilingDraft,
      identityA,
      identityB,
      fallbackError,
    ),
    EMPTY_BOOKING_DRAFT,
  );
});

function makeBookingDetail(
  overrides: Partial<ProviderBookingDetail> = {},
): ProviderBookingDetail {
  return {
    ...makeBooking(),
    statusLogs: [
      {
        id: "7001",
        oldStatus: null,
        newStatus: "PENDING_CONFIRMATION",
        reason: null,
        createdAt: "2026-11-20T02:00:00.000Z",
      },
    ],
    ...overrides,
  };
}

function createAbortAwareDeferred<T>(signal: AbortSignal) {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  const onAbort = () => {
    reject(new DOMException("The operation was aborted.", "AbortError"));
  };
  if (signal.aborted) {
    onAbort();
  } else {
    signal.addEventListener("abort", onAbort, { once: true });
  }
  return { promise, resolve, reject };
}

test("503 detail recovery Case 1: real AbortController hide cleanup exits loading and auto-refetches detail to ready on same-identity recovery", async () => {
  const identityA = "gen-1:30:PROVIDER_OWNER";
  const bookingId = "90071992547409951";
  const expectedDetail = makeBookingDetail({ id: bookingId });

  const signals: AbortSignal[] = [];
  const deferreds: Array<ReturnType<typeof createAbortAwareDeferred<ProviderBookingDetail>>> = [];
  const history: BookingDetailLoadState[] = [];

  const loader = createBookingDetailLoader({
    fetchDetail: (_id, { signal }) => {
      signals.push(signal);
      const d = createAbortAwareDeferred<ProviderBookingDetail>(signal);
      deferreds.push(d);
      return d.promise;
    },
    classifyError: (err) => classifyProviderError(err, "get-booking"),
    onStateChange: (next) => history.push(next),
    initialIdentity: identityA,
    initialCanFetch: true,
  });

  // 1. User opens booking detail -> GET is in-flight with real AbortSignal, status === "loading".
  const firstRequest = loader.selectAndLoad(identityA, bookingId);
  assert.equal(signals.length, 1);
  assert.equal(signals[0].aborted, false);
  assert.equal(loader.getSnapshot().state.status, "loading");
  assert.equal(loader.getSnapshot().inFlight, true);

  // 2. Same-identity 503 hides <Activity mode="hidden"> -> cleanup runs interruptForHide() + abort().
  loader.interruptForHide();
  loader.syncSession({
    identity: identityA,
    canFetch: false,
    selectedBookingId: bookingId,
    profileNotFound: false,
  });

  assert.equal(signals[0].aborted, true);
  assert.deepEqual(await firstRequest, { ok: false, aborted: true });
  assert.equal(loader.getSnapshot().inFlight, false);
  assert.equal(loader.getSnapshot().interrupted, true);
  assert.notEqual(
    loader.getSnapshot().state.status,
    "loading",
    "detailState must not stay stuck in loading after 503 abort",
  );

  // 3. Session recovers on the same identity (canFetch: true) -> auto-refetch launches immediately!
  const recoveryPromise = loader.syncSession({
    identity: identityA,
    canFetch: true,
    selectedBookingId: bookingId,
    profileNotFound: false,
  });
  assert.notEqual(recoveryPromise, null, "expected automatic detail recovery fetch");
  assert.equal(signals.length, 2);
  assert.equal(signals[1].aborted, false);
  assert.equal(loader.getSnapshot().state.status, "loading");

  // 4. Recovery GET resolves -> transitions cleanly to "ready" with full detail.
  deferreds[1].resolve(expectedDetail);
  const recoveryResult = await recoveryPromise!;
  assert.equal(recoveryResult.ok, true);
  assert.equal(loader.getSnapshot().state.status, "ready");
  assert.equal(loader.getSnapshot().state.detail?.id, bookingId);
  assert.equal(loader.getSnapshot().interrupted, false);

  // 5. Subsequent syncSession while already ready must NOT trigger duplicate fetches.
  assert.equal(
    loader.syncSession({
      identity: identityA,
      canFetch: true,
      selectedBookingId: bookingId,
      profileNotFound: false,
    }),
    null,
  );
  assert.equal(signals.length, 2);
  assert.ok(history.length >= 3);
});

test("503 detail recovery Case 2: network failure on recovery sets status=error while preserving detail & uncertain; 401/switch purges both", async () => {
  const identityA = "gen-1:30:PROVIDER_OWNER";
  const identityB = "gen-2:31:PROVIDER_OWNER";
  const bookingId = "90071992547409951";
  const initialDetail = makeBookingDetail({ id: bookingId });

  const unknownDraft = {
    identity: identityA,
    bookingId,
    action: "reject" as const,
    reason: "Hết nhân sự ca chiều",
    openedAtMs: 1_700_000_000_000,
    phase: "unknown" as const,
    error: {
      code: "NETWORK_ERROR" as const,
      category: "uncertain" as const,
      outcome: "unknown" as const,
      status: null,
      retryAfterSeconds: null,
      shouldReconcile: true,
    },
    reconcileError: null,
  };
  const pendingMap = storePendingUnknownBooking(
    EMPTY_PENDING_UNKNOWN_BOOKINGS,
    unknownDraft,
  );

  let attempt = 0;
  const loader = createBookingDetailLoader({
    fetchDetail: (_id, { signal }) => {
      attempt++;
      if (attempt === 1) {
        return Promise.resolve(initialDetail);
      }
      if (attempt === 2) {
        return createAbortAwareDeferred<ProviderBookingDetail>(signal).promise;
      }
      return Promise.reject(new ApiError("network"));
    },
    classifyError: (err) => classifyProviderError(err, "get-booking"),
    onStateChange: () => {},
    initialIdentity: identityA,
    initialCanFetch: true,
  });

  // Load initial detail cleanly, then start reload (attempt 2) and interrupt with same-identity 503.
  const first = await loader.selectAndLoad(identityA, bookingId);
  assert.equal(first.ok, true);
  assert.equal(loader.getSnapshot().state.status, "ready");

  const interruptedReload = loader.load(bookingId);
  assert.equal(loader.getSnapshot().state.status, "loading");
  loader.interruptForHide();
  assert.deepEqual(await interruptedReload, { ok: false, aborted: true });
  assert.equal(loader.getSnapshot().state.status, "ready");
  assert.equal(loader.getSnapshot().state.detail?.id, bookingId);
  assert.equal(loader.getSnapshot().interrupted, true);

  // Recovery triggers attempt 3 which fails with network error -> status === "error", detail & uncertain preserved.
  const recovery = loader.syncSession({
    identity: identityA,
    canFetch: true,
    selectedBookingId: bookingId,
    profileNotFound: false,
  });
  assert.notEqual(recovery, null);
  const recoveryRes = await recovery!;
  assert.equal(recoveryRes.ok, false);
  assert.equal(loader.getSnapshot().state.status, "error");
  assert.equal(loader.getSnapshot().state.error?.code, "NETWORK_ERROR");
  assert.equal(loader.getSnapshot().state.detail?.id, bookingId);
  assert.equal(loader.getSnapshot().interrupted, false);
  // Uncertain state for this booking remains intact so dialog can reconcile alongside retry.
  assert.deepEqual(
    getPendingUnknownBooking(pendingMap, identityA, bookingId),
    unknownDraft,
  );

  // Close selection clears detail without scheduling recovery; identity switch / 401 purges detail & uncertain.
  loader.resetPrivate();
  assert.deepEqual(loader.getSnapshot().state, EMPTY_BOOKING_DETAIL);
  assert.equal(loader.getSnapshot().interrupted, false);
  assert.equal(getPendingUnknownBooking(pendingMap, identityB, bookingId), null);
  assert.deepEqual(
    recoverAbortedBookingDraft(
      unknownDraft,
      identityA,
      null,
      unknownDraft.error,
    ),
    EMPTY_BOOKING_DRAFT,
  );
});

test("503 detail recovery Case 3: explicit closeSelection and booking switch abort cleanly without bogus recovery", async () => {
  const identityA = "gen-1:30:PROVIDER_OWNER";
  const signals: AbortSignal[] = [];
  const deferreds: Array<ReturnType<typeof createAbortAwareDeferred<ProviderBookingDetail>>> = [];

  const loader = createBookingDetailLoader({
    fetchDetail: (_id, { signal }) => {
      signals.push(signal);
      const d = createAbortAwareDeferred<ProviderBookingDetail>(signal);
      deferreds.push(d);
      return d.promise;
    },
    classifyError: (err) => classifyProviderError(err, "get-booking"),
    onStateChange: () => {},
    initialIdentity: identityA,
    initialCanFetch: true,
  });

  // Explicit close aborts in-flight fetch and must NOT mark interrupted.
  const req1 = loader.selectAndLoad(identityA, "101");
  loader.closeSelection();
  assert.equal(signals[0].aborted, true);
  assert.deepEqual(await req1, { ok: false, aborted: true });
  assert.equal(loader.getSnapshot().interrupted, false);
  assert.deepEqual(loader.getSnapshot().state, EMPTY_BOOKING_DETAIL);
  assert.equal(
    loader.syncSession({
      identity: identityA,
      canFetch: true,
      selectedBookingId: null,
      profileNotFound: false,
    }),
    null,
  );
  assert.equal(signals.length, 1);

  // Switching from booking 201 -> 202 aborts 201 and settles cleanly on 202.
  const req201 = loader.selectAndLoad(identityA, "201");
  const req202 = loader.selectAndLoad(identityA, "202");
  assert.equal(signals[1].aborted, true);
  assert.equal(signals[2].aborted, false);
  assert.deepEqual(await req201, { ok: false, aborted: true });
  deferreds[2].resolve(makeBookingDetail({ id: "202" }));
  const res202 = await req202;
  assert.equal(res202.ok, true);
  assert.equal(loader.getSnapshot().state.bookingId, "202");
  assert.equal(loader.getSnapshot().state.status, "ready");
});
