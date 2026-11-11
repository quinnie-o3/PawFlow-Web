import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { emptyBookingState } = require(process.env.BOOKING_TEST_BUILD + "/model.js");
const {
  readCurrentQuote, reviewDraft, revalidateSubmission, changeSelection,
  createBooking, getOwnBooking, listOwnBookings, actionEligibility,
  cancelBooking, addReview, addComplaint, lookupAttempt, payloadFingerprint,
} = require(process.env.BOOKING_TEST_BUILD + "/bookingLogic.js");
const {
  beginSubmission, settleSubmission, beginReconciliation, finishReconciliation,
} = require(process.env.BOOKING_TEST_BUILD + "/submissionLogic.js");

// Small normalized test doubles only. No pet/catalog fixture is shipped.
const customer = Object.freeze({ id: "test-customer", role: "CUSTOMER" });
const other = Object.freeze({ id: "other-customer", role: "CUSTOMER" });
const NOW = Date.parse("2026-11-07T10:00:00+07:00");
const START = NOW + 3_600_000;
const draft = () => ({
  petId: "test-pet", providerId: "test-provider", serviceId: "test-service",
  slotId: "test-slot", customerNote: "  note  ", reviewedQuote: null,
});
const facts = () => ({
  pet: { id: "test-pet", ownerId: customer.id, active: true },
  provider: { id: "test-provider", approved: true },
  service: {
    id: "test-service", providerId: "test-provider", active: true,
    categoryActive: true, price: "250000.00", durationMinutes: 60,
  },
  slot: {
    id: "test-slot", providerId: "test-provider", serviceId: "test-service",
    startAt: START, endAt: START + 3_600_000,
    status: "OPEN", capacity: 2, booked: 0,
  },
});
function reviewed(input = draft(), current = facts()) {
  const result = reviewDraft(customer, input, current, NOW);
  assert.equal(result.ok, true);
  return result.value;
}
function created(status = "PENDING_CONFIRMATION") {
  const result = createBooking(emptyBookingState(), customer, reviewed(), facts(), NOW, "attempt-1", "booking-1");
  assert.equal(result.ok, true);
  const state = {
    ...result.state,
    bookings: result.state.bookings.map(b => ({ ...b, status })),
  };
  return { result, state };
}
function freezeTree(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(freezeTree);
    Object.freeze(value);
  }
  return value;
}
function assertRejected(result, expected, original) {
  assert.equal(result.ok, false);
  assert.equal(result.code, expected);
  if (original) assert.equal(result.state, original);
}

test("create receipt, success, list and detail resolve the same canonical booking", () => {
  const initial = freezeTree(emptyBookingState());
  const input = freezeTree(reviewed());
  const current = freezeTree(facts());
  const result = createBooking(initial, customer, input, current, NOW, "a", "b");
  assert.equal(result.ok, true);
  assert.equal(initial.bookings.length, 0);
  assert.deepEqual(result.capacityChange, { slotId: "test-slot", delta: 1 });
  assert.equal(current.slot.booked, 0);
  const confirmation = getOwnBooking(result.state, customer, result.bookingId);
  assert.equal(confirmation, listOwnBookings(result.state, customer)[0]);
  assert.equal(confirmation, getOwnBooking(result.state, customer, "b"));
  assert.equal(confirmation.status, "PENDING_CONFIRMATION");
  assert.equal(confirmation.bookedPrice, "250000.00");
  assert.equal(confirmation.customerNote, "note");
  assert.equal("serviceDurationMinutes" in confirmation, false);
  assert.equal("bookedDurationMinutes" in confirmation, false);
  assert.equal(confirmation.statusLogs.length, 1);
  assert.deepEqual(confirmation.statusLogs[0], {
    oldStatus: null, newStatus: "PENDING_CONFIRMATION", changedBy: customer.id,
    changedAt: NOW, reason: null,
  });
  assert.equal(getOwnBooking(result.state, other, "b"), null);
  assert.deepEqual(listOwnBookings(result.state, other), []);
});

test("review/selection never reserve capacity; changing context clears stale choices", () => {
  const current = freezeTree(facts());
  const r = reviewed(draft(), current);
  assert.equal(current.slot.booked, 0);
  assert.equal(changeSelection(r, "petId", r.petId), r);
  assert.equal(changeSelection(r, "petId", "second-pet").reviewedQuote, null);
  assert.equal(changeSelection(r, "slotId", "another-slot").reviewedQuote, null);
  const service = changeSelection(r, "serviceId", "another-service");
  assert.equal(service.slotId, null);
  const provider = changeSelection(r, "providerId", "another-provider");
  assert.equal(provider.serviceId, null);
  assert.equal(provider.slotId, null);
});

