import { formatDateOnly, TIME_ZONE } from "../customer-catalog/catalogLogic";
import {
  normalizeBookingNote,
  type CancelBookingInput,
  type LiveBookingErrorCategory,
  type LiveBookingErrorCode,
  type LiveBookingErrorInfo,
  type LiveBookingOutcome,
  type LiveBookingSlot,
  type LiveBookingStatus,
  type LiveCustomerBooking,
  type LiveCustomerBookingDetail,
} from "./liveApi";
import { actorIdentityKey, type LiveBookingActor } from "./liveSubmission";

export type BookingRouteSource = "live" | "demo";

export type BookingSearchParamsInput =
  | URLSearchParams
  | Readonly<{ getAll(name: string): string[] }>
  | Readonly<Record<string, string | string[] | undefined>>;

export type CancelIneligibilityReason =
  | "CANCEL_STATUS"
  | "CANCEL_TIME"
  | "CLOCK_INVALID";

export type CancelEligibility =
  | Readonly<{ eligible: true; reasonCode: null; slotStartMs: number }>
  | Readonly<{
      eligible: false;
      reasonCode: CancelIneligibilityReason;
      slotStartMs: number | null;
    }>;

export type LiveCancelError = Readonly<{
  code: LiveBookingErrorCode;
  category: LiveBookingErrorCategory;
  outcome: LiveBookingOutcome;
  status: number | null;
  retryAfterSeconds: number | null;
  shouldRefreshBookings: boolean;
}>;

export type LiveCancelState =
  | Readonly<{ phase: "idle" }>
  | Readonly<{
      phase: "confirming";
      bookingId: string;
      identity: string;
      reason: string;
    }>
  | Readonly<{
      phase: "submitting";
      bookingId: string;
      identity: string;
      reason: string;
      requestId: number;
    }>
  | Readonly<{
      phase: "failed";
      bookingId: string;
      identity: string;
      reason: string;
      error: LiveCancelError;
      failedAt: number;
      cooldownUntil: number | null;
      canRetry: boolean;
    }>
  | Readonly<{
      phase: "unknown";
      bookingId: string;
      identity: string;
      reason: string;
      error: LiveCancelError;
      failedAt: number;
      cooldownUntil: number | null;
      reconcileError: LiveCancelError | null;
    }>
  | Readonly<{
      phase: "reconciling";
      bookingId: string;
      identity: string;
      reason: string;
      originalError: LiveCancelError;
      failedAt: number;
      requestId: number;
    }>
  | Readonly<{
      phase: "succeeded";
      bookingId: string;
      identity: string;
      booking: LiveCustomerBooking;
      viaReconcile: boolean;
    }>;

export type OpenCancelResult =
  | Readonly<{ ok: true; state: LiveCancelState }>
  | Readonly<{
      ok: false;
      state: LiveCancelState;
      reason: "IN_FLIGHT" | "CUSTOMER_REQUIRED" | CancelIneligibilityReason;
    }>;

export type BeginCancelSubmitResult =
  | Readonly<{ ok: true; state: LiveCancelState; input: CancelBookingInput }>
  | Readonly<{
      ok: false;
      state: LiveCancelState;
      reason: "BLOCKED" | "IDENTITY_MISMATCH" | "COOLDOWN" | "INELIGIBLE";
      errorCode?: CancelIneligibilityReason;
    }>;

export type BeginCancelReconcileResult =
  | Readonly<{ ok: true; state: LiveCancelState; bookingId: string }>
  | Readonly<{
      ok: false;
      state: LiveCancelState;
      reason: "BLOCKED" | "IDENTITY_MISMATCH" | "COOLDOWN";
    }>;

export type SettleCancelReconcileResult =
  | Readonly<{ state: LiveCancelState; resolution: "ignored" }>
  | Readonly<{
      state: LiveCancelState;
      resolution: "cancelled";
      detail: LiveCustomerBookingDetail;
    }>
  | Readonly<{
      state: LiveCancelState;
      resolution: "still-cancellable";
      detail: LiveCustomerBookingDetail;
    }>
  | Readonly<{
      state: LiveCancelState;
      resolution: "no-longer-cancellable";
      reasonCode: CancelIneligibilityReason;
      detail: LiveCustomerBookingDetail;
    }>
  | Readonly<{
      state: LiveCancelState;
      resolution: "terminal-error";
      error: LiveCancelError;
    }>
  | Readonly<{
      state: LiveCancelState;
      resolution: "reconcile-failed";
      error: LiveCancelError;
    }>;

