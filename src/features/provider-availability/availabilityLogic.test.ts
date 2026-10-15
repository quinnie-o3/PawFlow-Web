import { test } from "node:test";
import { strict as assert } from "node:assert";
import { applyAvailabilityCommand, availabilityCommandError, canAcceptBooking, effectiveHours, formatAvailabilityDate, heldSeats, localDate, rangesError, summarizeAvailability, weeklyHours } from "./availabilityLogic";
import { availabilityMockNow as now, createAvailabilityMock } from "./data/providerAvailabilityMock";
import type { AvailabilityCommand, AvailabilitySlot, AvailabilityState, DateException } from "./types";

const state = createAvailabilityMock();
const occupied = state.slots.find((slot) => slot.id === "slot-4")!;
const free = state.slots.find((slot) => slot.id === "slot-6")!;
function update(slot: AvailabilitySlot): AvailabilityCommand { return { type: "updateSlot", slot }; }
function create(overrides: Partial<AvailabilitySlot> = {}): AvailabilityCommand {
  return { type: "createSlot", slot: { ...occupied, id: "new-slot", start: "15:30", end: "16:30", ...overrides } };
}
function exception(overrides: Partial<DateException> = {}): AvailabilityCommand {
  return { type: "createException", exception: { id: "new-exception", date: "2026-10-19", ranges: [], ...overrides } };
}
const error = (command: AvailabilityCommand, input = state, time = now) => availabilityCommandError(input, command, time);

test("Each Pending Confirmation and Confirmed booking holds exactly one seat; terminal states do not", () => {
  const reservations = ["pendingConfirmation", "confirmed", "cancelled", "rejected", "completed", "noShow"].map((status, i) => ({ id: String(i), slotId: "s", status })) as AvailabilityState["reservations"];
  assert.equal(heldSeats("s", reservations), 2);
  assert.equal(heldSeats("other", reservations), 0);
});

test("Capacity must be a positive safe integer, and may equal but never undercut held seats", () => {
  for (const capacity of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, 1]) assert.ok(error(update({ ...occupied, capacity })));
  for (const capacity of [2, 3, 4]) assert.equal(error(update({ ...occupied, capacity })), null);
  const next = applyAvailabilityCommand(state, update({ ...occupied, capacity: 2 }), now);
  assert.equal(next.slots.find((slot) => slot.id === occupied.id)?.capacity, 2);
  assert.equal(next.reservations, state.reservations);
});

test("Held slots allow capacity only; service, date, times, closing and deletion are protected", () => {
  for (const overrides of [{ serviceId: "grooming" }, { date: "2026-10-16" }, { start: "15:00" }, { end: "16:00" }, { open: false }]) assert.ok(error(update({ ...occupied, ...overrides })));
  for (const type of ["closeSlot", "deleteSlot"] as const) {
    const next = applyAvailabilityCommand(state, { type, slotId: occupied.id }, now);
    assert.equal(next.feedback?.outcome, "error");
    assert.equal(next.slots, state.slots);
    assert.equal(next.reservations, state.reservations);
  }
});

test("Unoccupied future slots can close, reopen, move, and delete without changing bookings", () => {
  const closed = applyAvailabilityCommand(state, { type: "closeSlot", slotId: free.id }, now);
  assert.equal(closed.slots.find((slot) => slot.id === free.id)?.open, false);
  assert.equal(canAcceptBooking(closed, closed.slots.find((slot) => slot.id === free.id)!, now), false);
  const reopened = applyAvailabilityCommand(closed, update({ ...free, start: "15:30", end: "16:30", capacity: 1 }), now);
  assert.equal(reopened.feedback?.outcome, "success");
  const deleted = applyAvailabilityCommand(reopened, { type: "deleteSlot", slotId: free.id }, now);
  assert.equal(deleted.slots.some((slot) => slot.id === free.id), false);
  assert.equal(deleted.reservations, state.reservations);
});

test("Full slots automatically reject new bookings and do not count as available; increased capacity reopens seats", () => {
  const full = state.slots.find((slot) => slot.id === "slot-7")!;
  assert.equal(canAcceptBooking(state, full, now), false);
  assert.equal(summarizeAvailability(state, now).open, 4);
  const next = applyAvailabilityCommand(state, update({ ...full, capacity: 2 }), now);
  assert.equal(canAcceptBooking(next, next.slots.find((slot) => slot.id === full.id)!, now), true);
});

test("At the start instant and afterwards, all slot mutations are rejected, including equivalent UTC timestamps", () => {
  const start = "2026-10-15T07:30:00Z";
  assert.equal(error(update({ ...occupied, capacity: 4 }), state, "2026-10-15T07:29:59Z"), null);
  for (const command of [update({ ...occupied, capacity: 4 }), { type: "closeSlot", slotId: occupied.id }, { type: "deleteSlot", slotId: occupied.id }] as AvailabilityCommand[]) assert.ok(error(command, state, start));
  assert.ok(error(update({ ...state.slots[0], capacity: 10 })));
  assert.ok(error(create({ start: "09:00", end: "10:00" })));
});

