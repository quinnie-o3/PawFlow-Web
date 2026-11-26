import test from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "../../lib/api/errors";
import { formatMessage, vi } from "../../lib/locale";
import type { CustomerPet } from "../customer-pets/types";
import type { Provider, Service } from "../public-catalog/api";
import {
  classifyBookingError,
  type LiveAvailabilitySlot,
  type LiveCustomerBooking,
} from "./liveApi";
import {
  LIVE_SUBMISSION_ERROR_CODES,
  activeCustomerActor,
  actorIdentityKey,
  availableDatesForSlots,
  beginLiveSubmission,
  beginSameKeyRetry,
  createInitialFlow,
  failPreSubmitVerification,
  fromApiErrorInfo,
  isSubmissionLocked,
  promoteToPendingCreate,
  readLiveQuote,
  resetFlowForNewBooking,
  retryCooldownRemainingMs,
  reviewFlow,
  selectFlowField,
  sessionBoundaryAction,
  sessionIdentityKey,
  settleLiveSubmission,
  shouldShowReceiptDialog,
  syncFlowService,
  updateFlowNote,
  validateFreshSlotAgainstQuote,
  type LiveBookingActor,
  type LiveBookingFacts,
  type LiveSessionSnapshot,
} from "./liveSubmission";

const GEN_1 = "11111111-1111-4111-8111-111111111111";
const GEN_2 = "22222222-2222-4222-8222-222222222222";
const KEY_1 = "3f0c8a52-6c1e-4f5b-9a7e-2d4b8c1e9f01";
const KEY_2 = "3f0c8a52-6c1e-4f5b-9a7e-2d4b8c1e9f02";
const NOW = 1_795_000_000_000;

const actorA: LiveBookingActor = {
  id: "20",
  role: "CUSTOMER",
  generation: GEN_1,
};

const providerFixture: Provider = {
  id: "3",
  businessName: "Paw Spa",
  address: "1 Nguyen Hue",
  description: null,
  ratingAvg: "4.80",
  ratingCount: 12,
  serviceCount: 2,
  minPrice: "150000.00",
  maxPrice: "250000.00",
};

const serviceFixture: Service = {
  id: "5",
  name: "Tắm & spa",
  description: null,
  price: "150000.00",
  durationMinutes: 60,
  category: { id: "1", name: "Grooming", description: null },
  provider: {
    id: "3",
    businessName: "Paw Spa",
    address: "1 Nguyen Hue",
    description: null,
    ratingAvg: "4.80",
    ratingCount: 12,
  },
};

const slotFixture = (
  overrides: Partial<LiveAvailabilitySlot> = {},
): LiveAvailabilitySlot => ({
  id: "12",
  slotDate: "2026-12-01",
  startTime: "09:00:00",
  endTime: "10:00:00",
  capacity: 2,
  bookedCount: 1,
  service: {
    id: "5",
    name: "Tắm & spa",
    description: null,
    price: "150000.00",
    durationMinutes: 60,
    category: { id: "1", name: "Grooming", description: null },
  },
  provider: serviceFixture.provider,
  ...overrides,
});

const petFixture = (overrides: Partial<CustomerPet> = {}): CustomerPet => ({
  id: "8",
  ownerId: "20",
  petTypeId: "1",
  name: "Milo",
  breed: "Corgi",
  birthDate: "2023-05-01",
  weight: 8.5,
  healthNote: null,
  status: "ACTIVE",
  version: 0,
  image: null,
  ...overrides,
});

const bookingFixture = (
  overrides: Partial<LiveCustomerBooking> = {},
): LiveCustomerBooking => ({
  id: "9007199254740993",
  status: "PENDING_CONFIRMATION",
  bookedPrice: "150000.00",
  customerNote: "Nhẹ tay",
  createdAt: "2026-11-25T10:00:00.000Z",
  updatedAt: "2026-11-25T10:00:00.000Z",
  service: { id: "5", name: "Tắm & spa", durationMinutes: 60 },
  slot: {
    id: "12",
    slotDate: "2026-12-01",
    startTime: "09:00:00",
    endTime: "10:00:00",
  },
  pet: {
    id: "8",
    name: "Milo",
    breed: "Corgi",
    petType: { id: "1", name: "Dog" },
  },
  provider: { id: "3", businessName: "Paw Spa", address: "1 Nguyen Hue" },
  ...overrides,
});

