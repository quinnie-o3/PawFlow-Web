import { test } from "node:test";
import { strict as assert } from "node:assert";
import { mockStaffContext, staffBookingsMock } from "./data/staffBookingsMock";
import { staffBookingEnd, staffBookingStart } from "./staffBookingLogic";
import { createStaffSession, staffMockNow, staffSessionReducer } from "./staffBookingSession";
import type { StaffBooking, StaffBookingCommand, StaffBookingTarget, StaffSessionState, StaffViewContext } from "./types";

const pending = staffBookingsMock[0];
const confirmed: StaffBooking = { ...pending, status: "confirmed" };
const context = mockStaffContext;

function ready(bookings: readonly StaffBooking[] = staffBookingsMock, now = staffMockNow) {
  return staffSessionReducer({ ...createStaffSession(bookings), now }, { type: "loaded" }, context);
}

function command(booking: StaffBooking, targetStatus: StaffBookingTarget, fields: Partial<StaffBookingCommand> = {}): StaffBookingCommand {
  return { bookingId: booking.id, expectedStatus: booking.status, targetStatus, reason: "", confirmedActualOutcome: false, ...fields };
}

function execute(state: StaffSessionState, operation: StaffBookingCommand, actor: StaffViewContext = context) {
  const submitted = staffSessionReducer(state, { type: "submit", command: operation }, actor);
  return staffSessionReducer(submitted, { type: "resolve", command: operation }, actor);
}

test("Confirm then Completed updates the current booking, list status and audit without payment fields", () => {
  const before = ready([pending]);
  const confirmedState = execute(before, command(pending, "confirmed"));
  assert.equal(confirmedState.bookings[0].status, "confirmed");
  const atEnd = staffSessionReducer(confirmedState, { type: "clock", now: staffBookingEnd(confirmed)! }, context);
  const completed = execute(atEnd, command(confirmed, "completed", { confirmedActualOutcome: true }));
  assert.equal(completed.bookings[0].status, "completed");
  assert.equal(completed.result?.outcome, "success");
  assert.equal(completed.pendingCommand, null);
  assert.deepEqual(completed.logs.map((log) => [log.previousStatus, log.nextStatus]), [["pendingConfirmation", "confirmed"], ["confirmed", "completed"]]);
  assert.equal(completed.logs[1].confirmedActualOutcome, true);
  assert.equal(completed.logs[1].occurredAt, new Date(atEnd.now).toISOString());
  assert.equal(before.bookings[0].status, "pendingConfirmation");
});

test("Reject trims the mandatory reason; whitespace fails and preserves data", () => {
  const before = ready([pending]);
  const failed = execute(before, command(pending, "rejected", { reason: " \n " }));
  assert.strictEqual(failed.bookings, before.bookings);
  assert.equal(failed.logs[0].outcome, "error");
  assert.equal(failed.logs[0].nextStatus, "pendingConfirmation");
  const rejected = execute(failed, command(pending, "rejected", { reason: "  Không thể tiếp nhận  " }));
  assert.equal(rejected.bookings[0].status, "rejected");
  assert.equal(rejected.logs[1].reason, "Không thể tiếp nhận");
});

test("Completed requires actual service confirmation at or after snapshot end", () => {
  const before = ready([confirmed], staffBookingEnd(confirmed)!);
  const failed = execute(before, command(confirmed, "completed"));
  assert.strictEqual(failed.bookings, before.bookings);
  assert.match(failed.result!.message, /xác nhận kết quả thực tế/);
  const succeeded = execute(failed, command(confirmed, "completed", { confirmedActualOutcome: true }));
  assert.equal(succeeded.bookings[0].status, "completed");
});

test("No-show requires both a trimmed reason and actual absence confirmation", () => {
  const before = ready([confirmed], staffBookingStart(confirmed));
  for (const fields of [{ reason: " " , confirmedActualOutcome: true }, { reason: "Khách chưa đến", confirmedActualOutcome: false }]) {
    const failed = execute(before, command(confirmed, "noShow", fields));
    assert.strictEqual(failed.bookings, before.bookings);
    assert.equal(failed.result?.outcome, "error");
  }
  const succeeded = execute(before, command(confirmed, "noShow", { reason: "  Khách chưa đến  ", confirmedActualOutcome: true }));
  assert.equal(succeeded.bookings[0].status, "noShow");
  assert.equal(succeeded.logs[0].reason, "Khách chưa đến");
});

test("Simulated mutation failure preserves booking and can be retried after disabling failure", () => {
  const before = staffSessionReducer(ready([pending]), { type: "failure", enabled: true }, context);
  const operation = command(pending, "confirmed");
  const failed = execute(before, operation);
  assert.strictEqual(failed.bookings, before.bookings);
  assert.equal(failed.logs[0].outcome, "error");
  const succeeded = execute(staffSessionReducer(failed, { type: "failure", enabled: false }, context), operation);
  assert.equal(succeeded.bookings[0].status, "confirmed");
  assert.deepEqual(succeeded.logs.map((log) => log.outcome), ["error", "success"]);
});

test("A processing command cannot be replaced or applied twice", () => {
  const operation = command(pending, "confirmed");
  const submitted = staffSessionReducer(ready([pending]), { type: "submit", command: operation }, context);
  assert.equal(submitted.result, null);
  assert.strictEqual(staffSessionReducer(submitted, { type: "submit", command: command(pending, "rejected", { reason: "Khác" }) }, context), submitted);
  const succeeded = staffSessionReducer(submitted, { type: "resolve", command: operation }, context);
  assert.strictEqual(staffSessionReducer(succeeded, { type: "resolve", command: operation }, context), succeeded);
  const stale = execute(succeeded, operation);
  assert.strictEqual(stale.bookings, succeeded.bookings);
  assert.equal(stale.logs.length, 2);
  assert.match(stale.result!.message, /Trạng thái đã thay đổi/);
});

