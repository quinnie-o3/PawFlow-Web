import type {
  Actor, AttemptLookup, BookingDraft, BookingFacts, BookingState, ErrorCode,
  MockBooking, Mutation, Quote, Result,
} from "./model";

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = (code: ErrorCode): Result<never> => ({ ok: false, code });
const rejected = (state: BookingState, code: ErrorCode): Mutation =>
  ({ ok: false, state, code });
const optionalText = (value: string | null | undefined): string | null =>
  value?.trim() || null;

/** Decimal normalization without floating-point arithmetic or currency UI. */
function canonicalPrice(value: string | null): string | null {
  if (value === null || !/^\d+(\.\d{1,2})?$/.test(value)) return null;
  const [whole = "0", fraction = ""] = value.split(".");
  return whole.replace(/^0+(?=\d)/, "") + "." + fraction.padEnd(2, "0");
}

export function readCurrentQuote(
  actor: Actor, draft: BookingDraft, facts: BookingFacts, now: number,
): Result<Quote> {
  if (actor.role !== "CUSTOMER") return fail("CUSTOMER_REQUIRED");
  if (!Number.isFinite(now)) return fail("CLOCK_INVALID");
  if (!draft.petId || !draft.providerId || !draft.serviceId || !draft.slotId) {
    return fail("SELECTION_REQUIRED");
  }
  const { pet, provider, service, slot } = facts;
  if (!pet || pet.id !== draft.petId || pet.ownerId !== actor.id || !pet.active) {
    return fail("PET_UNAVAILABLE");
  }
  if (!provider || provider.id !== draft.providerId || !provider.approved) {
    return fail("PROVIDER_UNAVAILABLE");
  }
  if (!service || service.id !== draft.serviceId || !service.active || !service.categoryActive) {
    return fail("SERVICE_UNAVAILABLE");
  }
  if (!slot || slot.id !== draft.slotId) return fail("SLOT_UNAVAILABLE");
  if (service.providerId !== provider.id || slot.providerId !== provider.id ||
      slot.serviceId !== service.id) return fail("CONTEXT_MISMATCH");
  if (!Number.isFinite(slot.startAt) || !Number.isFinite(slot.endAt) ||
      slot.endAt <= slot.startAt) return fail("SLOT_TIME_UNKNOWN");
  if (now >= slot.startAt) return fail("SLOT_STARTED");
  if (slot.status !== "OPEN") return fail("SLOT_CLOSED");
  if (slot.capacity === null || slot.booked === null ||
      !Number.isInteger(slot.capacity) || slot.capacity <= 0 ||
      !Number.isInteger(slot.booked) || slot.booked < 0 || slot.booked > slot.capacity) {
    return fail("CAPACITY_UNKNOWN");
  }
  if (slot.booked === slot.capacity) return fail("SLOT_FULL");
  const price = canonicalPrice(service.price);
  if (price === null) return fail("PRICE_UNKNOWN");
  const duration = service.durationMinutes;
  if (duration === null || !Number.isInteger(duration) || duration <= 0) {
    return fail("DURATION_UNKNOWN");
  }
  if (slot.endAt - slot.startAt < duration * 60_000) return fail("SLOT_TOO_SHORT");
  return ok({
    petId: pet.id, providerId: provider.id, serviceId: service.id, slotId: slot.id,
    price, serviceDurationMinutes: duration,
    slotStartAt: slot.startAt, slotEndAt: slot.endAt,
  });
}

export function reviewDraft(
  actor: Actor, draft: BookingDraft, facts: BookingFacts, now: number,
): Result<BookingDraft> {
  const quote = readCurrentQuote(actor, draft, facts, now);
  return quote.ok ? ok({ ...draft, reviewedQuote: quote.value }) : quote;
}

export function revalidateSubmission(
  actor: Actor, draft: BookingDraft, facts: BookingFacts, now: number,
): Result<Quote> {
  const current = readCurrentQuote(actor, draft, facts, now);
  if (!current.ok) return current;
  const reviewed = draft.reviewedQuote;
  if (!reviewed || reviewed.petId !== current.value.petId ||
      reviewed.providerId !== current.value.providerId ||
      reviewed.serviceId !== current.value.serviceId ||
      reviewed.slotId !== current.value.slotId) return fail("REVIEW_REQUIRED");
  if (reviewed.slotStartAt !== current.value.slotStartAt ||
      reviewed.slotEndAt !== current.value.slotEndAt) return fail("SLOT_CHANGED");
  if (reviewed.price !== current.value.price ||
      reviewed.serviceDurationMinutes !== current.value.serviceDurationMinutes) {
    return fail("QUOTE_CHANGED");
  }
  return current;
}

