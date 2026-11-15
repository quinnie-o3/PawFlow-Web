import test from "node:test";
import assert from "node:assert/strict";
import { createCatalogMock, MOCK_NOW } from "../customer-catalog/data/catalogMock";
import { createCustomerPetsMock } from "../customer-pets/data/customerPetsMock";
import { createMockRepository } from "../customer-catalog/mockRepository";
import { actionEligibility, getOwnBooking, listOwnBookings } from "./bookingLogic";
import { BookingMockWorkspace, type SubmitContext, type SubmitFault } from "./mockWorkspace";

const now = Date.parse(MOCK_NOW);
const actor = { id: "customer-demo", role: "CUSTOMER" };
const pause = (ms = 10) => new Promise(resolve => setTimeout(resolve, ms));
function fixture(fault: SubmitFault = "none") {
  const store = new BookingMockWorkspace(createCatalogMock(), now);
  const pets = createCustomerPetsMock();
  store.ensureFlow("1", "101", pets.pets[0]!.id);
  store.select("1", "slotId", "s2");
  store.review("1", actor, pets, now);
  const context: SubmitContext = { actor, pets: () => pets, now: () => store.getSnapshot().now, delayMs: 0, fault };
  return { store, pets, context };
}

test("shared catalog and canonical booking commit together; double-click sends one attempt", async () => {
  const { store, context } = fixture();
  const before = store.getSnapshot();
  let atomic = false;
  const unsubscribe = store.subscribe(() => {
    const state = store.getSnapshot();
    if (state.booking.bookings.length) {
      assert.equal(state.catalog.slots.find(s => s.id === "s2")!.booked, 2);
      atomic = true;
    }
  });
  store.submit("1", context); store.submit("1", context);
  assert.equal(store.getSnapshot().flows["1"]!.submission.phase, "pending");
  await pause();
  const state = store.getSnapshot();
  assert.equal(state.booking.bookings.length, 1);
  assert.equal(state.booking.attempts.length, 1);
  assert.equal(before.catalog.slots.find(s => s.id === "s2")!.booked, 1);
  const booking = listOwnBookings(state.booking, actor)[0]!;
  assert.equal(getOwnBooking(state.booking, actor, booking.id), booking);
  const repository = createMockRepository(state.catalog);
  const slots = await repository.availability("1", { signal: new AbortController().signal, delayMs: 0 });
  assert.equal(slots.find(s => s.id === "s2")!.booked, 2);
  assert.ok(atomic);
  unsubscribe(); store.dispose();
});

for (const scenario of ["full", "price"] as const) {
  test("commit revalidates latest shared catalog after review: " + scenario, async () => {
    const { store, context } = fixture();
    store.submit("1", context);
    // External catalog change while transport is pending; the pure input is
    // projected at commit, not captured from review.
    const state = store.getSnapshot();
    if (scenario === "full") state.catalog.slots.find(s => s.id === "s2")!.booked = 2;
    else state.catalog.services.find(s => s.id === "101")!.price = "260000.00";
    await pause();
    assert.equal(store.getSnapshot().booking.bookings.length, 0);
    assert.equal(store.getSnapshot().flows["1"]!.error, scenario === "full" ? "SLOT_FULL" : "QUOTE_CHANGED");
    store.dispose();
  });
}

test("pet ownership/status is read from original pet source at commit", async () => {
  const { store, pets, context } = fixture();
  store.submit("1", context);
  pets.pets[0]!.status = "INACTIVE";
  await pause();
  assert.equal(store.getSnapshot().booking.bookings.length, 0);
  assert.equal(store.getSnapshot().flows["1"]!.error, "PET_UNAVAILABLE");
  store.dispose();
});

for (const scenario of ["closed", "started", "moved", "duration", "inactive-service", "inactive-category", "foreign-pet"] as const) {
  test("pending commit reads changed source, not review-time projection: " + scenario, async () => {
    const { store, pets, context } = fixture();
    store.submit("1", context);
    const catalog = store.getSnapshot().catalog;
    const slot = catalog.slots.find(s => s.id === "s2")!;
    const service = catalog.services.find(s => s.id === "101")!;
    const expected = {
      closed: "SLOT_CLOSED", started: "SLOT_STARTED", moved: "SLOT_CHANGED",
      duration: "QUOTE_CHANGED", "inactive-service": "SERVICE_UNAVAILABLE",
      "inactive-category": "SERVICE_UNAVAILABLE", "foreign-pet": "PET_UNAVAILABLE",
    }[scenario];
    if (scenario === "closed") slot.status = "CLOSED";
    if (scenario === "started") store.setNow(Date.parse("2026-11-04T14:00:00+07:00"));
    if (scenario === "moved") slot.start = "15:00";
    if (scenario === "duration") service.durationMinutes = 30;
    if (scenario === "inactive-service") service.active = false;
    if (scenario === "inactive-category") service.categoryActive = false;
    if (scenario === "foreign-pet") pets.pets[0]!.ownerId = "another-customer";
    await pause();
    assert.equal(store.getSnapshot().flows["1"]!.error, expected);
    assert.equal(store.getSnapshot().booking.bookings.length, 0);
    assert.equal(store.getSnapshot().booking.attempts.length, 0);
    assert.equal(slot.booked, 1);
    store.dispose();
  });
}

test("known pre-create failure preserves state and retries the same attempt", async () => {
  const { store, context } = fixture("before-create");
  store.submit("1", context); await pause();
  const failed = store.getSnapshot().flows["1"]!.submission;
  assert.equal(failed.phase, "failed");
  assert.equal(store.getSnapshot().booking.bookings.length, 0);
  store.submit("1", { ...context, fault: "none" }); await pause();
  const saved = store.getSnapshot();
  assert.equal(saved.booking.bookings.length, 1);
  assert.equal(saved.booking.attempts[0]!.attemptId, failed.attempt.id);
  store.dispose();
});