export type SyncCancelDetailResult =
  | Readonly<{ state: LiveCancelState; resolution: "unchanged" }>
  | Readonly<{
      state: LiveCancelState;
      resolution: "already-cancelled";
      detail: LiveCustomerBookingDetail;
    }>
  | Readonly<{
      state: LiveCancelState;
      resolution: "no-longer-cancellable";
      reasonCode: CancelIneligibilityReason;
      detail: LiveCustomerBookingDetail;
    }>
  | Readonly<{
      state: LiveCancelState;
      resolution: "still-cancellable";
      detail: LiveCustomerBookingDetail;
    }>;

const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_OF_DAY_PATTERN = /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/;
const POSITIVE_INBOX_ID_PATTERN = /^[1-9]\d*$/;

const RETRYABLE_CANCEL_CODES = new Set<LiveBookingErrorCode>([
  "SESSION_BUSY",
  "RATE_LIMITED",
  "RATE_LIMIT_UNAVAILABLE",
  "INVALID_REQUEST",
  "NO_RESERVED_CAPACITY",
  "BOOKING_CONFLICT",
]);

const TERMINAL_RECONCILE_CODES = new Set<LiveBookingErrorCode>([
  "BOOKING_NOT_FOUND",
  "SESSION_ENDED",
  "CUSTOMER_REQUIRED",
]);

function readSearchValues(
  params: BookingSearchParamsInput,
  key: string,
): string[] {
  if (
    params instanceof URLSearchParams ||
    typeof (params as { getAll?: unknown }).getAll === "function"
  ) {
    return (params as { getAll(name: string): string[] }).getAll(key);
  }
  const raw = (params as Readonly<Record<string, string | string[] | undefined>>)[
    key
  ];
  if (raw === undefined) return [];
  return Array.isArray(raw) ? raw : [raw];
}

/**
 * Live is always the default source for /bookings and /bookings/[bookingId].
 * Demo mode requires explicit URL provenance (?catalog=demo or a valid numeric
 * ?fromInbox=<id> produced by CustomerInboxPage) — never inferred from ID shape.
 */
export function resolveBookingRouteSource(
  searchParams: BookingSearchParamsInput,
): BookingRouteSource {
  const catalogValues = readSearchValues(searchParams, "catalog");
  if (catalogValues.length === 1 && catalogValues[0] === "demo") {
    return "demo";
  }
  const inboxValues = readSearchValues(searchParams, "fromInbox");
  if (
    inboxValues.length === 1 &&
    POSITIVE_INBOX_ID_PATTERN.test(inboxValues[0]!)
  ) {
    return "demo";
  }
  return "live";
}

/**
 * Parses slotDate + startTime in Asia/Ho_Chi_Minh (fixed UTC+07:00, no DST),
 * rejecting calendar-overflow dates such as 2026-02-31.
 */
export function parseVietnamSlotStartMs(
  slot: Pick<LiveBookingSlot, "slotDate" | "startTime">,
): number | null {
  const dateMatch = CALENDAR_DATE_PATTERN.exec(slot.slotDate);
  if (!dateMatch) return null;
  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  if (
    !Number.isFinite(utcDate.getTime()) ||
    utcDate.getUTCFullYear() !== year ||
    utcDate.getUTCMonth() !== month - 1 ||
    utcDate.getUTCDate() !== day
  ) {
    return null;
  }
  if (!TIME_OF_DAY_PATTERN.test(slot.startTime)) return null;
  const instant = Date.parse(`${slot.slotDate}T${slot.startTime}+07:00`);
  return Number.isFinite(instant) ? instant : null;
}

/**
 * Client-side cancel visibility check matching BR-06 & BR-07 (Asia/Ho_Chi_Minh).
 * Backend remains the final authority on POST /bookings/mine/:id/cancel.
 */
export function evaluateCancelEligibility(
  booking: Pick<LiveCustomerBooking, "status" | "slot">,
  now: number,
): CancelEligibility {
  if (
    booking.status !== "PENDING_CONFIRMATION" &&
    booking.status !== "CONFIRMED"
  ) {
    return { eligible: false, reasonCode: "CANCEL_STATUS", slotStartMs: null };
  }
  const slotStartMs = parseVietnamSlotStartMs(booking.slot);
  if (!Number.isFinite(now) || slotStartMs === null) {
    return { eligible: false, reasonCode: "CLOCK_INVALID", slotStartMs };
  }
  if (now >= slotStartMs) {
    return { eligible: false, reasonCode: "CANCEL_TIME", slotStartMs };
  }
  return { eligible: true, reasonCode: null, slotStartMs };
}