/** Change selection without retaining a quote/slot from the old context. */
export function changeSelection(
  draft: BookingDraft,
  field: "petId" | "providerId" | "serviceId" | "slotId",
  id: string | null,
): BookingDraft {
  if (draft[field] === id) return draft;
  const next = { ...draft, [field]: id, reviewedQuote: null };
  if (field === "providerId") return { ...next, serviceId: null, slotId: null };
  if (field === "serviceId") return { ...next, slotId: null };
  return next;
}

export function payloadFingerprint(draft: BookingDraft): string {
  return JSON.stringify([
    draft.petId, draft.providerId, draft.serviceId, draft.slotId,
    optionalText(draft.customerNote),
  ]);
}

export function getOwnBooking(
  state: BookingState, actor: Actor, bookingId: string,
): MockBooking | null {
  if (actor.role !== "CUSTOMER") return null;
  return state.bookings.find(b => b.id === bookingId && b.customerId === actor.id) ?? null;
}

export function listOwnBookings(state: BookingState, actor: Actor): readonly MockBooking[] {
  if (actor.role !== "CUSTOMER") return [];
  return state.bookings.filter(b => b.customerId === actor.id)
    .sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id));
}

/** This lookup alone cannot prove absence until the original operation settles. */
export function lookupAttempt(
  state: BookingState, customerId: string, attemptId: string, fingerprint: string,
): AttemptLookup {
  const receipt = state.attempts.find(a =>
    a.customerId === customerId && a.attemptId === attemptId);
  if (!receipt) return { kind: "absent" };
  if (receipt.fingerprint !== fingerprint) return { kind: "mismatch" };
  return { kind: "found", bookingId: receipt.bookingId };
}

/**
 * Pure mock transaction plan. The adapter must atomically publish its state AND
 * capacityChange to the shared catalog; do not create a second capacity store.
 * Replays return an ID only: success/list/detail read getOwnBooking from state.
 */
export function createBooking(
  state: BookingState, actor: Actor, draft: BookingDraft, facts: BookingFacts,
  now: number, attemptId: string, bookingId: string,
  fault: "none" | "before-create" = "none",
): Mutation {
  if (actor.role !== "CUSTOMER") return rejected(state, "CUSTOMER_REQUIRED");
  if (!attemptId.trim()) return rejected(state, "INVALID_ATTEMPT");
  const fingerprint = payloadFingerprint(draft);
  const receipt = lookupAttempt(state, actor.id, attemptId, fingerprint);
  if (receipt.kind === "mismatch") return rejected(state, "ATTEMPT_MISMATCH");
  if (receipt.kind === "found") {
    return { ok: true, state, bookingId: receipt.bookingId, capacityChange: null, replayed: true };
  }
  if (fault === "before-create") return rejected(state, "NETWORK_BEFORE_CREATE");
  const quote = revalidateSubmission(actor, draft, facts, now);
  if (!quote.ok) return rejected(state, quote.code);
  if (!bookingId.trim() || state.bookings.some(b => b.id === bookingId)) {
    return rejected(state, "ID_CONFLICT");
  }
  const q = quote.value;
  const booking: MockBooking = {
    id: bookingId, customerId: actor.id,
    petId: q.petId, providerId: q.providerId, serviceId: q.serviceId, slotId: q.slotId,
    bookedPrice: q.price, customerNote: optionalText(draft.customerNote),
    appointmentStartAt: q.slotStartAt, appointmentEndAt: q.slotEndAt,
    createdAt: now, status: "PENDING_CONFIRMATION",
    statusLogs: [{
      oldStatus: null, newStatus: "PENDING_CONFIRMATION",
      changedBy: actor.id, changedAt: now, reason: null,
    }],
  };
  return {
    ok: true, bookingId, replayed: false,
    capacityChange: { slotId: booking.slotId, delta: 1 },
    state: {
      ...state, bookings: [...state.bookings, booking],
      attempts: [...state.attempts, { customerId: actor.id, attemptId, fingerprint, bookingId }],
    },
  };
}

