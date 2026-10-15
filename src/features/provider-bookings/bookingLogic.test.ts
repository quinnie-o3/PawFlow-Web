import { test } from "node:test";
import { strict as assert } from "node:assert";
import { createMockState, filterBookings, formatBookingDate, mockBookingsReducer, resolveMockCommand, transitionError } from "./bookingLogic";
import { mockBookings, mockNow, mockOwner } from "./data/providerBookingsMock";
import type { Booking, BookingCommand, BookingStatus } from "./types";

const confirmed: Booking = { ...mockBookings[0], status: "confirmed" };
const before = "2026-10-21T08:59:59+07:00";
const start = "2026-10-21T09:00:00+07:00";
const beforeEnd = "2026-10-21T10:29:59+07:00";
const end = "2026-10-21T10:30:00+07:00";
function command(targetStatus: BookingStatus, overrides: Partial<BookingCommand> = {}): BookingCommand {
  return { bookingId: confirmed.id, expectedStatus: "confirmed", targetStatus, reason: "  Cơ sở có việc đột xuất  ", confirmedActualOutcome: true, simulateFailure: false, ...overrides };
}

test("Owner cancellation is allowed strictly before start, including equivalent UTC instants", () => {
  assert.equal(transitionError(confirmed, "cancelled", mockOwner, before), null);
  assert.ok(transitionError(confirmed, "cancelled", mockOwner, start));
  assert.ok(transitionError(confirmed, "cancelled", mockOwner, "2026-10-21T02:00:00Z"));
});

test("Completed uses the saved duration; No-show uses the start with inclusive boundaries", () => {
  assert.ok(transitionError(confirmed, "completed", mockOwner, beforeEnd));
  assert.equal(transitionError(confirmed, "completed", mockOwner, end), null);
  assert.ok(transitionError(confirmed, "noShow", mockOwner, before));
  assert.equal(transitionError(confirmed, "noShow", mockOwner, start), null);
});

test("Staff receives no Owner status-changing permissions", () => {
  const staff = { ...mockOwner, role: "providerStaff" as const };
  for (const target of ["cancelled", "completed", "noShow"] as BookingStatus[]) {
    assert.ok(transitionError(confirmed, target, staff, end));
  }
  assert.ok(transitionError(mockBookings[0], "confirmed", staff, mockNow));
});

test("All terminal states reject every subsequent transition", () => {
  const statuses: BookingStatus[] = ["pendingConfirmation", "confirmed", "cancelled", "completed", "rejected", "noShow"];
  for (const status of ["cancelled", "completed", "rejected", "noShow"] as BookingStatus[]) {
    for (const target of statuses) assert.ok(transitionError({ ...confirmed, status }, target, mockOwner, end));
  }
});

test("Pending requests can only be confirmed or rejected", () => {
  assert.equal(transitionError(mockBookings[0], "confirmed", mockOwner, mockNow), null);
  assert.equal(transitionError(mockBookings[0], "rejected", mockOwner, mockNow), null);
  assert.ok(transitionError(mockBookings[0], "completed", mockOwner, end));
});

test("Cancellation trims the required reason and logs before/after, actor, and timestamp", () => {
  const initial = createMockState([confirmed]);
  const invalid = resolveMockCommand(initial, command("cancelled", { reason: " \n\t " }), mockOwner, before);
  assert.equal(invalid.bookings[0].status, "confirmed");
  assert.equal(invalid.logs[0].outcome, "error");
  const valid = resolveMockCommand(initial, command("cancelled"), mockOwner, before);
  assert.equal(valid.bookings[0].status, "cancelled");
  assert.equal(valid.logs[0].reason, "Cơ sở có việc đột xuất");
  assert.equal(valid.logs[0].previousStatus, "confirmed");
  assert.equal(valid.logs[0].nextStatus, "cancelled");
  assert.deepEqual(valid.logs[0].actor, mockOwner);
  assert.equal(valid.logs[0].occurredAt, before);
  assert.equal(initial.bookings[0].status, "confirmed");
});

test("Completed and No-show require an explicit real-outcome attestation", () => {
  for (const target of ["completed", "noShow"] as BookingStatus[]) {
    const result = resolveMockCommand(createMockState([confirmed]), command(target, { confirmedActualOutcome: false }), mockOwner, end);
    assert.equal(result.feedback?.outcome, "error");
    assert.equal(result.bookings[0].status, "confirmed");
  }
});

test("Resolution rechecks time, permissions, and expected status at confirmation", () => {
  const initial = createMockState([confirmed]);
  assert.equal(transitionError(confirmed, "cancelled", mockOwner, before), null);
  assert.equal(resolveMockCommand(initial, command("cancelled"), mockOwner, start).feedback?.outcome, "error");
  assert.equal(resolveMockCommand(initial, command("cancelled"), { ...mockOwner, role: "providerStaff" }, before).feedback?.outcome, "error");
  assert.equal(resolveMockCommand(initial, command("cancelled", { expectedStatus: "pendingConfirmation" }), mockOwner, before).feedback?.outcome, "error");
});

test("Simulated failure preserves data and records the failed attempt; retry succeeds", () => {
  const failed = resolveMockCommand(createMockState([confirmed]), command("completed", { simulateFailure: true }), mockOwner, end);
  assert.equal(failed.bookings[0].status, "confirmed");
  assert.equal(failed.logs[0].nextStatus, "confirmed");
  assert.equal(failed.logs[0].requestedStatus, "completed");
  const retried = resolveMockCommand(failed, command("completed"), mockOwner, end);
  assert.equal(retried.bookings[0].status, "completed");
  assert.equal(retried.logs.length, 2);
});

test("Reducer rejects simultaneous submissions and duplicate resolutions", () => {
  const submitted = mockBookingsReducer(createMockState([confirmed]), { type: "submit", command: command("completed") });
  assert.equal(mockBookingsReducer(submitted, { type: "submit", command: command("noShow") }), submitted);
  const resolved = mockBookingsReducer(submitted, { type: "resolve", actor: mockOwner, now: end });
  assert.equal(resolved.bookings[0].status, "completed");
  assert.equal(mockBookingsReducer(resolved, { type: "resolve", actor: mockOwner, now: end }), resolved);
  assert.equal(resolveMockCommand(resolved, command("noShow"), mockOwner, end).feedback?.outcome, "error");
});

test("Filtering combines status with trimmed, accent-insensitive ID/customer/pet search", () => {
  assert.deepEqual(filterBookings(mockBookings, { query: " HA LINH ", status: "all" }).map((item) => item.id), ["PF-2084"]);
  assert.equal(filterBookings(mockBookings, { query: "pf-2084", status: "confirmed" }).length, 0);
  assert.equal(filterBookings(mockBookings, { query: "mit", status: "rejected" })[0].id, "PF-2069");
  assert.equal(filterBookings(mockBookings, { query: "khong-co", status: "all" }).length, 0);
  assert.equal(filterBookings([], { query: "", status: "all" }).length, 0);
});

test("Formatting always uses Vietnam time, independent of host timezone", () => {
  assert.match(formatBookingDate("2026-10-21T02:00:00Z", true), /09:00/);
  assert.ok(transitionError({ ...confirmed, durationMinutes: 0 }, "completed", mockOwner, end));
  assert.ok(transitionError(confirmed, "completed", mockOwner, "invalid"));
});
