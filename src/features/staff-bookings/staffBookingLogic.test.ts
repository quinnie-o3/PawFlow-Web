import { test } from "node:test";
import { strict as assert } from "node:assert";
import { mockStaffContext, staffBookingsMock } from "./data/staffBookingsMock";
import { filterStaffBookings, findStaffBooking, formatStaffBookingDate, formatStaffMockTime, formatStaffPrice, parseStaffMockTime, scopeStaffBookings, staffBookingActions, staffBookingEnd, staffBookingStart, staffStatusOrder, staffTransitionError } from "./staffBookingLogic";
import type { StaffBooking, StaffBookingStatus, StaffBookingTarget, StaffViewContext } from "./types";

const foreign: StaffBooking = { ...staffBookingsMock[0], id: "OTHER-001", providerId: "other-provider", customerName: "Khách cơ sở khác" };
const source = [...staffBookingsMock, foreign];
const all = { query: "", status: "all" as const };

test("Staff scope excludes other providers from list, counts, search and direct detail lookup", () => {
  assert.equal(scopeStaffBookings(source, mockStaffContext).length, 8);
  assert.equal(filterStaffBookings(source, mockStaffContext, all).length, 8);
  assert.deepEqual(filterStaffBookings(source, mockStaffContext, { ...all, query: "OTHER-001" }), []);
  assert.equal(findStaffBooking(source, mockStaffContext, foreign.id), undefined);
  assert.equal(findStaffBooking(source, mockStaffContext, "PF-2084")?.customerName, "Hà Linh");
  assert.equal(findStaffBooking(source, mockStaffContext, "missing"), undefined);
});

test("Inactive, unassigned and unauthorized contexts fail closed for list and detail; Owner is not a Staff grant", () => {
  const contexts: StaffViewContext[] = [
    { ...mockStaffContext, membershipStatus: "inactive" },
    { ...mockStaffContext, providerId: null },
    { ...mockStaffContext, providerId: " " },
    ...(["providerOwner", "customer", "admin"] as const).map((role) => ({ ...mockStaffContext, role })),
  ];
  for (const context of contexts) {
    assert.deepEqual(filterStaffBookings(source, context, all), []);
    assert.equal(findStaffBooking(source, context, "PF-2084"), undefined);
  }
});

test("Confirm is allowed only strictly before start; Reject has no added time restriction", () => {
  const booking = staffBookingsMock[0];
  const start = staffBookingStart(booking);
  assert.equal(staffTransitionError(booking, "confirmed", mockStaffContext, start - 1), null);
  for (const now of [start, start + 1, NaN]) assert.ok(staffTransitionError(booking, "confirmed", mockStaffContext, now));
  assert.equal(staffTransitionError(booking, "rejected", mockStaffContext, start + 1), null);
});

test("Completed uses snapshot end inclusively; No-show uses start inclusively", () => {
  const booking: StaffBooking = { ...staffBookingsMock[0], status: "confirmed" };
  const start = staffBookingStart(booking);
  const end = staffBookingEnd(booking)!;
  assert.equal(end, start + 90 * 60_000);
  assert.ok(staffTransitionError(booking, "completed", mockStaffContext, end - 1));
  for (const now of [end, end + 1]) assert.equal(staffTransitionError(booking, "completed", mockStaffContext, now), null);
  assert.ok(staffTransitionError(booking, "noShow", mockStaffContext, start - 1));
  for (const now of [start, start + 1]) assert.equal(staffTransitionError(booking, "noShow", mockStaffContext, now), null);
});

test("Missing or invalid duration blocks Completed without deriving a service duration", () => {
  for (const durationMinutesSnapshot of [null, 0, -1, NaN, Infinity]) {
    const booking: StaffBooking = { ...staffBookingsMock[0], status: "confirmed", durationMinutesSnapshot };
    assert.equal(staffBookingEnd(booking), null);
    assert.match(staffTransitionError(booking, "completed", mockStaffContext, Date.parse("2026-12-01T00:00:00Z"))!, /snapshot/);
    assert.equal(staffTransitionError(booking, "noShow", mockStaffContext, staffBookingStart(booking)), null);
  }
});