function readyFacts(overrides: Partial<LiveBookingFacts> = {}): LiveBookingFacts {
  return {
    pet: petFixture(),
    provider: providerFixture,
    service: serviceFixture,
    slot: slotFixture(),
    ...overrides,
  };
}

function reviewedFlow(note = "  Nhẹ tay  ") {
  let flow = createInitialFlow("3", "5", "8");
  flow = selectFlowField(flow, "slotId", "12");
  flow = updateFlowNote(flow, note);
  return reviewFlow(flow, actorA, readyFacts(), NOW);
}

test("readLiveQuote enforces customer role, pet ownership, active slot capacity, and strict slot-service-provider match", () => {
  const baseDraft = reviewedFlow().draft;

  const nonCustomer = readLiveQuote(
    { ...actorA, role: "PROVIDER_OWNER" },
    baseDraft,
    readyFacts(),
  );
  assert.equal(nonCustomer.ok, false);
  if (!nonCustomer.ok) assert.equal(nonCustomer.error.code, "CUSTOMER_REQUIRED");

  const foreignPet = readLiveQuote(
    actorA,
    baseDraft,
    readyFacts({ pet: petFixture({ ownerId: "999" }) }),
  );
  assert.equal(foreignPet.ok, false);
  if (!foreignPet.ok) {
    assert.equal(foreignPet.error.code, "PET_UNAVAILABLE");
    assert.equal(foreignPet.error.shouldRefreshPets, true);
  }

  const inactivePet = readLiveQuote(
    actorA,
    baseDraft,
    readyFacts({ pet: petFixture({ status: "INACTIVE" }) }),
  );
  assert.equal(inactivePet.ok, false);
  if (!inactivePet.ok) assert.equal(inactivePet.error.code, "PET_UNAVAILABLE");

  // Slot belonging to a different service on the same provider MUST be rejected.
  const wrongServiceSlot = readLiveQuote(
    actorA,
    baseDraft,
    readyFacts({
      slot: slotFixture({
        service: { ...slotFixture().service, id: "99" },
      }),
    }),
  );
  assert.equal(wrongServiceSlot.ok, false);
  if (!wrongServiceSlot.ok) {
    assert.equal(wrongServiceSlot.error.code, "CONTEXT_MISMATCH");
    assert.equal(wrongServiceSlot.error.shouldRefreshAvailability, true);
  }

  // Slot belonging to a different provider MUST be rejected.
  const wrongProviderSlot = readLiveQuote(
    actorA,
    baseDraft,
    readyFacts({
      slot: slotFixture({
        provider: { ...serviceFixture.provider, id: "44" },
      }),
    }),
  );
  assert.equal(wrongProviderSlot.ok, false);
  if (!wrongProviderSlot.ok) {
    assert.equal(wrongProviderSlot.error.code, "CONTEXT_MISMATCH");
  }

  const fullSlot = readLiveQuote(
    actorA,
    baseDraft,
    readyFacts({ slot: slotFixture({ capacity: 2, bookedCount: 2 }) }),
  );
  assert.equal(fullSlot.ok, false);
  if (!fullSlot.ok) {
    assert.equal(fullSlot.error.code, "SLOT_FULL");
    assert.equal(fullSlot.error.shouldRefreshAvailability, true);
  }

  const shortSlot = readLiveQuote(
    actorA,
    baseDraft,
    readyFacts({ slot: slotFixture({ startTime: "09:00:00", endTime: "09:45:00" }) }),
  );
  assert.equal(shortSlot.ok, false);
  if (!shortSlot.ok) assert.equal(shortSlot.error.code, "SLOT_TOO_SHORT");

  // Uses slot's fresh service price/duration when slot has newer price than cached service card.
  const freshPricedSlot = slotFixture({
    service: { ...slotFixture().service, price: "175000.00", durationMinutes: 60 },
  });
  const ok = readLiveQuote(actorA, baseDraft, readyFacts({ slot: freshPricedSlot }));
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.value.price, "175000.00");
    assert.equal(ok.value.serviceDurationMinutes, 60);
    assert.equal(ok.value.slotId, "12");
  }
});

