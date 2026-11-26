import type { BackendRole } from "../../lib/api/identity";
import type { CustomerPet } from "../customer-pets/types";
import type { Provider, Service } from "../public-catalog/api";
import type { LiveCancelState } from "./liveCancel";
import {
  bookingRequestFingerprint,
  isValidIdempotencyKey,
  normalizeBookingNote,
  type CreateBookingInput,
  type CreateBookingResult,
  type LiveAvailabilitySlot,
  type LiveBookingErrorCategory,
  type LiveBookingErrorCode,
  type LiveBookingErrorInfo,
  type LiveBookingOutcome,
  type LiveCustomerBooking,
} from "./liveApi";

export type LiveSessionStatus =
  | "pending"
  | "anonymous"
  | "authenticated"
  | "error";

export type LiveSessionSnapshot = Readonly<{
  status: LiveSessionStatus;
  session: Readonly<{
    generation: string;
    user: Readonly<{ id: string; role: BackendRole }> | null;
  }> | null;
}>;

export type LiveBookingActor = Readonly<{
  id: string;
  role: BackendRole;
  generation: string;
}>;

export type SessionBoundaryMode =
  | "customer"
  | "guest"
  | "non-customer"
  | "session-pending"
  | "session-error";

export type SessionBoundaryDecision = Readonly<{
  mode: SessionBoundaryMode;
  identity: string | null;
  resetPrivateState: boolean;
  closeDialog: boolean;
}>;

export type LiveBookingValidationCode =
  | "CUSTOMER_REQUIRED"
  | "SELECTION_REQUIRED"
  | "PET_UNAVAILABLE"
  | "PROVIDER_UNAVAILABLE"
  | "SERVICE_UNAVAILABLE"
  | "SLOT_UNAVAILABLE"
  | "CONTEXT_MISMATCH"
  | "SLOT_FULL"
  | "SLOT_TOO_SHORT"
  | "REVIEW_REQUIRED"
  | "QUOTE_CHANGED"
  | "SLOT_CHANGED";

export type LiveSubmissionErrorCode =
  | LiveBookingValidationCode
  | LiveBookingErrorCode;

export const LIVE_SUBMISSION_ERROR_CODES: readonly LiveSubmissionErrorCode[] = [
  "CUSTOMER_REQUIRED",
  "SELECTION_REQUIRED",
  "PET_UNAVAILABLE",
  "PROVIDER_UNAVAILABLE",
  "SERVICE_UNAVAILABLE",
  "SLOT_UNAVAILABLE",
  "CONTEXT_MISMATCH",
  "SLOT_STARTED",
  "SLOT_FULL",
  "SLOT_CLOSED",
  "SLOT_OUTSIDE_WORKING_HOURS",
  "SLOT_TOO_SHORT",
  "REVIEW_REQUIRED",
  "QUOTE_CHANGED",
  "SLOT_CHANGED",
  "INVALID_INPUT",
  "INVALID_IDEMPOTENCY_KEY",
  "INVALID_REQUEST",
  "SESSION_ENDED",
  "SESSION_BUSY",
  "CSRF_REJECTED",
  "IDEMPOTENCY_IN_PROGRESS",
  "IDEMPOTENCY_CONFLICT",
  "BOOKING_NOT_FOUND",
  "RESOURCE_NOT_FOUND",
  "CANCEL_STATUS",
  "CANCEL_TIME",
  "NO_RESERVED_CAPACITY",
  "BOOKING_CONFLICT",
  "RATE_LIMITED",
  "RATE_LIMIT_UNAVAILABLE",
  "NETWORK_ERROR",
  "SERVER_ERROR",
  "INVALID_RESPONSE",
  "CONFIG_ERROR",
  "UNKNOWN_ERROR",
] as const;

export type LiveSubmissionError = Readonly<{
  code: LiveSubmissionErrorCode;
  category: LiveBookingErrorCategory;
  outcome: LiveBookingOutcome;
  status: number | null;
  retryAfterSeconds: number | null;
  canRetryWithSameKey: boolean;
  shouldRefreshAvailability: boolean;
  shouldRefreshBookings: boolean;
  shouldRefreshPets: boolean;
}>;