/**
 * Normalizes optional cancel reason: sends `{}` when empty or whitespace-only
 * so wire body omits `reason`; trims non-empty strings.
 */
export function buildCancelBookingInput(rawReason: string): CancelBookingInput {
  const normalized = normalizeBookingNote(rawReason);
  return normalized === null ? {} : { reason: normalized };
}

export function toLiveCancelError(
  info: LiveBookingErrorInfo,
): LiveCancelError {
  return {
    code: info.code,
    category: info.category,
    outcome: info.outcome,
    status: info.status,
    retryAfterSeconds: info.retryAfterSeconds,
    shouldRefreshBookings: info.shouldRefreshBookings,
  };
}

function localIneligibleCancelError(
  reasonCode: CancelIneligibilityReason,
): LiveCancelError {
  const code: LiveBookingErrorCode =
    reasonCode === "CLOCK_INVALID" ? "UNKNOWN_ERROR" : reasonCode;
  return {
    code,
    category: reasonCode === "CLOCK_INVALID" ? "transient" : "conflict",
    outcome: "definite-failure",
    status: null,
    retryAfterSeconds: null,
    shouldRefreshBookings: true,
  };
}

function computeCooldownUntil(
  error: LiveCancelError,
  failedAt: number,
): number | null {
  if (
    error.retryAfterSeconds === null ||
    !Number.isFinite(error.retryAfterSeconds) ||
    error.retryAfterSeconds <= 0
  ) {
    return null;
  }
  return failedAt + error.retryAfterSeconds * 1000;
}

export function createInitialCancelState(): LiveCancelState {
  return { phase: "idle" };
}

export function isCancelInFlight(state: LiveCancelState): boolean {
  return state.phase === "submitting" || state.phase === "reconciling";
}

export function isCancelDialogOpen(state: LiveCancelState): boolean {
  return state.phase !== "idle" && state.phase !== "succeeded";
}

export function cancelCooldownRemainingMs(
  state: LiveCancelState,
  now: number,
): number {
  if (state.phase !== "failed" && state.phase !== "unknown") return 0;
  if (state.cooldownUntil === null || !Number.isFinite(state.cooldownUntil)) {
    return 0;
  }
  return Math.max(0, state.cooldownUntil - now);
}

export function openCancelFlow(
  state: LiveCancelState,
  actor: LiveBookingActor | null,
  booking: Pick<LiveCustomerBooking, "id" | "status" | "slot">,
  now: number,
): OpenCancelResult {
  if (isCancelInFlight(state)) {
    return { ok: false, state, reason: "IN_FLIGHT" };
  }
  if (!actor || actor.role !== "CUSTOMER") {
    return { ok: false, state, reason: "CUSTOMER_REQUIRED" };
  }
  const eligibility = evaluateCancelEligibility(booking, now);
  if (!eligibility.eligible) {
    return { ok: false, state, reason: eligibility.reasonCode };
  }
  return {
    ok: true,
    state: {
      phase: "confirming",
      bookingId: booking.id,
      identity: actorIdentityKey(actor),
      reason: "",
    },
  };
}

export function updateCancelReason(
  state: LiveCancelState,
  reason: string,
): LiveCancelState {
  if (state.phase === "confirming") {
    return state.reason === reason ? state : { ...state, reason };
  }
  if (state.phase === "failed" && state.canRetry) {
    return state.reason === reason ? state : { ...state, reason };
  }
  return state;
}

export function closeCancelFlow(state: LiveCancelState): LiveCancelState {
  if (isCancelInFlight(state)) return state;
  if (state.phase === "idle") return state;
  return { phase: "idle" };
}

/**
 * Caller must commit result.state synchronously before awaiting cancelMyBooking
 * so rapid double-clicks or Enter keystrokes cannot dispatch duplicate POSTs.
 */