test("validateFreshSlotAgainstQuote catches price, duration, and time drift before POST /bookings", () => {
  const flow = reviewedFlow();
  const baseFacts = {
    pet: petFixture(),
    provider: providerFixture,
    service: serviceFixture,
  };

  const priceChanged = validateFreshSlotAgainstQuote(
    actorA,
    flow.draft,
    baseFacts,
    slotFixture({ service: { ...slotFixture().service, price: "220000.00" } }),
  );
  assert.equal(priceChanged.ok, false);
  if (!priceChanged.ok) {
    assert.equal(priceChanged.error.code, "QUOTE_CHANGED");
    assert.equal(priceChanged.error.shouldRefreshAvailability, true);
  }

  const durationChanged = validateFreshSlotAgainstQuote(
    actorA,
    flow.draft,
    baseFacts,
    slotFixture({
      endTime: "10:30:00",
      service: { ...slotFixture().service, durationMinutes: 90 },
    }),
  );
  assert.equal(durationChanged.ok, false);
  if (!durationChanged.ok) {
    assert.equal(durationChanged.error.code, "SLOT_CHANGED");
  }

  const durationOnlyChanged = validateFreshSlotAgainstQuote(
    actorA,
    flow.draft,
    baseFacts,
    slotFixture({ service: { ...slotFixture().service, durationMinutes: 45 } }),
  );
  assert.equal(durationOnlyChanged.ok, false);
  if (!durationOnlyChanged.ok) {
    assert.equal(durationOnlyChanged.error.code, "QUOTE_CHANGED");
  }

  const slotTimeChanged = validateFreshSlotAgainstQuote(
    actorA,
    flow.draft,
    baseFacts,
    slotFixture({ startTime: "10:00:00", endTime: "11:00:00" }),
  );
  assert.equal(slotTimeChanged.ok, false);
  if (!slotTimeChanged.ok) {
    assert.equal(slotTimeChanged.error.code, "SLOT_CHANGED");
    assert.equal(slotTimeChanged.error.shouldRefreshAvailability, true);
  }

  const unchanged = validateFreshSlotAgainstQuote(
    actorA,
    flow.draft,
    baseFacts,
    slotFixture(),
  );
  assert.equal(unchanged.ok, true);
});