export type LiveReviewedQuote = Readonly<{
  petId: string;
  providerId: string;
  serviceId: string;
  slotId: string;
  price: string;
  /** Review-time current service duration; not a booked-duration snapshot. */
  serviceDurationMinutes: number;
  slotDate: string;
  startTime: string;
  endTime: string;
}>;

export type LiveBookingDraft = Readonly<{
  providerId: string;
  serviceId: string | null;
  petId: string | null;
  slotId: string | null;
  customerNote: string;
  reviewedQuote: LiveReviewedQuote | null;
}>;

export type LiveBookingFacts = Readonly<{
  pet: CustomerPet | null;
  provider: Provider | null;
  service: Service | null;
  slot: LiveAvailabilitySlot | null;
}>;

export type LiveSubmissionAttempt = Readonly<{
  idempotencyKey: string;
  identity: string;
  customerId: string;
  fingerprint: string;
  input: CreateBookingInput;
  providerId: string;
  serviceId: string;
  serviceName: string;
  quote: LiveReviewedQuote;
}>;

export type LiveSubmissionState =
  | Readonly<{ phase: "editing" }>
  | Readonly<{ phase: "verifying"; attempt: LiveSubmissionAttempt }>
  | Readonly<{
      phase: "pending";
      attempt: LiveSubmissionAttempt;
      isRetry: boolean;
    }>
  | Readonly<{
      phase: "unknown" | "in-progress";
      attempt: LiveSubmissionAttempt;
      error: LiveSubmissionError;
      failedAt: number;
    }>
  | Readonly<{
      phase: "failed";
      attempt: LiveSubmissionAttempt | null;
      error: LiveSubmissionError;
      failedAt: number;
    }>
  | Readonly<{
      phase: "succeeded";
      attempt: LiveSubmissionAttempt;
      booking: LiveCustomerBooking;
      idempotentReplayed: boolean;
    }>;

export type LiveBookingFlow = Readonly<{
  draft: LiveBookingDraft;
  submission: LiveSubmissionState;
}>;

export type LiveResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; error: LiveSubmissionError }>;

export type BeginSubmissionResult =
  | Readonly<{
      ok: true;
      flow: LiveBookingFlow;
      attempt: LiveSubmissionAttempt;
    }>
  | Readonly<{
      ok: false;
      flow: LiveBookingFlow;
      reason: "BLOCKED" | "COOLDOWN" | "VALIDATION";
    }>;

export type BeginRetryResult =
  | Readonly<{
      ok: true;
      flow: LiveBookingFlow;
      attempt: LiveSubmissionAttempt;
    }>
  | Readonly<{
      ok: false;
      flow: LiveBookingFlow;
      reason: "BLOCKED" | "COOLDOWN" | "IDENTITY_MISMATCH";
    }>;

const QUOTE_INVALIDATING_CODES = new Set<LiveSubmissionErrorCode>([
  "QUOTE_CHANGED",
  "SLOT_CHANGED",
  "SLOT_FULL",
  "SLOT_CLOSED",
  "SLOT_STARTED",
  "SLOT_UNAVAILABLE",
  "SLOT_OUTSIDE_WORKING_HOURS",
  "SLOT_TOO_SHORT",
  "SERVICE_UNAVAILABLE",
  "PROVIDER_UNAVAILABLE",
  "CONTEXT_MISMATCH",
  "PET_UNAVAILABLE",
  "REVIEW_REQUIRED",
  "RESOURCE_NOT_FOUND",
  "BOOKING_CONFLICT",
]);

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/;

export function actorIdentityKey(actor: LiveBookingActor): string {
  return `${actor.generation}:${actor.id}:${actor.role}`;
}

export function sessionIdentityKey(
  snapshot: LiveSessionSnapshot,
): string | null {
  const user = snapshot.session?.user;
  if (!user || !snapshot.session) return null;
  return `${snapshot.session.generation}:${user.id}:${user.role}`;
}