export function beginCancelSubmit(
  state: LiveCancelState,
  actor: LiveBookingActor | null,
  booking: Pick<LiveCustomerBooking, "id" | "status" | "slot">,
  requestId: number,
  now: number,
): BeginCancelSubmitResult {
  if (
    state.phase !== "confirming" &&
    !(state.phase === "failed" && state.canRetry)
  ) {
    return { ok: false, state, reason: "BLOCKED" };
  }
  if (
    !actor ||
    actor.role !== "CUSTOMER" ||
    actorIdentityKey(actor) !== state.identity ||
    booking.id !== state.bookingId
  ) {
    return { ok: false, state, reason: "IDENTITY_MISMATCH" };
  }
  if (cancelCooldownRemainingMs(state, now) > 0) {
    return { ok: false, state, reason: "COOLDOWN" };
  }
  const eligibility = evaluateCancelEligibility(booking, now);
  if (!eligibility.eligible) {
    return {
      ok: false,
      reason: "INELIGIBLE",
      errorCode: eligibility.reasonCode,
      state: {
        phase: "failed",
        bookingId: state.bookingId,
        identity: state.identity,
        reason: state.reason,
        error: localIneligibleCancelError(eligibility.reasonCode),
        failedAt: now,
        cooldownUntil: null,
        canRetry: false,
      },
    };
  }
  return {
    ok: true,
    input: buildCancelBookingInput(state.reason),
    state: {
      phase: "submitting",
      bookingId: state.bookingId,
      identity: state.identity,
      reason: state.reason,
      requestId,
    },
  };
}

export function settleCancelSubmit(
  state: LiveCancelState,
  requestId: number,
  identity: string,
  outcome:
    | Readonly<{ kind: "success"; booking: LiveCustomerBooking }>
    | Readonly<{ kind: "error"; error: LiveCancelError; failedAt: number }>,
): LiveCancelState {
  if (
    state.phase !== "submitting" ||
    state.requestId !== requestId ||
    state.identity !== identity
  ) {
    return state;
  }
  if (outcome.kind === "success") {
    return {
      phase: "succeeded",
      bookingId: state.bookingId,
      identity: state.identity,
      booking: outcome.booking,
      viaReconcile: false,
    };
  }

  const { error, failedAt } = outcome;
  const cooldownUntil = computeCooldownUntil(error, failedAt);
  if (error.outcome === "unknown") {
    // POST /bookings/mine/:id/cancel has no Idempotency-Key: never auto-retry.
    return {
      phase: "unknown",
      bookingId: state.bookingId,
      identity: state.identity,
      reason: state.reason,
      error,
      failedAt,
      cooldownUntil,
      reconcileError: null,
    };
  }

  return {
    phase: "failed",
    bookingId: state.bookingId,
    identity: state.identity,
    reason: state.reason,
    error,
    failedAt,
    cooldownUntil,
    canRetry: RETRYABLE_CANCEL_CODES.has(error.code),
  };
}

/**
 * Transitions from "unknown" to "reconciling" to verify authoritative booking
 * status via GET /bookings/mine/:id before allowing any further cancel POST.
 */
export function beginCancelReconcile(
  state: LiveCancelState,
  actor: LiveBookingActor | null,
  requestId: number,
  now: number,
): BeginCancelReconcileResult {
  if (state.phase !== "unknown") {
    return { ok: false, state, reason: "BLOCKED" };
  }
  if (
    !actor ||
    actor.role !== "CUSTOMER" ||
    actorIdentityKey(actor) !== state.identity
  ) {
    return { ok: false, state, reason: "IDENTITY_MISMATCH" };
  }
  if (cancelCooldownRemainingMs(state, now) > 0) {
    return { ok: false, state, reason: "COOLDOWN" };
  }
  return {
    ok: true,
    bookingId: state.bookingId,
    state: {
      phase: "reconciling",
      bookingId: state.bookingId,
      identity: state.identity,
      reason: state.reason,
      originalError: state.error,
      failedAt: state.failedAt,
      requestId,
    },
  };
}