test("double-submit guard blocks concurrent attempts, pre-submit failures never enter unknown, and 409 SLOT_FULL unlocks with new key", () => {
  const flow = reviewedFlow();
  const begun = beginLiveSubmission(flow, actorA, readyFacts(), KEY_1, NOW);
  assert.equal(begun.ok, true);
  if (!begun.ok) return;
  assert.equal(begun.flow.submission.phase, "verifying");
  assert.equal(begun.attempt.idempotencyKey, KEY_1);
  assert.deepEqual(begun.attempt.input, {
    petId: "8",
    slotId: "12",
    customerNote: "Nhẹ tay",
  });

  // Rapid second click while verifying is synchronously blocked.
  const doubleClick = beginLiveSubmission(
    begun.flow,
    actorA,
    readyFacts(),
    KEY_2,
    NOW,
  );
  assert.equal(doubleClick.ok, false);
  if (!doubleClick.ok) assert.equal(doubleClick.reason, "BLOCKED");

  // Network error during pre-submit slot verification MUST settle as definite failure, not unknown.
  const verifyNetErr = fromApiErrorInfo(
    classifyBookingError(new ApiError("network"), "get-public-slot"),
  );
  const afterVerifyFail = failPreSubmitVerification(
    begun.flow,
    KEY_1,
    actorIdentityKey(actorA),
    verifyNetErr,
    NOW + 100,
  );
  assert.equal(afterVerifyFail.submission.phase, "failed");
  if (afterVerifyFail.submission.phase === "failed") {
    assert.equal(afterVerifyFail.submission.attempt, null);
    assert.equal(afterVerifyFail.submission.error.outcome, "definite-failure");
  }

  // Promote to pending POST /bookings and test 409 SLOT_FULL (VT-02/VT-09).
  const begun2 = beginLiveSubmission(
    afterVerifyFail,
    actorA,
    readyFacts(),
    KEY_1,
    NOW + 200,
  );
  assert.equal(begun2.ok, true);
  if (!begun2.ok) return;
  const promoted = promoteToPendingCreate(
    begun2.flow,
    KEY_1,
    actorIdentityKey(actorA),
  );
  assert.equal(promoted.ok, true);
  if (!promoted.ok) return;
  assert.equal(promoted.flow.submission.phase, "pending");

  // Rapid click while POST /bookings is pending is blocked.
  const duringPending = beginLiveSubmission(
    promoted.flow,
    actorA,
    readyFacts(),
    KEY_2,
    NOW + 250,
  );
  assert.equal(duringPending.ok, false);
  if (!duringPending.ok) assert.equal(duringPending.reason, "BLOCKED");

  const fullErr = fromApiErrorInfo(
    classifyBookingError(
      new ApiError("http", 409, "SLOT_FULL"),
      "create-booking",
    ),
  );
  const afterFull = settleLiveSubmission(
    promoted.flow,
    KEY_1,
    actorIdentityKey(actorA),
    { kind: "error", error: fullErr, failedAt: NOW + 300 },
  );
  assert.equal(afterFull.submission.phase, "failed");
  assert.equal(afterFull.draft.reviewedQuote, null);
  assert.equal(isSubmissionLocked(afterFull.submission), false);
  if (afterFull.submission.phase === "failed") {
    assert.equal(afterFull.submission.error.code, "SLOT_FULL");
    assert.equal(afterFull.submission.error.shouldRefreshAvailability, true);
    assert.equal(afterFull.submission.attempt, null);
  }

  // Selecting another slot and re-reviewing uses a fresh Idempotency-Key.
  const altSlot = slotFixture({ id: "13", startTime: "10:00:00", endTime: "11:00:00" });
  const altFacts = readyFacts({ slot: altSlot });
  const pickedAlt = reviewFlow(
    selectFlowField(afterFull, "slotId", "13"),
    actorA,
    altFacts,
    NOW + 400,
  );
  const begunAlt = beginLiveSubmission(
    pickedAlt,
    actorA,
    altFacts,
    KEY_2,
    NOW + 450,
  );
  assert.equal(begunAlt.ok, true);
  if (begunAlt.ok) {
    assert.equal(begunAlt.attempt.idempotencyKey, KEY_2);
  }
});