test("Slot length equals selected service duration; unknown services and malformed dates/times fail", () => {
  assert.equal(error(create()), null);
  assert.equal(error(create({ serviceId: "grooming", start: "14:30", end: "16:00" })), null);
  for (const overrides of [{ serviceId: "missing" }, { end: "16:00" }, { date: "2026-02-30" }, { date: "" }, { start: "24:00" }, { start: "" }, { end: "14:30" }]) assert.ok(error(create(overrides)));
});

test("Same-service overlap is blocked, adjacent slots are allowed, and different services have independent capacity", () => {
  assert.ok(error(create({ start: "14:00", end: "15:00" })));
  assert.equal(error(create({ start: "15:30", end: "16:30" })), null);
  assert.equal(error(create({ serviceId: "grooming", start: "14:30", end: "16:00" })), null);
  assert.equal(error(update({ ...occupied, capacity: 4 })), null); // Excludes itself.
});

test("Slots must fit one continuous effective interval, including its boundaries and excluding lunch/closed days", () => {
  assert.equal(error(create({ start: "13:30", end: "14:30" })), null);
  for (const overrides of [{ date: "2026-10-16", start: "11:30", end: "12:30" }, { date: "2026-10-18", start: "09:00", end: "10:00" }, { start: "17:30", end: "18:30" }]) assert.ok(error(create(overrides)));
});

test("Multiple ranges may be unordered or adjacent; overlap, missing endpoints and overnight intervals fail", () => {
  assert.equal(rangesError([{ start: "13:30", end: "18:00" }, { start: "09:00", end: "12:00" }]), null);
  assert.equal(rangesError([{ start: "09:00", end: "10:00" }, { start: "10:00", end: "11:00" }]), null);
  assert.ok(rangesError([{ start: "09:00", end: "11:00" }, { start: "10:00", end: "12:00" }]));
  assert.ok(rangesError([{ start: "23:00", end: "01:00" }]));
  assert.ok(rangesError([{ start: "", end: "12:00" }]));
});

test("Vietnam current date is used at the UTC day boundary and effective dates cannot precede it", () => {
  const midnight = "2026-10-14T17:00:00Z";
  assert.equal(localDate(midnight), "2026-10-15");
  const command: AvailabilityCommand = { type: "saveWeekly", schedule: { effectiveFrom: "2026-10-14", days: state.schedules[0].days } };
  assert.ok(error(command, state, midnight));
  assert.equal(error({ ...command, schedule: { ...command.schedule, effectiveFrom: "2026-10-15" } }, state, midnight), null);
  assert.match(formatAvailabilityDate("2026-10-15"), /15\/10\/2026/);
  assert.equal(formatAvailabilityDate("2026-10-15", false), "15/10");
});

test("Weekly versions preserve history, switch exactly on their effective date, and do not generate slots", () => {
  const days = state.schedules[0].days.map((day) => day.weekday === 1 ? { ...day, ranges: [{ start: "10:00", end: "12:00" }] } : day);
  const command: AvailabilityCommand = { type: "saveWeekly", schedule: { effectiveFrom: "2026-10-22", days } };
  const next = applyAvailabilityCommand(state, command, now);
  assert.equal(next.feedback?.outcome, "success");
  assert.equal(next.schedules.length, 2);
  assert.equal(weeklyHours(next, "2026-10-21")[0].ranges[0].start, "09:00");
  assert.equal(weeklyHours(next, "2026-10-22")[0].ranges[0].start, "10:00");
  assert.deepEqual(next.schedules[0], state.schedules[0]);
  assert.equal(next.slots, state.slots);
  assert.equal(next.reservations, state.reservations);
});

test("Weekly changes list every affected slot, including unoccupied/closed slots; existing exceptions take precedence", () => {
  const days = state.schedules[0].days.map((day) => day.weekday === 5 ? { ...day, ranges: [] } : day);
  const command: AvailabilityCommand = { type: "saveWeekly", schedule: { effectiveFrom: "2026-10-16", days } };
  assert.match(error(command)!, /slot-5/);
  assert.match(error(command)!, /slot-6/);
  const next = applyAvailabilityCommand(state, command, now);
  assert.equal(next.schedules, state.schedules);
  const withException = { ...state, exceptions: [...state.exceptions, { id: "friday", date: "2026-10-16", ranges: state.schedules[0].days[4].ranges }] };
  assert.equal(error(command, withException), null);
  const closeTuesday = state.schedules[0].days.map((day) => day.weekday === 2 ? { ...day, ranges: [] } : day);
  assert.match(error({ type: "saveWeekly", schedule: { effectiveFrom: "2026-10-16", days: closeTuesday } })!, /slot-9/);
});