export function settleCancelReconcile(
  state: LiveCancelState,
  requestId: number,
  identity: string,
  outcome:
    | Readonly<{ kind: "detail"; detail: LiveCustomerBookingDetail }>
    | Readonly<{ kind: "error"; error: LiveCancelError; failedAt: number }>,
  now: number,
): SettleCancelReconcileResult {
  if (
    state.phase !== "reconciling" ||
    state.requestId !== requestId ||
    state.identity !== identity
  ) {
    return { state, resolution: "ignored" };
  }

  if (outcome.kind === "detail") {
    const { detail } = outcome;
    if (detail.id !== state.bookingId) {
      return { state, resolution: "ignored" };
    }
    if (detail.status === "CANCELLED") {
      return {
        resolution: "cancelled",
        detail,
        state: {
          phase: "succeeded",
          bookingId: detail.id,
          identity: state.identity,
          booking: detail,
          viaReconcile: true,
        },
      };
    }
    const eligibility = evaluateCancelEligibility(detail, now);
    if (eligibility.eligible) {
      return {
        resolution: "still-cancellable",
        detail,
        state: {
          phase: "confirming",
          bookingId: detail.id,
          identity: state.identity,
          reason: state.reason,
        },
      };
    }
    return {
      resolution: "no-longer-cancellable",
      reasonCode: eligibility.reasonCode,
      detail,
      state: { phase: "idle" },
    };
  }

  const { error, failedAt } = outcome;
  if (TERMINAL_RECONCILE_CODES.has(error.code)) {
    return {
      resolution: "terminal-error",
      error,
      state: { phase: "idle" },
    };
  }

  return {
    resolution: "reconcile-failed",
    error,
    state: {
      phase: "unknown",
      bookingId: state.bookingId,
      identity: state.identity,
      reason: state.reason,
      error: state.originalError,
      failedAt: state.failedAt,
      cooldownUntil: computeCooldownUntil(error, failedAt),
      reconcileError: error,
    },
  };
}

/**
 * Reconciles cancel UI state with fresh detail fetched after 409 CANCEL_STATUS,
 * 409 CANCEL_TIME, or 409 BOOKING_CONFLICT (e.g. cancelled in another tab).
 */
export function syncCancelWithRefreshedDetail(
  state: LiveCancelState,
  detail: LiveCustomerBookingDetail,
  now: number,
): SyncCancelDetailResult {
  if (state.phase !== "failed" || state.bookingId !== detail.id) {
    return { state, resolution: "unchanged" };
  }
  if (detail.status === "CANCELLED") {
    return {
      resolution: "already-cancelled",
      detail,
      state: {
        phase: "succeeded",
        bookingId: detail.id,
        identity: state.identity,
        booking: detail,
        viaReconcile: true,
      },
    };
  }
  const eligibility = evaluateCancelEligibility(detail, now);
  if (!eligibility.eligible) {
    return {
      resolution: "no-longer-cancellable",
      reasonCode: eligibility.reasonCode,
      detail,
      state: { phase: "idle" },
    };
  }
  return {
    resolution: "still-cancellable",
    detail,
    state: {
      phase: "confirming",
      bookingId: detail.id,
      identity: state.identity,
      reason: state.reason,
    },
  };
}

/** Immediately wipes private cancel state on logout, 401, or identity change. */
export function resetCancelForSessionBoundary(
  state: LiveCancelState,
  nextIdentity: string | null,
): LiveCancelState {
  if (state.phase === "idle") return state;
  if (nextIdentity === null || state.identity !== nextIdentity) {
    return { phase: "idle" };
  }
  return state;
}

function normalizeVietnameseText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

/** Local filter over GET /bookings/mine results; preserves exact server order. */
export function filterLiveBookings(
  bookings: readonly LiveCustomerBooking[],
  filters: Readonly<{ status: LiveBookingStatus | ""; query: string }>,
): LiveCustomerBooking[] {
  const normalizedQuery = normalizeVietnameseText(filters.query.trim());
  return bookings.filter((booking) => {
    if (filters.status && booking.status !== filters.status) return false;
    if (!normalizedQuery) return true;
    const haystack = normalizeVietnameseText(
      [
        booking.id,
        booking.service.name,
        booking.provider.businessName,
        booking.pet.name,
      ].join(" "),
    );
    return haystack.includes(normalizedQuery);
  });
}

export function formatVietnamAppointment(
  slot: Pick<LiveBookingSlot, "slotDate" | "startTime" | "endTime">,
): string {
  return `${formatDateOnly(slot.slotDate)} · ${slot.startTime.slice(0, 5)}–${slot.endTime.slice(0, 5)}`;
}

export function formatVietnamDateTime(isoTimestamp: string): string {
  const parsed = Date.parse(isoTimestamp);
  if (!Number.isFinite(parsed)) return isoTimestamp;
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(parsed);
}