export function activeCustomerActor(
  snapshot: LiveSessionSnapshot,
): LiveBookingActor | null {
  if (
    snapshot.status !== "authenticated" ||
    !snapshot.session?.user ||
    snapshot.session.user.role !== "CUSTOMER"
  ) {
    return null;
  }
  return {
    id: snapshot.session.user.id,
    role: snapshot.session.user.role,
    generation: snapshot.session.generation,
  };
}

/**
 * Public routes do not sit under SessionProvider's hidden Activity boundary, so
 * LiveBookingPanel enforces privacy and dialog cleanup directly on every status change.
 */
export function sessionBoundaryAction(
  previousIdentity: string | null,
  snapshot: LiveSessionSnapshot,
): SessionBoundaryDecision {
  const nextIdentity = sessionIdentityKey(snapshot);
  const role = snapshot.session?.user?.role ?? null;

  if (snapshot.status === "authenticated") {
    if (role === "CUSTOMER" && nextIdentity !== null) {
      const switched =
        previousIdentity !== null && previousIdentity !== nextIdentity;
      return {
        mode: "customer",
        identity: nextIdentity,
        resetPrivateState: switched,
        closeDialog: switched,
      };
    }
    return {
      mode: "non-customer",
      identity: null,
      resetPrivateState: true,
      closeDialog: true,
    };
  }

  if (snapshot.status === "error") {
    if (role === "CUSTOMER" && nextIdentity !== null) {
      // Network revalidation failure preserves same-identity draft while hiding UI & closing dialog.
      const switched =
        previousIdentity !== null && previousIdentity !== nextIdentity;
      return {
        mode: "session-error",
        identity: nextIdentity,
        resetPrivateState: switched,
        closeDialog: true,
      };
    }
    return {
      mode: "session-error",
      identity: null,
      resetPrivateState: true,
      closeDialog: true,
    };
  }

  if (snapshot.status === "pending") {
    const cleared = previousIdentity !== null && nextIdentity === null;
    return {
      mode: "session-pending",
      identity: cleared ? null : previousIdentity,
      resetPrivateState: cleared,
      closeDialog: true,
    };
  }

  return {
    mode: "guest",
    identity: null,
    resetPrivateState: true,
    closeDialog: true,
  };
}

export function shouldShowReceiptDialog(params: {
  session: LiveSessionSnapshot;
  submission: LiveSubmissionState;
  openReceiptId: string | null;
}): boolean {
  const actor = activeCustomerActor(params.session);
  if (!actor) return false;
  if (params.submission.phase !== "succeeded") return false;
  if (actorIdentityKey(actor) !== params.submission.attempt.identity) {
    return false;
  }
  return params.openReceiptId === params.submission.booking.id;
}

export function validationError(
  code: LiveBookingValidationCode,
): LiveSubmissionError {
  const category: LiveBookingErrorCategory =
    code === "CUSTOMER_REQUIRED"
      ? "permission"
      : code === "PET_UNAVAILABLE" ||
          code === "PROVIDER_UNAVAILABLE" ||
          code === "SERVICE_UNAVAILABLE" ||
          code === "SLOT_UNAVAILABLE" ||
          code === "SLOT_FULL" ||
          code === "SLOT_TOO_SHORT"
        ? "availability"
        : code === "QUOTE_CHANGED" || code === "SLOT_CHANGED"
          ? "conflict"
          : "validation";

  const shouldRefreshAvailability =
    code === "PROVIDER_UNAVAILABLE" ||
    code === "SERVICE_UNAVAILABLE" ||
    code === "SLOT_UNAVAILABLE" ||
    code === "CONTEXT_MISMATCH" ||
    code === "SLOT_FULL" ||
    code === "SLOT_TOO_SHORT" ||
    code === "QUOTE_CHANGED" ||
    code === "SLOT_CHANGED";

  return {
    code,
    category,
    outcome: "definite-failure",
    status: null,
    retryAfterSeconds: null,
    canRetryWithSameKey: false,
    shouldRefreshAvailability,
    shouldRefreshBookings: false,
    shouldRefreshPets: code === "PET_UNAVAILABLE",
  };
}

