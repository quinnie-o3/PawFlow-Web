import { payloadFingerprint } from "./bookingLogic";
import type { Actor, BookingDraft, ErrorCode } from "./model";

export type SubmissionAttempt = Readonly<{
  id: string; customerId: string; fingerprint: string;
}>;
export type SubmissionState =
  | Readonly<{ phase: "editing" }>
  | Readonly<{ phase: "pending" | "unknown" | "reconciling"; attempt: SubmissionAttempt }>
  | Readonly<{ phase: "failed"; attempt: SubmissionAttempt; code: ErrorCode | "NOT_CREATED" }>
  | Readonly<{ phase: "succeeded"; attempt: SubmissionAttempt; bookingId: string }>;
export type BeginResult =
  | Readonly<{ ok: true; state: SubmissionState; attempt: SubmissionAttempt }>
  | Readonly<{ ok: false; state: SubmissionState; code: "BLOCKED" | "INVALID_ATTEMPT" | "CUSTOMER_REQUIRED" }>;
export type Reconciliation =
  | Readonly<{ kind: "found"; bookingId: string }>
  /** Only after the original request has TERMINALLY settled, never a racing read. */
  | Readonly<{ kind: "absent" }>
  | Readonly<{ kind: "in-flight" | "unavailable" | "mismatch" }>;

/**
 * Caller must synchronously assign result.state BEFORE awaiting any transport.
 * Unknown outcome cannot begin another attempt or edit into a new request.
 */
export function beginSubmission(
  state: SubmissionState, actor: Actor, draft: BookingDraft, newAttemptId: string,
): BeginResult {
  if (state.phase !== "editing" && state.phase !== "failed") {
    return { ok: false, state, code: "BLOCKED" };
  }
  if (actor.role !== "CUSTOMER") return { ok: false, state, code: "CUSTOMER_REQUIRED" };
  const fingerprint = payloadFingerprint(draft);
  const previous = state.phase === "failed" ? state.attempt : null;
  const attempt = previous?.customerId === actor.id && previous.fingerprint === fingerprint
    ? previous : { id: newAttemptId, customerId: actor.id, fingerprint };
  if (!attempt.id.trim()) return { ok: false, state, code: "INVALID_ATTEMPT" };
  return { ok: true, state: { phase: "pending", attempt }, attempt };
}

export function settleSubmission(
  state: SubmissionState, attemptId: string,
  outcome:
    | Readonly<{ kind: "success"; bookingId: string }>
    | Readonly<{ kind: "known-failure"; code: ErrorCode }>
    | Readonly<{ kind: "unknown" }>,
): SubmissionState {
  if (state.phase === "editing" || state.phase === "failed" || state.phase === "succeeded" ||
      state.attempt.id !== attemptId) return state;
  if (outcome.kind === "success") {
    return { phase: "succeeded", attempt: state.attempt, bookingId: outcome.bookingId };
  }
  // A late failure cannot undo an active reconciliation or a known receipt.
  if (state.phase !== "pending") return state;
  return outcome.kind === "unknown"
    ? { phase: "unknown", attempt: state.attempt }
    : { phase: "failed", attempt: state.attempt, code: outcome.code };
}

export function beginReconciliation(state: SubmissionState): SubmissionState {
  return state.phase === "unknown" ? { phase: "reconciling", attempt: state.attempt } : state;
}

export function finishReconciliation(
  state: SubmissionState, attemptId: string, lookup: Reconciliation,
): SubmissionState {
  if (state.phase !== "reconciling" || state.attempt.id !== attemptId) return state;
  if (lookup.kind === "found") {
    return { phase: "succeeded", attempt: state.attempt, bookingId: lookup.bookingId };
  }
  if (lookup.kind === "absent") {
    return { phase: "failed", attempt: state.attempt, code: "NOT_CREATED" };
  }
  return { phase: "unknown", attempt: state.attempt };
}