test("unknown and in-progress outcomes lock draft and retry with exact same Idempotency-Key until replayed receipt", () => {
  const flow = reviewedFlow();
  const begun = beginLiveSubmission(flow, actorA, readyFacts(), KEY_1, NOW);
  assert.equal(begun.ok, true);
  if (!begun.ok) return;
  const promoted = promoteToPendingCreate(
    begun.flow,
    KEY_1,
    actorIdentityKey(actorA),
  );
  assert.equal(promoted.ok, true);
  if (!promoted.ok) return;

  // Timeout / network failure on POST /bookings -> unknown (locked!).
  const netErr = fromApiErrorInfo(
    classifyBookingError(new ApiError("network"), "create-booking"),
  );
  const unknown = settleLiveSubmission(
    promoted.flow,
    KEY_1,
    actorIdentityKey(actorA),
    { kind: "error", error: netErr, failedAt: NOW + 1000 },
  );
  assert.equal(unknown.submission.phase, "unknown");
  assert.equal(isSubmissionLocked(unknown.submission), true);

  // Draft edits, service changes, reset, and fresh beginLiveSubmission are all blocked/ignored.
  assert.equal(syncFlowService(unknown, "99"), unknown);
  assert.equal(selectFlowField(unknown, "slotId", "13"), unknown);
  assert.equal(updateFlowNote(unknown, "Changed"), unknown);
  assert.equal(resetFlowForNewBooking(unknown, "5", "8"), unknown);
  assert.equal(
    beginLiveSubmission(unknown, actorA, readyFacts(), KEY_2, NOW + 1100).ok,
    false,
  );

  // Wrong identity cannot retry another session's attempt.
  const wrongIdentityRetry = beginSameKeyRetry(
    unknown,
    { ...actorA, generation: GEN_2 },
    NOW + 1200,
  );
  assert.equal(wrongIdentityRetry.ok, false);
  if (!wrongIdentityRetry.ok) {
    assert.equal(wrongIdentityRetry.reason, "IDENTITY_MISMATCH");
  }

  // Same identity retries directly into pending with the EXACT same Idempotency-Key.
  const retry1 = beginSameKeyRetry(unknown, actorA, NOW + 1200);
  assert.equal(retry1.ok, true);
  if (!retry1.ok) return;
  assert.equal(retry1.flow.submission.phase, "pending");
  assert.equal(retry1.attempt.idempotencyKey, KEY_1);
  if (retry1.flow.submission.phase === "pending") {
    assert.equal(retry1.flow.submission.isRetry, true);
  }

  // Server replies 409 IDEMPOTENCY_IN_PROGRESS -> stays locked with same key.
  const inProgressErr = fromApiErrorInfo(
    classifyBookingError(
      new ApiError("http", 409, "IDEMPOTENCY_IN_PROGRESS"),
      "create-booking",
    ),
  );
  const inProgress = settleLiveSubmission(
    retry1.flow,
    KEY_1,
    actorIdentityKey(actorA),
    { kind: "error", error: inProgressErr, failedAt: NOW + 1500 },
  );
  assert.equal(inProgress.submission.phase, "in-progress");
  assert.equal(isSubmissionLocked(inProgress.submission), true);

  // Second retry returns replayed 201 receipt -> succeeded with same booking ID.
  const retry2 = beginSameKeyRetry(inProgress, actorA, NOW + 2000);
  assert.equal(retry2.ok, true);
  if (!retry2.ok) return;
  assert.equal(retry2.attempt.idempotencyKey, KEY_1);

  const succeeded = settleLiveSubmission(
    retry2.flow,
    KEY_1,
    actorIdentityKey(actorA),
    {
      kind: "success",
      result: { booking: bookingFixture(), idempotentReplayed: true },
    },
  );
  assert.equal(succeeded.submission.phase, "succeeded");
  if (succeeded.submission.phase === "succeeded") {
    assert.equal(succeeded.submission.idempotentReplayed, true);
    assert.equal(succeeded.submission.booking.id, "9007199254740993");
  }

  // Late error with old key or wrong identity cannot undo a confirmed receipt.
  const lateIgnored = settleLiveSubmission(
    succeeded,
    KEY_1,
    actorIdentityKey(actorA),
    { kind: "error", error: netErr, failedAt: NOW + 3000 },
  );
  assert.equal(lateIgnored, succeeded);

  // Explicit reset after succeeded starts a fresh booking flow.
  const nextFlow = resetFlowForNewBooking(succeeded, "5", "8");
  assert.equal(nextFlow.submission.phase, "editing");
  assert.equal(nextFlow.draft.slotId, null);
  assert.equal(nextFlow.draft.reviewedQuote, null);
  assert.equal(nextFlow.draft.petId, "8");
});