export function actionEligibility(
  state: BookingState, actor: Actor, bookingId: string, now: number,
): Readonly<{ cancel: ErrorCode | null; review: ErrorCode | null; complaint: ErrorCode | null }> {
  const booking = getOwnBooking(state, actor, bookingId);
  if (!booking) {
    const code = actor.role === "CUSTOMER" ? "BOOKING_NOT_FOUND" : "CUSTOMER_REQUIRED";
    return { cancel: code, review: code, complaint: code };
  }
  const cancelStatus = booking.status === "PENDING_CONFIRMATION" || booking.status === "CONFIRMED";
  const canComplain = booking.status !== "PENDING_CONFIRMATION";
  return {
    // UI/mock rule approved 07/11. BE dev does NOT enforce this time cutoff.
    cancel: !cancelStatus ? "CANCEL_STATUS" :
      !Number.isFinite(now) || !Number.isFinite(booking.appointmentStartAt) ? "CLOCK_INVALID" :
      now >= booking.appointmentStartAt ? "CANCEL_TIME" : null,
    review: booking.status !== "COMPLETED" ? "REVIEW_STATUS" :
      state.reviews.some(r => r.bookingId === booking.id) ? "ALREADY_REVIEWED" : null,
    complaint: !canComplain ? "COMPLAINT_STATUS" :
      state.complaints.some(c => c.bookingId === booking.id &&
        (c.status === "OPEN" || c.status === "IN_REVIEW")) ? "ACTIVE_COMPLAINT" : null,
  };
}

export function cancelBooking(
  state: BookingState, actor: Actor, bookingId: string, now: number,
  reservedCount: number | null, reason?: string | null,
): Mutation {
  const error = actionEligibility(state, actor, bookingId, now).cancel;
  if (error) return rejected(state, error);
  const booking = getOwnBooking(state, actor, bookingId);
  if (!booking) return rejected(state, "BOOKING_NOT_FOUND");
  if (reservedCount === null || !Number.isInteger(reservedCount) || reservedCount < 0) {
    return rejected(state, "CAPACITY_UNKNOWN");
  }
  if (reservedCount === 0) return rejected(state, "NO_RESERVED_CAPACITY");
  const updated: MockBooking = {
    ...booking, status: "CANCELLED",
    statusLogs: [...booking.statusLogs, {
      oldStatus: booking.status, newStatus: "CANCELLED",
      changedBy: actor.id, changedAt: now, reason: optionalText(reason),
    }],
  };
  return {
    ok: true, bookingId, replayed: false,
    capacityChange: { slotId: booking.slotId, delta: -1 },
    state: { ...state, bookings: state.bookings.map(b => b.id === bookingId ? updated : b) },
  };
}

export function addReview(
  state: BookingState, actor: Actor, bookingId: string, now: number,
  rating: number, comment?: string | null,
): Mutation {
  const error = actionEligibility(state, actor, bookingId, now).review;
  if (error) return rejected(state, error);
  if (!Number.isFinite(now)) return rejected(state, "CLOCK_INVALID");
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return rejected(state, "RATING_INVALID");
  return {
    ok: true, bookingId, capacityChange: null, replayed: false,
    state: { ...state, reviews: [...state.reviews, {
      bookingId, customerId: actor.id, rating, comment: optionalText(comment), createdAt: now,
    }] },
  };
}

export function addComplaint(
  state: BookingState, actor: Actor, bookingId: string, now: number,
  complaintId: string, reason: string,
): Mutation {
  const error = actionEligibility(state, actor, bookingId, now).complaint;
  if (error) return rejected(state, error);
  if (!Number.isFinite(now)) return rejected(state, "CLOCK_INVALID");
  const trimmed = reason.trim();
  const length = Array.from(trimmed).length;
  if (length < 1 || length > 2000) return rejected(state, "REASON_INVALID");
  if (!complaintId.trim() || state.complaints.some(c => c.id === complaintId)) {
    return rejected(state, "ID_CONFLICT");
  }
  return {
    ok: true, bookingId, capacityChange: null, replayed: false,
    state: { ...state, complaints: [...state.complaints, {
      id: complaintId, bookingId, customerId: actor.id,
      reason: trimmed, status: "OPEN", createdAt: now,
    }] },
  };
}