for (const [name, mutate, error] of [
  ["full", f => { f.slot.booked = f.slot.capacity; }, "SLOT_FULL"],
  ["closed", f => { f.slot.status = "CLOSED"; }, "SLOT_CLOSED"],
  ["cancelled", f => { f.slot.status = "CANCELLED"; }, "SLOT_CLOSED"],
  ["already started", f => { f.slot.startAt = NOW; }, "SLOT_STARTED"],
  ["past", f => { f.slot.startAt = NOW - 1; }, "SLOT_STARTED"],
  ["unknown capacity", f => { f.slot.booked = null; }, "CAPACITY_UNKNOWN"],
  ["inconsistent capacity", f => { f.slot.booked = 3; }, "CAPACITY_UNKNOWN"],
  ["fractional capacity", f => { f.slot.capacity = 1.5; }, "CAPACITY_UNKNOWN"],
  ["unknown time", f => { f.slot.startAt = NaN; }, "SLOT_TIME_UNKNOWN"],
  ["invalid time interval", f => { f.slot.endAt = f.slot.startAt; }, "SLOT_TIME_UNKNOWN"],
  ["insufficient interval", f => { f.slot.endAt = f.slot.startAt + 30 * 60_000; }, "SLOT_TOO_SHORT"],
  ["archived pet", f => { f.pet.active = false; }, "PET_UNAVAILABLE"],
  ["foreign pet", f => { f.pet.ownerId = other.id; }, "PET_UNAVAILABLE"],
  ["missing pet", f => { f.pet = null; }, "PET_UNAVAILABLE"],
  ["hidden provider", f => { f.provider.approved = false; }, "PROVIDER_UNAVAILABLE"],
  ["inactive service", f => { f.service.active = false; }, "SERVICE_UNAVAILABLE"],
  ["inactive category", f => { f.service.categoryActive = false; }, "SERVICE_UNAVAILABLE"],
  ["foreign service", f => { f.service.providerId = "foreign"; }, "CONTEXT_MISMATCH"],
  ["foreign slot", f => { f.slot.serviceId = "foreign"; }, "CONTEXT_MISMATCH"],
  ["missing slot", f => { f.slot = null; }, "SLOT_UNAVAILABLE"],
  ["missing price", f => { f.service.price = null; }, "PRICE_UNKNOWN"],
  ["invalid price", f => { f.service.price = "-1"; }, "PRICE_UNKNOWN"],
  ["missing duration", f => { f.service.durationMinutes = null; }, "DURATION_UNKNOWN"],
]) {
  test("submit rechecks " + name + " after a valid review without side effects", () => {
    const input = reviewed();
    const current = facts();
    mutate(current);
    const state = freezeTree(emptyBookingState());
    assertRejected(createBooking(state, customer, input, freezeTree(current), NOW, "a", "b"), error, state);
    assert.equal(state.bookings.length, 0);
    assert.equal(state.attempts.length, 0);
  });
}

test("changed price/duration requires review and does not mutate the old quote", () => {
  const input = freezeTree(reviewed());
  for (const field of ["price", "durationMinutes"]) {
    const current = facts();
    current.service[field] = field === "price" ? "260000.00" : 30;
    assertRejected(revalidateSubmission(customer, input, current, NOW), "QUOTE_CHANGED");
    const revised = reviewed(input, current);
    const result = createBooking(emptyBookingState(), customer, revised, current, NOW, field, field);
    assert.equal(result.ok, true);
    assert.equal(result.state.bookings[0].bookedPrice, field === "price" ? "260000.00" : "250000.00");
  }
  assert.equal(input.reviewedQuote.price, "250000.00");
});

test("price snapshot remains fixed after catalog changes; no false float conflict or zero-price ban", () => {
  const { state } = created();
  const current = facts();
  current.service.price = "999999.99";
  assert.equal(getOwnBooking(state, customer, "booking-1").bookedPrice, "250000.00");
  for (const value of ["250000", "250000.0", "0250000.00"]) {
    current.service.price = value;
    assert.equal(revalidateSubmission(customer, reviewed(), current, NOW).ok, true);
  }
  current.service.price = "0";
  assert.equal(readCurrentQuote(customer, draft(), current, NOW).value.price, "0.00");
});