test("rate-limit cooldown blocks early retry, reuses Idempotency-Key for identical draft after cooldown, and mints new key after edit", () => {
  const flow = reviewedFlow();
  const begun = beginLiveSubmission(flow, actorA, readyFacts(), KEY_1, NOW);
  assert.equal(begun.ok, true);
  if (!begun.ok) return;
  const promoted = promoteToPendingCreate(
    begun.flow,
    KEY_1,
    actorIdentityKey(actorA),
  );
  assert.equal(promoted.ok, true);
  if (!promoted.ok) return;

  const rateLimited = fromApiErrorInfo(
    classifyBookingError(
      new ApiError("http", 429, "RATE_LIMITED", null, 30),
      "create-booking",
    ),
  );
  const failed = settleLiveSubmission(
    promoted.flow,
    KEY_1,
    actorIdentityKey(actorA),
    { kind: "error", error: rateLimited, failedAt: NOW },
  );
  assert.equal(failed.submission.phase, "failed");
  assert.equal(retryCooldownRemainingMs(failed.submission, NOW + 10_000), 20_000);
  assert.equal(retryCooldownRemainingMs(failed.submission, NOW + 30_000), 0);

  // Blocked before cooldown ends.
  const early = beginLiveSubmission(
    failed,
    actorA,
    readyFacts(),
    KEY_2,
    NOW + 10_000,
  );
  assert.equal(early.ok, false);
  if (!early.ok) assert.equal(early.reason, "COOLDOWN");

  // Reuses KEY_1 after cooldown when draft is unchanged.
  const afterCooldown = beginLiveSubmission(
    failed,
    actorA,
    readyFacts(),
    KEY_2,
    NOW + 30_001,
  );
  assert.equal(afterCooldown.ok, true);
  if (afterCooldown.ok) {
    assert.equal(afterCooldown.attempt.idempotencyKey, KEY_1);
  }

  // Editing customerNote resets failed attempt so next submit mints KEY_2.
  const edited = updateFlowNote(failed, "Ghi chú mới");
  assert.equal(edited.submission.phase, "editing");
  const afterEdit = beginLiveSubmission(
    edited,
    actorA,
    readyFacts(),
    KEY_2,
    NOW + 30_001,
  );
  assert.equal(afterEdit.ok, true);
  if (afterEdit.ok) {
    assert.equal(afterEdit.attempt.idempotencyKey, KEY_2);
  }
});

test("session boundary and receipt dialog guard close modal on error, 401/logout, role mismatch, and identity switch", () => {
  const authedA: LiveSessionSnapshot = {
    status: "authenticated",
    session: { generation: GEN_1, user: { id: "20", role: "CUSTOMER" } },
  };
  const errorA: LiveSessionSnapshot = {
    status: "error",
    session: { generation: GEN_1, user: { id: "20", role: "CUSTOMER" } },
  };
  const anonymous: LiveSessionSnapshot = {
    status: "anonymous",
    session: null,
  };
  const logoutError: LiveSessionSnapshot = {
    status: "error",
    session: null,
  };
  const authedB: LiveSessionSnapshot = {
    status: "authenticated",
    session: { generation: GEN_2, user: { id: "21", role: "CUSTOMER" } },
  };
  const authedARelogin: LiveSessionSnapshot = {
    status: "authenticated",
    session: { generation: GEN_2, user: { id: "20", role: "CUSTOMER" } },
  };
  const providerUser: LiveSessionSnapshot = {
    status: "authenticated",
    session: { generation: GEN_2, user: { id: "20", role: "PROVIDER_OWNER" } },
  };
  const pendingCleared: LiveSessionSnapshot = {
    status: "pending",
    session: null,
  };

  assert.equal(activeCustomerActor(authedA)?.id, "20");
  assert.equal(activeCustomerActor(errorA), null);
  assert.equal(activeCustomerActor(providerUser), null);
  const idA = sessionIdentityKey(authedA);
  assert.equal(idA, `${GEN_1}:20:CUSTOMER`);

  // Create succeeded submission belonging to Customer A.
  const begun = beginLiveSubmission(reviewedFlow(), actorA, readyFacts(), KEY_1, NOW);
  assert.equal(begun.ok, true);
  if (!begun.ok) return;
  const promoted = promoteToPendingCreate(begun.flow, KEY_1, idA!);
  assert.equal(promoted.ok, true);
  if (!promoted.ok) return;
  const succeeded = settleLiveSubmission(promoted.flow, KEY_1, idA!, {
    kind: "success",
    result: { booking: bookingFixture(), idempotentReplayed: false },
  });
  const receiptId = "9007199254740993";

  // Open while authenticated as Customer A.
  assert.equal(
    shouldShowReceiptDialog({
      session: authedA,
      submission: succeeded.submission,
      openReceiptId: receiptId,
    }),
    true,
  );
  // Closed when dismissed.
  assert.equal(
    shouldShowReceiptDialog({
      session: authedA,
      submission: succeeded.submission,
      openReceiptId: null,
    }),
    false,
  );
  // MUST close on network revalidation error, 401/logout, pending, role change, or identity switch.
  for (const snap of [
    errorA,
    anonymous,
    logoutError,
    authedB,
    authedARelogin,
    providerUser,
    pendingCleared,
  ]) {
    assert.equal(
      shouldShowReceiptDialog({
        session: snap,
        submission: succeeded.submission,
        openReceiptId: receiptId,
      }),
      false,
    );
  }

  // Network revalidation error preserves same-identity draft while closing dialog.
  assert.deepEqual(sessionBoundaryAction(idA, errorA), {
    mode: "session-error",
    identity: idA,
    resetPrivateState: false,
    closeDialog: true,
  });

  // 401 / logout / pending-logout error / identity switch / non-customer all reset private state & close dialog.
  assert.deepEqual(sessionBoundaryAction(idA, anonymous), {
    mode: "guest",
    identity: null,
    resetPrivateState: true,
    closeDialog: true,
  });
  assert.deepEqual(sessionBoundaryAction(idA, logoutError), {
    mode: "session-error",
    identity: null,
    resetPrivateState: true,
    closeDialog: true,
  });
  assert.deepEqual(sessionBoundaryAction(idA, authedB), {
    mode: "customer",
    identity: `${GEN_2}:21:CUSTOMER`,
    resetPrivateState: true,
    closeDialog: true,
  });
  assert.deepEqual(sessionBoundaryAction(idA, authedARelogin), {
    mode: "customer",
    identity: `${GEN_2}:20:CUSTOMER`,
    resetPrivateState: true,
    closeDialog: true,
  });
  assert.deepEqual(sessionBoundaryAction(idA, providerUser), {
    mode: "non-customer",
    identity: null,
    resetPrivateState: true,
    closeDialog: true,
  });
  assert.deepEqual(sessionBoundaryAction(idA, pendingCleared), {
    mode: "session-pending",
    identity: null,
    resetPrivateState: true,
    closeDialog: true,
  });
});