test("Resolution rechecks the latest clock and latest booking status", () => {
  const operation = command(pending, "confirmed");
  const submitted = staffSessionReducer(ready([pending]), { type: "submit", command: operation }, context);
  const atStart = staffSessionReducer(submitted, { type: "clock", now: staffBookingStart(pending) }, context);
  const failed = staffSessionReducer(atStart, { type: "resolve", command: operation }, context);
  assert.strictEqual(failed.bookings, atStart.bookings);
  assert.match(failed.result!.message, /trước giờ bắt đầu/);
  const changed = { ...submitted, bookings: [confirmed] };
  const stale = staffSessionReducer(changed, { type: "resolve", command: operation }, context);
  assert.strictEqual(stale.bookings, changed.bookings);
  assert.match(stale.result!.message, /Trạng thái đã thay đổi/);
});

test("Inactive, unassigned, non-Staff and foreign-provider commands cannot mutate or expose foreign status", () => {
  const foreign: StaffBooking = { ...pending, id: "FOREIGN", providerId: "other-provider" };
  const before = ready([pending, foreign]);
  const invalidContexts: StaffViewContext[] = [
    { ...context, membershipStatus: "inactive" }, { ...context, providerId: null },
    { ...context, providerId: " " }, { ...context, providerId: "other-provider" },
    ...(["providerOwner", "customer", "admin"] as const).map((role) => ({ ...context, role })),
  ];
  for (const actor of invalidContexts) {
    const failed = execute(before, command(pending, "confirmed"), actor);
    assert.strictEqual(failed.bookings, before.bookings);
    assert.equal(failed.logs[0].previousStatus, null);
    assert.equal(failed.logs[0].nextStatus, null);
  }
  const denied = execute(before, command(foreign, "confirmed"));
  assert.strictEqual(denied.bookings, before.bookings);
  assert.equal(denied.logs[0].previousStatus, null);
  // Membership can also change after submission.
  const operation = command(pending, "confirmed");
  const submitted = staffSessionReducer(before, { type: "submit", command: operation }, context);
  const revoked = staffSessionReducer(submitted, { type: "resolve", command: operation }, invalidContexts[0]);
  assert.strictEqual(revoked.bookings, before.bookings);
});

test("Disallowed transitions and terminal bookings leave booking contents unchanged", () => {
  for (const [booking, target] of [[pending, "completed"], [confirmed, "confirmed"], [confirmed, "rejected"], [{ ...pending, status: "completed" }, "noShow"]] as const) {
    const before = ready([booking], staffBookingEnd(confirmed)!);
    const failed = execute(before, command(booking, target, { reason: "Ghi nhận", confirmedActualOutcome: true }));
    assert.strictEqual(failed.bookings, before.bookings);
    assert.equal(failed.result?.outcome, "error");
  }
});

test("Empty scenario removes bookings; load error and retry preserve session changes and logs", () => {
  const changed = execute(ready([pending]), command(pending, "confirmed"));
  const loading = staffSessionReducer(changed, { type: "load", scenario: "error" }, context);
  assert.equal(loading.phase, "loading");
  const error = staffSessionReducer(loading, { type: "loaded" }, context);
  assert.equal(error.phase, "error");
  const retried = staffSessionReducer(staffSessionReducer(error, { type: "load", scenario: "normal" }, context), { type: "loaded" }, context);
  assert.equal(retried.phase, "ready");
  assert.strictEqual(retried.bookings, changed.bookings);
  assert.strictEqual(retried.logs, changed.logs);
  const empty = staffSessionReducer(staffSessionReducer(retried, { type: "load", scenario: "empty" }, context), { type: "loaded" }, context);
  assert.deepEqual(empty.bookings, []);
  assert.strictEqual(empty.logs, changed.logs);
  assert.equal(execute(empty, command(pending, "confirmed")).result?.outcome, "error");
});

test("Reset clears changes, log, result, failure and clock and ignores the old pending response", () => {
  let state = execute(ready([pending]), command(pending, "rejected", { reason: "Không tiếp nhận" }));
  state = staffSessionReducer(state, { type: "clock", now: state.now + 60_000 }, context);
  state = staffSessionReducer(state, { type: "failure", enabled: true }, context);
  const operation = command(pending, "confirmed");
  state = staffSessionReducer(state, { type: "submit", command: operation }, context);
  const reset = staffSessionReducer(state, { type: "reset", bookings: staffBookingsMock }, context);
  assert.deepEqual(reset, createStaffSession(staffBookingsMock));
  assert.strictEqual(staffSessionReducer(reset, { type: "resolve", command: operation }, context), reset);
  const cancelled = staffSessionReducer(staffSessionReducer(ready([pending]), { type: "submit", command: operation }, context), { type: "load", scenario: "error" }, context);
  assert.strictEqual(staffSessionReducer(cancelled, { type: "resolve", command: operation }, context), cancelled);
});

test("Loading or errored lists block mutation; invalid clock controls preserve the prior clock", () => {
  for (const phase of ["loading", "error"] as const) {
    const before = { ...ready([pending]), phase };
    const failed = execute(before, command(pending, "confirmed"));
    assert.strictEqual(failed.bookings, before.bookings);
    assert.equal(failed.result?.outcome, "error");
  }
  const before = ready([pending]);
  for (const now of [NaN, Infinity, 9e15]) assert.strictEqual(staffSessionReducer(before, { type: "clock", now }, context), before);
});