test("changed slot schedule requires re-selection; stale selection or no review cannot submit", () => {
  const input = reviewed();
  const current = facts();
  current.slot.startAt += 60_000;
  current.slot.endAt += 60_000;
  assertRejected(revalidateSubmission(customer, input, current, NOW), "SLOT_CHANGED");
  assertRejected(revalidateSubmission(customer, draft(), facts(), NOW), "REVIEW_REQUIRED");
  assertRejected(revalidateSubmission(customer, { ...input, petId: null }, facts(), NOW), "SELECTION_REQUIRED");
  assertRejected(readCurrentQuote(customer, draft(), facts(), NaN), "CLOCK_INVALID");
  assertRejected(readCurrentQuote({ ...customer, role: "PROVIDER_STAFF" }, draft(), facts(), NOW), "CUSTOMER_REQUIRED");
});

test("failure before create preserves draft/state/capacity and permits same-attempt retry", () => {
  const input = freezeTree(reviewed());
  const initial = freezeTree(emptyBookingState());
  const result = createBooking(initial, customer, input, facts(), NOW, "a", "b", "before-create");
  assertRejected(result, "NETWORK_BEFORE_CREATE", initial);
  let machine = beginSubmission({ phase: "editing" }, customer, input, "a").state;
  machine = settleSubmission(machine, "a", { kind: "known-failure", code: result.code });
  const retry = beginSubmission(machine, customer, input, "new-id-unused");
  assert.equal(retry.ok, true);
  assert.equal(retry.attempt.id, "a");
  const success = createBooking(initial, customer, input, facts(), NOW, retry.attempt.id, "b");
  assert.equal(success.ok, true);
  assert.equal(success.state.bookings.length, 1);
  assert.equal(input.customerNote, "  note  ");
});

test("same mock attempt replays after slot fills/starts without another capacity reservation", () => {
  const input = reviewed();
  const first = createBooking(emptyBookingState(), customer, input, facts(), NOW, "a", "b");
  const current = facts();
  current.slot.booked = 2;
  const replay = createBooking(first.state, customer, input, current, START, "a", "unused");
  assert.equal(replay.ok, true);
  assert.equal(replay.replayed, true);
  assert.equal(replay.state, first.state);
  assert.equal(replay.bookingId, "b");
  assert.equal(replay.capacityChange, null);
  const changed = { ...input, customerNote: "different payload" };
  assertRejected(createBooking(first.state, customer, changed, current, NOW, "a", "c"), "ATTEMPT_MISMATCH", first.state);
});

test("replay resolves current cancelled record; receipts and payloads are Customer scoped", () => {
  const input = reviewed();
  const first = createBooking(emptyBookingState(), customer, input, facts(), NOW, "a", "b");
  const cancelled = cancelBooking(first.state, customer, "b", NOW + 1, 1);
  const replay = createBooking(cancelled.state, customer, {
    ...input, customerNote: "note",
  }, facts(), NOW + 2, "a", "unused");
  assert.equal(replay.ok, true);
  assert.equal(getOwnBooking(replay.state, customer, replay.bookingId).status, "CANCELLED");
  assert.equal(replay.capacityChange, null);
  assert.deepEqual(lookupAttempt(replay.state, other.id, "a", payloadFingerprint(input)), { kind: "absent" });
});

test("different attempts may book the same pet and interval while capacity remains", () => {
  const input = reviewed();
  const first = createBooking(emptyBookingState(), customer, input, facts(), NOW, "a1", "b1");
  const current = facts();
  current.slot.booked += first.capacityChange.delta;
  const second = createBooking(first.state, customer, input, current, NOW + 1, "a2", "b2");
  assert.equal(second.ok, true);
  assert.equal(second.state.bookings.length, 2);
  current.slot.booked += second.capacityChange.delta;
  assertRejected(createBooking(second.state, customer, input, current, NOW + 2, "a3", "b3"), "SLOT_FULL", second.state);
});