export function fromApiErrorInfo(
  info: LiveBookingErrorInfo,
): LiveSubmissionError {
  return {
    code: info.code,
    category: info.category,
    outcome: info.outcome,
    status: info.status,
    retryAfterSeconds: info.retryAfterSeconds,
    canRetryWithSameKey: info.canRetryWithSameKey,
    shouldRefreshAvailability: info.shouldRefreshAvailability,
    shouldRefreshBookings: info.shouldRefreshBookings,
    shouldRefreshPets: info.code === "PET_UNAVAILABLE",
  };
}

export function shouldInvalidateReviewedQuote(
  code: LiveSubmissionErrorCode,
): boolean {
  return QUOTE_INVALIDATING_CODES.has(code);
}

export function isSubmissionLocked(state: LiveSubmissionState): boolean {
  return (
    state.phase === "verifying" ||
    state.phase === "pending" ||
    state.phase === "unknown" ||
    state.phase === "in-progress"
  );
}

export function isSubmissionInFlight(state: LiveSubmissionState): boolean {
  return state.phase === "verifying" || state.phase === "pending";
}

export function retryCooldownRemainingMs(
  state: LiveSubmissionState,
  now: number,
): number {
  if (
    state.phase !== "unknown" &&
    state.phase !== "in-progress" &&
    state.phase !== "failed"
  ) {
    return 0;
  }
  const seconds = state.error.retryAfterSeconds;
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.max(0, state.failedAt + seconds * 1000 - now);
}

