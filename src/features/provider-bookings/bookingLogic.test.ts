import { test } from "node:test";
import { strict as assert } from "node:assert";
import type { ProviderBooking, ProviderBookingStatus } from "../provider-workspace/liveApi";
import { getProviderLifecyclePermissions } from "../provider-workspace/lifecycle";
import {
  buildReasonPayload,
  evaluateBookingTimeNotice,
  filterProviderBookings,
  formatBookingSlotRange,
  formatBookingTimestamp,
  formatVndAmount,
  getAvailableBookingActions,
  isBookingConflictOrNotFoundCode,
  parseDecimalAmountToCents,
  parseStatusFilterParam,
  reconcileUnknownMutation,
  summarizeProviderBookings,
  validateBookingDateFilter,
} from "./bookingLogic";

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