test("Invalid or timezone-free timestamps fail closed for timed actions", () => {
  for (const scheduledAt of ["bad", "2026-10-21T09:00:00"]) {
    const booking: StaffBooking = { ...staffBookingsMock[0], scheduledAt };
    assert.ok(Number.isNaN(staffBookingStart(booking)));
    assert.ok(staffTransitionError(booking, "confirmed", mockStaffContext, 0));
    assert.ok(staffTransitionError({ ...booking, status: "confirmed" }, "noShow", mockStaffContext, 0));
  }
});

test("Terminal bookings expose no actions and cannot transition; no Cancel action exists", () => {
  const targets: StaffBookingTarget[] = ["confirmed", "rejected", "completed", "noShow"];
  for (const status of ["completed", "cancelled", "rejected", "noShow"] as StaffBookingStatus[]) {
    const booking = { ...staffBookingsMock[0], status };
    assert.deepEqual(staffBookingActions(booking, mockStaffContext, 0), []);
    for (const target of targets) assert.ok(staffTransitionError(booking, target, mockStaffContext, 0));
  }
  assert.deepEqual(staffBookingActions(staffBookingsMock[0], mockStaffContext, 0).map((item) => item.target), ["confirmed", "rejected"]);
  assert.deepEqual(staffBookingActions({ ...staffBookingsMock[0], status: "confirmed" }, mockStaffContext, 0).map((item) => item.target), ["completed", "noShow"]);
});

test("Mock datetime input uses UTC+7 independently of the host and rejects calendar rollover", () => {
  const now = Date.parse("2026-10-20T18:00:00Z");
  assert.equal(formatStaffMockTime(now), "2026-10-21T01:00");
  assert.equal(parseStaffMockTime("2026-10-21T01:00"), now);
  for (const value of ["", "bad", "2026-02-30T10:00", "2026-10-21T24:00", "2026-10-21T09:00Z"]) assert.ok(Number.isNaN(parseStaffMockTime(value)));
  assert.match(formatStaffPrice(350_000), /350\.000/);
  assert.match(formatStaffPrice(undefined), /Chưa có giá snapshot/);
});

test("Search handles Vietnamese accents, D stroke, case, spaces, IDs and pet names", () => {
  for (const query of ["HÀ LINH", " ha linh ", "Miu", "pf-2084"]) {
    assert.deepEqual(filterStaffBookings(source, mockStaffContext, { ...all, query }).map((item) => item.id), ["PF-2084"]);
  }
  assert.equal(filterStaffBookings(source, mockStaffContext, { ...all, query: "DUC HUY" }).length, 3);
  assert.equal(filterStaffBookings(source, mockStaffContext, { ...all, query: "Đức Huy" }).length, 3);
});

test("All six status filters combine with search and preserve the scoped result total", () => {
  assert.deepEqual(staffStatusOrder.map((status) => filterStaffBookings(source, mockStaffContext, { query: "", status }).length), [3, 1, 1, 1, 1, 1]);
  assert.deepEqual(filterStaffBookings(source, mockStaffContext, { query: "mit", status: "noShow" }).map((item) => item.id), ["PF-2070"]);
  assert.deepEqual(filterStaffBookings(source, mockStaffContext, { query: "miu", status: "completed" }), []);
  assert.equal(scopeStaffBookings(source, mockStaffContext).length, 8);
});

test("Dates use Vietnam time across UTC day boundaries and handle invalid input", () => {
  assert.equal(formatStaffBookingDate("2026-10-20T18:00:00Z"), "21/10/2026 · 01:00");
  assert.equal(formatStaffBookingDate("2026-10-21T02:00:00Z"), "21/10/2026 · 09:00");
  assert.equal(formatStaffBookingDate("bad"), "Chưa có thời gian");
});

test("Selectors preserve independent read-only fixture contents and order", () => {
  const before = JSON.stringify(source);
  filterStaffBookings(source, mockStaffContext, { status: "cancelled", query: "huy" });
  findStaffBooking(source, mockStaffContext, "PF-2084");
  assert.equal(JSON.stringify(source), before);
  assert.deepEqual(filterStaffBookings(source, mockStaffContext, all).map((item) => item.id), staffBookingsMock.map((item) => item.id));
});