function timeOfDaySeconds(value: string): number | null {
  const match = TIME_PATTERN.exec(value);
  if (!match) return null;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

export function createInitialDraft(
  providerId: string,
  serviceId: string | null,
  petId: string | null = null,
): LiveBookingDraft {
  return {
    providerId,
    serviceId,
    petId,
    slotId: null,
    customerNote: "",
    reviewedQuote: null,
  };
}

export function createInitialFlow(
  providerId: string,
  serviceId: string | null,
  petId: string | null = null,
): LiveBookingFlow {
  return {
    draft: createInitialDraft(providerId, serviceId, petId),
    submission: { phase: "editing" },
  };
}

export function changeDraftSelection(
  draft: LiveBookingDraft,
  field: "petId" | "serviceId" | "slotId",
  value: string | null,
): LiveBookingDraft {
  if (draft[field] === value) return draft;
  const next: LiveBookingDraft = {
    ...draft,
    [field]: value,
    reviewedQuote: null,
  };
  if (field === "serviceId") {
    return { ...next, slotId: null };
  }
  return next;
}

export function updateDraftNote(
  draft: LiveBookingDraft,
  customerNote: string,
): LiveBookingDraft {
  if (draft.customerNote === customerNote) return draft;
  return { ...draft, customerNote };
}

export function syncFlowService(
  flow: LiveBookingFlow,
  serviceId: string | null,
): LiveBookingFlow {
  if (isSubmissionLocked(flow.submission) || flow.submission.phase === "succeeded") {
    return flow;
  }
  if (flow.draft.serviceId === serviceId) return flow;
  return {
    draft: changeDraftSelection(flow.draft, "serviceId", serviceId),
    submission: { phase: "editing" },
  };
}

export function selectFlowField(
  flow: LiveBookingFlow,
  field: "petId" | "slotId",
  value: string | null,
): LiveBookingFlow {
  if (isSubmissionLocked(flow.submission) || flow.submission.phase === "succeeded") {
    return flow;
  }
  if (flow.draft[field] === value) return flow;
  return {
    draft: changeDraftSelection(flow.draft, field, value),
    submission: { phase: "editing" },
  };
}

export function updateFlowNote(
  flow: LiveBookingFlow,
  customerNote: string,
): LiveBookingFlow {
  if (isSubmissionLocked(flow.submission) || flow.submission.phase === "succeeded") {
    return flow;
  }
  if (flow.draft.customerNote === customerNote) return flow;
  return {
    draft: updateDraftNote(flow.draft, customerNote),
    submission: { phase: "editing" },
  };
}

export function readLiveQuote(
  actor: LiveBookingActor | null,
  draft: LiveBookingDraft,
  facts: LiveBookingFacts,
): LiveResult<LiveReviewedQuote> {
  if (!actor || actor.role !== "CUSTOMER") {
    return { ok: false, error: validationError("CUSTOMER_REQUIRED") };
  }
  if (!draft.petId || !draft.providerId || !draft.serviceId || !draft.slotId) {
    return { ok: false, error: validationError("SELECTION_REQUIRED") };
  }
  const { pet, provider, service, slot } = facts;
  if (
    !pet ||
    pet.id !== draft.petId ||
    pet.ownerId !== actor.id ||
    pet.status !== "ACTIVE"
  ) {
    return { ok: false, error: validationError("PET_UNAVAILABLE") };
  }
  if (!provider || provider.id !== draft.providerId) {
    return { ok: false, error: validationError("PROVIDER_UNAVAILABLE") };
  }
  if (!service || service.id !== draft.serviceId) {
    return { ok: false, error: validationError("SERVICE_UNAVAILABLE") };
  }
  if (service.provider.id !== provider.id) {
    return { ok: false, error: validationError("CONTEXT_MISMATCH") };
  }
  if (!slot || slot.id !== draft.slotId) {
    return { ok: false, error: validationError("SLOT_UNAVAILABLE") };
  }
  if (slot.provider.id !== provider.id || slot.service.id !== service.id) {
    return { ok: false, error: validationError("CONTEXT_MISMATCH") };
  }
  if (slot.bookedCount >= slot.capacity) {
    return { ok: false, error: validationError("SLOT_FULL") };
  }
  const startSec = timeOfDaySeconds(slot.startTime);
  const endSec = timeOfDaySeconds(slot.endTime);
  if (
    startSec === null ||
    endSec === null ||
    endSec <= startSec ||
    endSec - startSec < slot.service.durationMinutes * 60
  ) {
    return { ok: false, error: validationError("SLOT_TOO_SHORT") };
  }

  return {
    ok: true,
    value: {
      petId: pet.id,
      providerId: provider.id,
      serviceId: service.id,
      slotId: slot.id,
      price: slot.service.price,
      serviceDurationMinutes: slot.service.durationMinutes,
      slotDate: slot.slotDate,
      startTime: slot.startTime,
      endTime: slot.endTime,
    },
  };
}

export function reviewLiveDraft(
  actor: LiveBookingActor | null,
  draft: LiveBookingDraft,
  facts: LiveBookingFacts,
): LiveResult<LiveBookingDraft> {
  const quote = readLiveQuote(actor, draft, facts);
  if (!quote.ok) return quote;
  return {
    ok: true,
    value: {
      ...draft,
      reviewedQuote: quote.value,
    },
  };
}

export function validateFreshSlotAgainstQuote(
  actor: LiveBookingActor | null,
  draft: LiveBookingDraft,
  facts: Omit<LiveBookingFacts, "slot">,
  freshSlot: LiveAvailabilitySlot,
): LiveResult<LiveReviewedQuote> {
  const current = readLiveQuote(actor, draft, { ...facts, slot: freshSlot });
  if (!current.ok) return current;
  const reviewed = draft.reviewedQuote;
  if (
    !reviewed ||
    reviewed.petId !== current.value.petId ||
    reviewed.providerId !== current.value.providerId ||
    reviewed.serviceId !== current.value.serviceId ||
    reviewed.slotId !== current.value.slotId
  ) {
    return { ok: false, error: validationError("REVIEW_REQUIRED") };
  }
  if (
    reviewed.slotDate !== current.value.slotDate ||
    reviewed.startTime !== current.value.startTime ||
    reviewed.endTime !== current.value.endTime
  ) {
    return { ok: false, error: validationError("SLOT_CHANGED") };
  }
  if (
    reviewed.price !== current.value.price ||
    reviewed.serviceDurationMinutes !== current.value.serviceDurationMinutes
  ) {
    return { ok: false, error: validationError("QUOTE_CHANGED") };
  }
  return current;
}

export function reviewFlow(
  flow: LiveBookingFlow,
  actor: LiveBookingActor | null,
  facts: LiveBookingFacts,
  now: number,
): LiveBookingFlow {
  if (isSubmissionLocked(flow.submission) || flow.submission.phase === "succeeded") {
    return flow;
  }
  const reviewed = reviewLiveDraft(actor, flow.draft, facts);
  if (reviewed.ok) {
    return {
      draft: reviewed.value,
      submission: { phase: "editing" },
    };
  }
  const nextDraft = shouldInvalidateReviewedQuote(reviewed.error.code)
    ? { ...flow.draft, reviewedQuote: null }
    : flow.draft;
  return {
    draft: nextDraft,
    submission: {
      phase: "failed",
      attempt: null,
      error: reviewed.error,
      failedAt: now,
    },
  };
}

/**
 * Caller must commit result.flow synchronously before awaiting any network call
 * so rapid double-clicks or Enter keystrokes cannot dispatch duplicate requests.
 */
export function beginLiveSubmission(
  flow: LiveBookingFlow,
  actor: LiveBookingActor | null,
  facts: LiveBookingFacts,
  newIdempotencyKey: string,
  now: number,
): BeginSubmissionResult {
  if (flow.submission.phase !== "editing" && flow.submission.phase !== "failed") {
    return { ok: false, flow, reason: "BLOCKED" };
  }
  if (
    flow.submission.phase === "failed" &&
    retryCooldownRemainingMs(flow.submission, now) > 0
  ) {
    return { ok: false, flow, reason: "COOLDOWN" };
  }

  const current = readLiveQuote(actor, flow.draft, facts);
  if (!current.ok) {
    const nextDraft = shouldInvalidateReviewedQuote(current.error.code)
      ? { ...flow.draft, reviewedQuote: null }
      : flow.draft;
    return {
      ok: false,
      reason: "VALIDATION",
      flow: {
        draft: nextDraft,
        submission: {
          phase: "failed",
          attempt: null,
          error: current.error,
          failedAt: now,
        },
      },
    };
  }

  const verified = validateFreshSlotAgainstQuote(
    actor,
    flow.draft,
    { pet: facts.pet, provider: facts.provider, service: facts.service },
    facts.slot!,
  );
  if (!verified.ok) {
    const nextDraft = shouldInvalidateReviewedQuote(verified.error.code)
      ? { ...flow.draft, reviewedQuote: null }
      : flow.draft;
    return {
      ok: false,
      reason: "VALIDATION",
      flow: {
        draft: nextDraft,
        submission: {
          phase: "failed",
          attempt: null,
          error: verified.error,
          failedAt: now,
        },
      },
    };
  }

  const normalizedNote = normalizeBookingNote(flow.draft.customerNote);
  const input: CreateBookingInput = {
    petId: verified.value.petId,
    slotId: verified.value.slotId,
    ...(normalizedNote !== null ? { customerNote: normalizedNote } : {}),
  };
  const fingerprint = bookingRequestFingerprint(input);
  const identity = actorIdentityKey(actor!);

  const reusableAttempt =
    flow.submission.phase === "failed" &&
    flow.submission.error.canRetryWithSameKey &&
    flow.submission.attempt !== null &&
    flow.submission.attempt.identity === identity &&
    flow.submission.attempt.fingerprint === fingerprint
      ? flow.submission.attempt
      : null;

  const idempotencyKey = reusableAttempt?.idempotencyKey ?? newIdempotencyKey;
  if (!isValidIdempotencyKey(idempotencyKey)) {
    return {
      ok: false,
      reason: "VALIDATION",
      flow: {
        draft: flow.draft,
        submission: {
          phase: "failed",
          attempt: null,
          error: {
            code: "INVALID_IDEMPOTENCY_KEY",
            category: "validation",
            outcome: "definite-failure",
            status: null,
            retryAfterSeconds: null,
            canRetryWithSameKey: false,
            shouldRefreshAvailability: false,
            shouldRefreshBookings: false,
            shouldRefreshPets: false,
          },
          failedAt: now,
        },
      },
    };
  }

  const attempt: LiveSubmissionAttempt = {
    idempotencyKey,
    identity,
    customerId: actor!.id,
    fingerprint,
    input,
    providerId: verified.value.providerId,
    serviceId: verified.value.serviceId,
    serviceName: facts.service!.name,
    quote: verified.value,
  };

  return {
    ok: true,
    attempt,
    flow: {
      draft: flow.draft,
      submission: { phase: "verifying", attempt },
    },
  };
}

/**
 * Pre-submit availability check failed BEFORE POST /bookings was sent, so no
 * booking was created and the flow settles to a definite failure, never "unknown".
 */
export function failPreSubmitVerification(
  flow: LiveBookingFlow,
  idempotencyKey: string,
  identity: string,
  error: LiveSubmissionError,
  now: number,
): LiveBookingFlow {
  if (
    flow.submission.phase !== "verifying" ||
    flow.submission.attempt.idempotencyKey !== idempotencyKey ||
    flow.submission.attempt.identity !== identity
  ) {
    return flow;
  }
  const definiteError: LiveSubmissionError = {
    ...error,
    outcome: "definite-failure",
    canRetryWithSameKey: false,
  };
  const nextDraft = shouldInvalidateReviewedQuote(definiteError.code)
    ? { ...flow.draft, reviewedQuote: null }
    : flow.draft;
  return {
    draft: nextDraft,
    submission: {
      phase: "failed",
      attempt: null,
      error: definiteError,
      failedAt: now,
    },
  };
}

export function promoteToPendingCreate(
  flow: LiveBookingFlow,
  idempotencyKey: string,
  identity: string,
):
  | Readonly<{
      ok: true;
      flow: LiveBookingFlow;
      attempt: LiveSubmissionAttempt;
    }>
  | Readonly<{ ok: false; flow: LiveBookingFlow }> {
  if (
    flow.submission.phase !== "verifying" ||
    flow.submission.attempt.idempotencyKey !== idempotencyKey ||
    flow.submission.attempt.identity !== identity
  ) {
    return { ok: false, flow };
  }
  const attempt = flow.submission.attempt;
  return {
    ok: true,
    attempt,
    flow: {
      draft: flow.draft,
      submission: { phase: "pending", attempt, isRetry: false },
    },
  };
}

/**
 * Retries an uncertain or in-progress POST /bookings directly with the exact same
 * Idempotency-Key and locked payload, bypassing public slot pre-checks because a
 * previously committed booking may have consumed the slot's last seat.
 */
export function beginSameKeyRetry(
  flow: LiveBookingFlow,
  actor: LiveBookingActor | null,
  now: number,
): BeginRetryResult {
  if (
    flow.submission.phase !== "unknown" &&
    flow.submission.phase !== "in-progress"
  ) {
    return { ok: false, flow, reason: "BLOCKED" };
  }
  if (
    !actor ||
    actor.role !== "CUSTOMER" ||
    actorIdentityKey(actor) !== flow.submission.attempt.identity
  ) {
    return { ok: false, flow, reason: "IDENTITY_MISMATCH" };
  }
  if (retryCooldownRemainingMs(flow.submission, now) > 0) {
    return { ok: false, flow, reason: "COOLDOWN" };
  }
  const attempt = flow.submission.attempt;
  return {
    ok: true,
    attempt,
    flow: {
      draft: flow.draft,
      submission: { phase: "pending", attempt, isRetry: true },
    },
  };
}

export function settleLiveSubmission(
  flow: LiveBookingFlow,
  idempotencyKey: string,
  identity: string,
  outcome:
    | Readonly<{ kind: "success"; result: CreateBookingResult }>
    | Readonly<{ kind: "error"; error: LiveSubmissionError; failedAt: number }>,
): LiveBookingFlow {
  if (
    flow.submission.phase !== "pending" ||
    flow.submission.attempt.idempotencyKey !== idempotencyKey ||
    flow.submission.attempt.identity !== identity
  ) {
    return flow;
  }

  const attempt = flow.submission.attempt;
  if (outcome.kind === "success") {
    return {
      draft: flow.draft,
      submission: {
        phase: "succeeded",
        attempt,
        booking: outcome.result.booking,
        idempotentReplayed: outcome.result.idempotentReplayed,
      },
    };
  }

  const { error, failedAt } = outcome;
  if (error.outcome === "unknown") {
    return {
      draft: flow.draft,
      submission: { phase: "unknown", attempt, error, failedAt },
    };
  }
  if (error.outcome === "in-progress") {
    return {
      draft: flow.draft,
      submission: { phase: "in-progress", attempt, error, failedAt },
    };
  }

  const nextDraft = shouldInvalidateReviewedQuote(error.code)
    ? { ...flow.draft, reviewedQuote: null }
    : flow.draft;

  return {
    draft: nextDraft,
    submission: {
      phase: "failed",
      attempt: error.canRetryWithSameKey ? attempt : null,
      error,
      failedAt,
    },
  };
}

export function resetFlowForNewBooking(
  flow: LiveBookingFlow,
  nextServiceId: string | null,
  preferredPetId: string | null,
): LiveBookingFlow {
  if (isSubmissionLocked(flow.submission)) return flow;
  return createInitialFlow(flow.draft.providerId, nextServiceId, preferredPetId);
}

export function availableDatesForSlots(
  slots: readonly LiveAvailabilitySlot[],
  selectedSlot: LiveAvailabilitySlot | null,
): string[] {
  const dates = new Set<string>();
  for (const slot of slots) {
    if (slot.bookedCount < slot.capacity) {
      dates.add(slot.slotDate);
    }
  }
  if (selectedSlot) {
    dates.add(selectedSlot.slotDate);
  }
  return Array.from(dates).sort();
}

export type LiveCancelDialogSession = Readonly<{
  dialogOpen: boolean;
  cancelState: LiveCancelState;
}>;

export function createInitialCancelDialogSession(): LiveCancelDialogSession {
  return {
    dialogOpen: false,
    cancelState: { phase: "idle" },
  };
}

/**
 * R1 recovery for customer booking cancel / reconcile aborted while hidden under
 * <Activity mode="hidden"> on same-identity 503: releases in-flight phase and
 * moves to "unknown" preserving reason & bookingId; purges 100% on 401/logout/switch.
 */
export function recoverAbortedCancelState(
  state: LiveCancelState,
  currentIdentity: string | null,
  failedAt: number,
): LiveCancelState {
  if (state.phase === "idle") return state;
  if (currentIdentity === null || state.identity !== currentIdentity) {
    return { phase: "idle" };
  }
  if (state.phase === "submitting") {
    return {
      phase: "unknown",
      bookingId: state.bookingId,
      identity: state.identity,
      reason: state.reason,
      error: {
        code: "NETWORK_ERROR",
        category: "uncertain",
        outcome: "unknown",
        status: null,
        retryAfterSeconds: null,
        shouldRefreshBookings: true,
      },
      failedAt,
      cooldownUntil: null,
      reconcileError: null,
    };
  }
  if (state.phase === "reconciling") {
    return {
      phase: "unknown",
      bookingId: state.bookingId,
      identity: state.identity,
      reason: state.reason,
      error: state.originalError,
      failedAt: state.failedAt,
      cooldownUntil: null,
      reconcileError: null,
    };
  }
  return state;
}

/**
 * R2 guard for customer booking cancel dialog: closing while in "unknown" phase
 * hides the dialog UI only while preserving unknown cancel state & reason.
 */
export function closeCancelDialogSession(
  session: LiveCancelDialogSession,
): LiveCancelDialogSession {
  const { cancelState } = session;
  if (
    cancelState.phase === "submitting" ||
    cancelState.phase === "reconciling"
  ) {
    return session;
  }
  if (cancelState.phase === "unknown") {
    return {
      dialogOpen: false,
      cancelState,
    };
  }
  return {
    dialogOpen: false,
    cancelState: { phase: "idle" },
  };
}

export function shouldRestoreUnknownCancelOnOpen(
  state: LiveCancelState,
  identity: string | null,
  bookingId: string,
): boolean {
  return (
    identity !== null &&
    state.phase === "unknown" &&
    state.identity === identity &&
    state.bookingId === bookingId
  );
}