test("A later weekly version bounds an earlier edit, with no overwrite of future or previous history", () => {
  const later = applyAvailabilityCommand(state, { type: "saveWeekly", schedule: { effectiveFrom: "2026-10-19", days: state.schedules[0].days } }, now);
  const days = state.schedules[0].days.map((day) => day.weekday === 1 ? { ...day, ranges: [] } : day);
  const next = applyAvailabilityCommand(later, { type: "saveWeekly", schedule: { effectiveFrom: "2026-10-16", days } }, now);
  assert.equal(next.feedback?.outcome, "success");
  assert.equal(weeklyHours(next, "2026-10-18")[0].ranges.length, 0);
  assert.equal(weeklyHours(next, "2026-10-19")[0].ranges.length, 2);
});

test("Date exceptions replace all weekly hours, allow multiple ranges, and enforce one configuration per date", () => {
  const empty = createAvailabilityMock(true);
  const next = applyAvailabilityCommand(empty, exception({ ranges: [{ start: "10:00", end: "11:00" }, { start: "16:00", end: "17:00" }] }), now);
  assert.equal(next.feedback?.outcome, "success");
  assert.equal(error(create({ date: "2026-10-19", start: "09:00", end: "10:00" }), next) !== null, true);
  assert.equal(error(create({ date: "2026-10-19", start: "10:00", end: "11:00" }), next), null);
  assert.ok(error(exception({ id: "duplicate" }), next));
  assert.deepEqual(effectiveHours(next, "2026-10-20"), state.schedules[0].days[1].ranges);
});

test("Creating/editing/closing an exception checks all same-day slots, including slots without bookings", () => {
  const command = exception({ date: "2026-10-16", ranges: [{ start: "09:00", end: "12:00" }] });
  assert.match(error(command)!, /slot-6/);
  const blocked = applyAvailabilityCommand(state, exception({ date: "2026-10-16" }), now);
  assert.equal(blocked.exceptions, state.exceptions);
  assert.equal(blocked.reservations, state.reservations);
  const next = applyAvailabilityCommand(state, exception({ date: "2026-10-16", ranges: state.schedules[0].days[4].ranges }), now);
  assert.equal(next.feedback?.outcome, "success");
  assert.ok(error({ type: "updateException", exception: { id: "new-exception", date: "2026-10-16", ranges: [] } }, next));
});

test("Deleting exceptions checks fallback weekly hours; a Sunday slot blocks deletion, while a harmless exception can delete", () => {
  const empty = createAvailabilityMock(true);
  const opened = applyAvailabilityCommand(empty, exception({ date: "2026-10-18", ranges: [{ start: "09:00", end: "12:00" }] }), now);
  const slotted = applyAvailabilityCommand(opened, create({ date: "2026-10-18", start: "09:00", end: "10:00" }), now);
  const deletion: AvailabilityCommand = { type: "deleteException", exceptionId: "new-exception" };
  assert.match(error(deletion, slotted)!, /new-slot/);
  assert.equal(applyAvailabilityCommand(slotted, deletion, now).slots, slotted.slots);
  const deleted = applyAvailabilityCommand(opened, deletion, now);
  assert.equal(deleted.feedback?.outcome, "success");
  assert.deepEqual(effectiveHours(deleted, "2026-10-18"), []);
});

test("Historical exceptions cannot move, edit, or delete; missing and duplicate IDs fail closed", () => {
  for (const command of [{ type: "updateException", exception: { ...state.exceptions[0], date: "2026-10-22" } }, { type: "deleteException", exceptionId: state.exceptions[0].id }, { type: "deleteSlot", slotId: "missing" }, { type: "updateSlot", slot: { ...free, id: "missing" } }, { type: "createSlot", slot: free }] as AvailabilityCommand[]) assert.ok(error(command));
});

test("Save rechecks newly held seats and the start time, not just the state at form opening", () => {
  const command = update({ ...occupied, capacity: 2 });
  assert.equal(error(command), null);
  const newlyHeld = { ...state, reservations: [...state.reservations, { id: "new-hold", slotId: occupied.id, status: "pendingConfirmation" as const }] };
  assert.equal(applyAvailabilityCommand(newlyHeld, command, now).feedback?.outcome, "error");
  assert.equal(applyAvailabilityCommand(state, command, "2026-10-15T14:30:00+07:00").feedback?.outcome, "error");
  const deletion: AvailabilityCommand = { type: "deleteSlot", slotId: free.id };
  assert.equal(error(deletion), null);
  const reserved = { ...state, reservations: [...state.reservations, { id: "new", slotId: free.id, status: "confirmed" as const }] };
  assert.equal(applyAvailabilityCommand(reserved, deletion, now).feedback?.outcome, "error");
});

test("Simulated failure leaves every data collection unchanged; retry succeeds without mutating source fixtures", () => {
  const command = create();
  const failed = applyAvailabilityCommand(state, command, now, true);
  for (const key of ["slots", "reservations", "schedules", "exceptions"] as const) assert.equal(failed[key], state[key]);
  const retried = applyAvailabilityCommand(failed, command, now);
  assert.equal(retried.feedback?.outcome, "success");
  assert.equal(retried.slots.length, state.slots.length + 1);
  assert.equal(error(command, retried) !== null, true);
  assert.equal(createAvailabilityMock().slots.length, state.slots.length);
});