test("pending locks double-click; timeout blocks send until receipt reconciliation finds success", () => {
  const input = reviewed();
  const started = beginSubmission({ phase: "editing" }, customer, input, "a");
  assert.equal(started.ok, true);
  assert.equal(beginSubmission(started.state, customer, input, "b").ok, false);
  const committed = createBooking(emptyBookingState(), customer, input, facts(), NOW, "a", "booking");
  let machine = settleSubmission(started.state, "a", { kind: "unknown" });
  assert.equal(machine.phase, "unknown");
  assert.equal(beginSubmission(machine, customer, { ...input, customerNote: "edited" }, "b").ok, false);
  machine = beginReconciliation(machine);
  assert.equal(beginSubmission(machine, customer, input, "b").ok, false);
  const receipt = lookupAttempt(committed.state, customer.id, "a", payloadFingerprint(input));
  machine = finishReconciliation(machine, "a", receipt);
  assert.equal(machine.phase, "succeeded");
  assert.equal(getOwnBooking(committed.state, customer, machine.bookingId), listOwnBookings(committed.state, customer)[0]);
  assert.equal(beginSubmission(machine, customer, input, "b").ok, false);
  assert.equal(committed.state.bookings.length, 1);
});

for (const kind of ["in-flight", "unavailable", "mismatch"]) {
  test("reconciliation " + kind + " keeps outcome unresolved and submit blocked", () => {
    const started = beginSubmission({ phase: "editing" }, customer, reviewed(), "a");
    let machine = settleSubmission(started.state, "a", { kind: "unknown" });
    machine = beginReconciliation(machine);
    machine = finishReconciliation(machine, "a", { kind });
    assert.equal(machine.phase, "unknown");
    assert.equal(beginSubmission(machine, customer, reviewed(), "b").ok, false);
  });
}

test("only terminal absence unlocks same-attempt retry; changed payload then gets a new attempt", () => {
  const input = reviewed();
  const started = beginSubmission({ phase: "editing" }, customer, input, "a");
  const unknown = settleSubmission(started.state, "a", { kind: "unknown" });
  const failed = finishReconciliation(beginReconciliation(unknown), "a", { kind: "absent" });
  assert.equal(failed.phase, "failed");
  assert.equal(beginSubmission(failed, customer, input, "b").attempt.id, "a");
  assert.equal(beginSubmission(failed, customer, { ...input, customerNote: "new" }, "b").attempt.id, "b");
});

test("late/foreign responses and results after workspace disposal cannot overwrite state", () => {
  const pending = beginSubmission({ phase: "editing" }, customer, reviewed(), "a").state;
  assert.equal(settleSubmission(pending, "other-attempt", { kind: "success", bookingId: "other" }), pending);
  const disposed = { phase: "editing" };
  assert.equal(settleSubmission(disposed, "a", { kind: "success", bookingId: "old" }), disposed);
  const success = settleSubmission(pending, "a", { kind: "success", bookingId: "b" });
  assert.equal(settleSubmission(success, "a", { kind: "known-failure", code: "NETWORK_BEFORE_CREATE" }), success);
  const reconciling = beginReconciliation(settleSubmission(pending, "a", { kind: "unknown" }));
  assert.equal(finishReconciliation(reconciling, "old-attempt", { kind: "absent" }), reconciling);
});

for (const status of ["PENDING_CONFIRMATION", "CONFIRMED", "REJECTED", "COMPLETED", "CANCELLED", "NO_SHOW"]) {
  test("Customer action matrix for " + status, () => {
    const { state } = created(status);
    const eligibility = actionEligibility(state, customer, "booking-1", NOW);
    assert.equal(eligibility.cancel === null, ["PENDING_CONFIRMATION", "CONFIRMED"].includes(status));
    assert.equal(eligibility.review === null, status === "COMPLETED");
    assert.equal(eligibility.complaint === null, status !== "PENDING_CONFIRMATION");
    for (const actor of [other, { ...customer, role: "PROVIDER_STAFF" }]) {
      const denied = actionEligibility(state, actor, "booking-1", NOW);
      assert.ok(denied.cancel && denied.review && denied.complaint);
    }
  });
}