test("availableDatesForSlots deduplicates, sorts chronologically, and retains selected slot date", () => {
  const s1 = slotFixture({ id: "1", slotDate: "2026-12-03" });
  const s2 = slotFixture({ id: "2", slotDate: "2026-12-01" });
  const s3 = slotFixture({ id: "3", slotDate: "2026-12-01", startTime: "11:00:00", endTime: "12:00:00" });
  const fullSelected = slotFixture({ id: "4", slotDate: "2026-12-02", capacity: 1, bookedCount: 1 });

  assert.deepEqual(availableDatesForSlots([s1, s2, s3], fullSelected), [
    "2026-12-01",
    "2026-12-02",
    "2026-12-03",
  ]);
});

test("vi.booking.live covers every LiveSubmissionErrorCode and formats all templates without raw HTML", () => {
  const live = vi.booking.live;
  for (const code of LIVE_SUBMISSION_ERROR_CODES) {
    const message = live.errors[code];
    assert.equal(typeof message, "string", `Missing locale for ${code}`);
    assert.ok(message.trim().length > 0, `Empty locale for ${code}`);
    assert.equal(/<[^>]+>/.test(message), false, `HTML found in ${code}`);
  }
  assert.equal(
    formatMessage(live.availabilityPageHint, { page: 2, totalPages: 4 }),
    "Đang xem trang khung giờ 2/4. Chuyển trang ở mục Lịch khả dụng phía trên để xem thêm.",
  );
  assert.equal(
    formatMessage(live.slotOption, { start: "09:00", end: "10:00", remaining: 2 }),
    "09:00–10:00 · còn 2 chỗ",
  );
  assert.equal(
    formatMessage(live.cooldownWait, { seconds: 15 }),
    "Vui lòng chờ 15 giây trước khi thử lại.",
  );
});