for (const fault of ["timeout-before", "timeout-after"] as const) {
  test("unknown timeout reconciles canonical attempt: " + fault, async () => {
    const { store, context } = fixture(fault);
    store.submit("1", context); await pause();
    assert.equal(store.getSnapshot().flows["1"]!.submission.phase, "unknown");
    store.submit("1", { ...context, fault: "none" });
    assert.equal(store.getSnapshot().flows["1"]!.submission.phase, "unknown");
    store.reconcile("1", actor, 0); await pause();
    const state = store.getSnapshot();
    assert.equal(state.flows["1"]!.submission.phase, fault === "timeout-after" ? "succeeded" : "failed");
    assert.equal(state.booking.bookings.length, fault === "timeout-after" ? 1 : 0);
    if (fault === "timeout-before") {
      store.submit("1", { ...context, fault: "none" }); await pause();
      assert.equal(store.getSnapshot().booking.bookings.length, 1);
    }
    store.dispose();
  });
}

test("in-flight reconciliation does not allow a racing retry; late commit is recovered", async () => {
  const { store, context } = fixture("slow-timeout");
  store.submit("1", context); await pause();
  store.reconcile("1", actor, 0); await pause();
  assert.equal(store.getSnapshot().flows["1"]!.submission.phase, "unknown");
  store.submit("1", { ...context, fault: "none" });
  await pause(1520);
  assert.equal(store.getSnapshot().booking.bookings.length, 1);
  store.reconcile("1", actor, 0); await pause();
  assert.equal(store.getSnapshot().flows["1"]!.submission.phase, "succeeded");
  store.dispose();
});

test("failed receipt lookup stays unknown; successful lookup never consumes another place", async () => {
  const { store, context } = fixture("timeout-after");
  store.submit("1", context); await pause();
  store.reconcile("1", actor, 0, true); await pause();
  assert.equal(store.getSnapshot().flows["1"]!.submission.phase, "unknown");
  store.reconcile("1", actor, 0); await pause();
  assert.equal(store.getSnapshot().flows["1"]!.submission.phase, "succeeded");
  assert.equal(store.getSnapshot().catalog.slots.find(s => s.id === "s2")!.booked, 2);
  store.dispose();
});

test("create -> same detail -> cancel updates capacity/log once and enforces start boundary", async () => {
  const { store, context } = fixture();
  store.submit("1", context); await pause();
  const booking = listOwnBookings(store.getSnapshot().booking, actor)[0]!;
  store.setNow(booking.appointmentStartAt);
  assert.equal(store.act(actor, booking.id, store.getSnapshot().now, { type: "cancel", reason: "" }).ok, false);
  store.setNow(now);
  assert.equal(store.act(actor, booking.id, now, { type: "cancel", reason: "" }).ok, true);
  assert.equal(store.act(actor, booking.id, now, { type: "cancel", reason: "" }).ok, false);
  const current = getOwnBooking(store.getSnapshot().booking, actor, booking.id)!;
  assert.equal(current.status, "CANCELLED");
  assert.equal(current.statusLogs.length, 2);
  assert.equal(current.statusLogs[1]!.reason, null);
  assert.equal(store.getSnapshot().catalog.slots.find(s => s.id === "s2")!.booked, 1);
  store.dispose();
});

test("distinct same-pet bookings remain allowed when capacity exists", async () => {
  const { store, context } = fixture();
  store.select("1", "slotId", "s3");
  store.review("1", actor, context.pets(), now);
  store.submit("1", context); await pause();
  store.resetFlow("1");
  store.select("1", "slotId", "s3");
  store.review("1", actor, context.pets(), now);
  store.submit("1", context); await pause();
  assert.equal(store.getSnapshot().booking.bookings.length, 2);
  assert.equal(new Set(store.getSnapshot().booking.bookings.map(b => b.id)).size, 2);
  store.dispose();
});

test("history samples reuse actual pet/catalog IDs; eligible feedback writes only shared booking state", () => {
  const { store, pets } = fixture();
  store.seedHistory(actor, pets); store.seedHistory(actor, pets);
  const state = store.getSnapshot();
  assert.equal(state.booking.bookings.length, 4);
  for (const booking of state.booking.bookings) {
    assert.ok(pets.pets.some(p => p.id === booking.petId));
    assert.ok(state.catalog.services.some(s => s.id === booking.serviceId));
  }
  const completed = state.booking.bookings.find(b => b.status === "COMPLETED")!;
  assert.equal(store.act(actor, completed.id, now, { type: "review", rating: 5, comment: "sample" }).ok, true);
  assert.equal(actionEligibility(store.getSnapshot().booking, actor, completed.id, now).review, "ALREADY_REVIEWED");
  assert.equal(store.act(actor, completed.id, now, { type: "complaint", reason: "sample" }).ok, true);
  assert.equal(actionEligibility(store.getSnapshot().booking, actor, completed.id, now).complaint, "ACTIVE_COMPLAINT");
  store.dispose();
});

test("leaving workspace disposes pending mock work; a fresh workspace cannot see old receipts", async () => {
  const { store, context } = fixture();
  store.submit("1", { ...context, delayMs: 30 });
  store.dispose(); await pause(50);
  assert.equal(store.getSnapshot().booking.bookings.length, 0);
  const fresh = fixture().store;
  assert.equal(fresh.getSnapshot().booking.attempts.length, 0);
  fresh.dispose();
});