for (const status of ["PENDING_CONFIRMATION", "CONFIRMED"]) {
  test("cancel " + status + " is strictly before start; reason optional; one capacity release", () => {
    const { state } = created(status);
    const before = cancelBooking(freezeTree(state), customer, "booking-1", START - 1, 1);
    assert.equal(before.ok, true);
    assert.deepEqual(before.capacityChange, { slotId: "test-slot", delta: -1 });
    const booking = getOwnBooking(before.state, customer, "booking-1");
    assert.equal(booking.status, "CANCELLED");
    assert.equal(booking.statusLogs.at(-1).reason, null);
    assert.equal(booking.bookedPrice, "250000.00");
    assertRejected(cancelBooking(before.state, customer, "booking-1", START - 1, 0), "CANCEL_STATUS", before.state);
    assertRejected(cancelBooking(state, customer, "booking-1", START, 1), "CANCEL_TIME", state);
    assertRejected(cancelBooking(state, customer, "booking-1", START + 1, 1), "CANCEL_TIME", state);
    assertRejected(cancelBooking(state, customer, "booking-1", NOW, 0), "NO_RESERVED_CAPACITY", state);
    assertRejected(cancelBooking(state, customer, "booking-1", NOW, null), "CAPACITY_UNKNOWN", state);
  });
}

test("cancellation reason is trimmed and foreign/missing booking is indistinguishable", () => {
  const { state } = created();
  const result = cancelBooking(state, customer, "booking-1", NOW, 1, "  changed  ");
  assert.equal(getOwnBooking(result.state, customer, "booking-1").statusLogs.at(-1).reason, "changed");
  assertRejected(cancelBooking(state, other, "booking-1", NOW, 1), "BOOKING_NOT_FOUND", state);
  assertRejected(cancelBooking(state, customer, "missing", NOW, 1), "BOOKING_NOT_FOUND", state);
});

test("review requires COMPLETED, one per booking; no arbitrary expiry; rating 1..5", () => {
  const { state } = created("COMPLETED");
  for (const rating of [1, 5]) {
    const result = addReview(freezeTree(state), customer, "booking-1", NOW + 366 * 86_400_000, rating, "  comment  ");
    assert.equal(result.ok, true);
    assert.equal(result.state.reviews[0].comment, "comment");
    assert.equal(result.capacityChange, null);
    assertRejected(addReview(result.state, customer, "booking-1", NOW, 5), "ALREADY_REVIEWED", result.state);
  }
  for (const rating of [0, 6, 1.5, NaN]) {
    assertRejected(addReview(state, customer, "booking-1", NOW, rating), "RATING_INVALID", state);
  }
  const pending = created().state;
  assertRejected(addReview(pending, customer, "booking-1", NOW, 5), "REVIEW_STATUS", pending);
});

test("complaint blocks pending and active duplicates; resolved/rejected permit another; no expiry", () => {
  const pending = created().state;
  assertRejected(addComplaint(pending, customer, "booking-1", NOW, "c", "reason"), "COMPLAINT_STATUS", pending);
  const { state } = created("CONFIRMED");
  const first = addComplaint(freezeTree(state), customer, "booking-1", NOW + 366 * 86_400_000, "c1", "  reason  ");
  assert.equal(first.ok, true);
  assert.equal(first.state.complaints[0].reason, "reason");
  assert.equal(first.state.complaints[0].status, "OPEN");
  for (const status of ["OPEN", "IN_REVIEW", "RESOLVED", "REJECTED"]) {
    const current = { ...first.state, complaints: first.state.complaints.map(c => ({ ...c, status })) };
    const next = addComplaint(current, customer, "booking-1", NOW, "c2", "another");
    assert.equal(next.ok, ["RESOLVED", "REJECTED"].includes(status));
    if (!next.ok) assert.equal(next.code, "ACTIVE_COMPLAINT");
  }
  for (const reason of ["", "   ", "x".repeat(2001)]) {
    assertRejected(addComplaint(state, customer, "booking-1", NOW, "c", reason), "REASON_INVALID", state);
  }
  assert.equal(addComplaint(state, customer, "booking-1", NOW, "c", "x".repeat(2000)).ok, true);
  assert.equal(addComplaint(state, customer, "booking-1", NOW, "c", "🐾".repeat(2000)).ok, true);
  assertRejected(addComplaint(state, customer, "booking-1", NOW, "c", "🐾".repeat(2001)), "REASON_INVALID", state);
});

test("state lifecycle: route selectors keep data; fresh workspace has no old booking or receipt", () => {
  const { state } = created();
  assert.equal(getOwnBooking(state, customer, "booking-1"), listOwnBookings(state, customer)[0]);
  const reset = emptyBookingState();
  assert.equal(getOwnBooking(reset, customer, "booking-1"), null);
  assert.deepEqual(lookupAttempt(reset, customer.id, "attempt-1", payloadFingerprint(reviewed())), { kind: "absent" });
  assert.deepEqual(listOwnBookings(reset, customer), []);
});
