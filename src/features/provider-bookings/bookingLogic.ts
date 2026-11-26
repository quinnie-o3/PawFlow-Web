import { isRequestCancelled } from "../../lib/api/errors";
import { vi } from "../../lib/locale";
import { matchesSearch, normalizeSearch } from "../../lib/search";
import {
  isValidCalendarDate,
  type ProviderApiErrorInfo,
  type ProviderApprovalStatus,
  type ProviderBooking,
  type ProviderBookingDetail,
  type ProviderBookingReasonInput,
  type ProviderBookingSlot,
  type ProviderBookingStatus,
} from "../provider-workspace/liveApi";
import type { ProviderLifecyclePermissions } from "../provider-workspace/lifecycle";
import type {
  BookingActionOption,
  BookingDetailLoadState,
  BookingDraftState,
  BookingFilters,
  BookingReconcileOutcome,
  BookingSummaryItem,
  BookingTimeNoticeKind,
  ProviderBookingAction,
} from "./types";

export const BOOKING_TIME_ZONE = "Asia/Ho_Chi_Minh";

export const PROVIDER_BOOKING_STATUS_ORDER: readonly ProviderBookingStatus[] = [
  "PENDING_CONFIRMATION",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "REJECTED",
  "NO_SHOW",
] as const;

export const BOOKING_STATUS_LABELS: Readonly<Record<ProviderBookingStatus, string>> = {
  PENDING_CONFIRMATION: vi.provider.bookings.status.PENDING_CONFIRMATION,
  CONFIRMED: vi.provider.bookings.status.CONFIRMED,
  REJECTED: vi.provider.bookings.status.REJECTED,
  CANCELLED: vi.provider.bookings.status.CANCELLED,
  COMPLETED: vi.provider.bookings.status.COMPLETED,
  NO_SHOW: vi.provider.bookings.status.NO_SHOW,
};

export const BOOKING_ACTION_LABELS: Readonly<Record<ProviderBookingAction, string>> = {
  confirm: vi.provider.bookings.actions.confirm,
  reject: vi.provider.bookings.actions.reject,
  complete: vi.provider.bookings.actions.complete,
  "no-show": vi.provider.bookings.actions["no-show"],
};

export const ACTION_TARGET_STATUS: Readonly<
  Record<ProviderBookingAction, ProviderBookingStatus>
> = {
  confirm: "CONFIRMED",
  reject: "REJECTED",
  complete: "COMPLETED",
  "no-show": "NO_SHOW",
};

export const ACTION_SOURCE_STATUS: Readonly<
  Record<ProviderBookingAction, ProviderBookingStatus>
> = {
  confirm: "PENDING_CONFIRMATION",
  reject: "PENDING_CONFIRMATION",
  complete: "CONFIRMED",
  "no-show": "CONFIRMED",
};

const LEGACY_STATUS_PARAM_MAP: Readonly<Record<string, ProviderBookingStatus>> = {
  pendingConfirmation: "PENDING_CONFIRMATION",
  confirmed: "CONFIRMED",
  rejected: "REJECTED",
  cancelled: "CANCELLED",
  completed: "COMPLETED",
  noShow: "NO_SHOW",
  PENDING_CONFIRMATION: "PENDING_CONFIRMATION",
  CONFIRMED: "CONFIRMED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
  COMPLETED: "COMPLETED",
  NO_SHOW: "NO_SHOW",
};

/** Accepts both canonical API enums and legacy camelCase query params from older links. */
export function parseStatusFilterParam(
  raw: string | null | undefined,
): ProviderBookingStatus | "all" {
  if (!raw) return "all";
  return LEGACY_STATUS_PARAM_MAP[raw.trim()] ?? "all";
}

export function formatCalendarDate(calendarDate: string): string {
  const parts = calendarDate.split("-");
  if (parts.length !== 3) return calendarDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function formatSlotTimeShort(time: string): string {
  return time.length >= 5 ? time.slice(0, 5) : time;
}

export function formatBookingSlotRange(
  slot: Pick<ProviderBookingSlot, "slotDate" | "startTime" | "endTime">,
): string {
  return `${formatCalendarDate(slot.slotDate)} · ${formatSlotTimeShort(slot.startTime)}–${formatSlotTimeShort(slot.endTime)}`;
}

export function formatBookingTimestamp(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return iso;
  const parts = new Intl.DateTimeFormat("vi-VN", {
    timeZone: BOOKING_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("day")}/${part("month")}/${part("year")} · ${part("hour")}:${part("minute")}`;
}

/** Parses NUMERIC(12,2) / NUMERIC(18,2) decimal string into exact integer cents via BigInt. */
export function parseDecimalAmountToCents(amount: string): bigint {
  const trimmed = amount.trim();
  const negative = trimmed.startsWith("-");
  const unsigned = negative ? trimmed.slice(1) : trimmed;
  const [wholeRaw, fracRaw = ""] = unsigned.split(".");
  const whole = /^\d+$/.test(wholeRaw) ? BigInt(wholeRaw) : BigInt(0);
  const paddedFrac = `${fracRaw.replace(/\D/g, "")}00`.slice(0, 2);
  const cents = whole * BigInt(100) + BigInt(paddedFrac || "0");
  return negative ? -cents : cents;
}

export function formatCentsToVnd(cents: bigint): string {
  const negative = cents < BigInt(0);
  const abs = negative ? -cents : cents;
  const whole = abs / BigInt(100);
  const frac = abs % BigInt(100);
  const wholeFormatted = whole
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const sign = negative ? "-" : "";
  if (frac === BigInt(0)) {
    return `${sign}${wholeFormatted} ₫`;
  }
  const fracStr = frac.toString().padStart(2, "0");
  return `${sign}${wholeFormatted},${fracStr} ₫`;
}

export function formatVndAmount(decimalString: string): string {
  return formatCentsToVnd(parseDecimalAmountToCents(decimalString));
}

export function validateBookingDateFilter(
  fromDate: string,
  toDate: string,
): string | null {
  if (fromDate && !isValidCalendarDate(fromDate)) {
    return vi.provider.bookings.filters.invalidDateRange;
  }
  if (toDate && !isValidCalendarDate(toDate)) {
    return vi.provider.bookings.filters.invalidDateRange;
  }
  if (fromDate && toDate && fromDate > toDate) {
    return vi.provider.bookings.filters.invalidDateRange;
  }
  return null;
}

export function filterProviderBookings(
  bookings: readonly ProviderBooking[],
  filters: BookingFilters,
): ProviderBooking[] {
  const normalizedQuery = normalizeSearch(filters.query);
  const validFrom =
    filters.fromDate && isValidCalendarDate(filters.fromDate)
      ? filters.fromDate
      : null;
  const validTo =
    filters.toDate && isValidCalendarDate(filters.toDate)
      ? filters.toDate
      : null;
  const dateFilterValid = !validFrom || !validTo || validFrom <= validTo;

  return bookings.filter((booking) => {
    if (filters.status !== "all" && booking.status !== filters.status) {
      return false;
    }
    if (dateFilterValid) {
      if (validFrom && booking.slot.slotDate < validFrom) return false;
      if (validTo && booking.slot.slotDate > validTo) return false;
    }
    return matchesSearch(normalizedQuery, [
      booking.id,
      booking.customer.fullName,
      booking.pet.name,
      booking.service.name,
    ]);
  });
}

export function summarizeProviderBookings(
  bookings: readonly ProviderBooking[],
): BookingSummaryItem[] {
  const summaryStatuses: readonly ProviderBookingStatus[] = [
    "PENDING_CONFIRMATION",
    "CONFIRMED",
    "COMPLETED",
  ];
  return summaryStatuses.map((status) => ({
    status,
    title: BOOKING_STATUS_LABELS[status],
    count: bookings.filter((booking) => booking.status === status).length,
  }));
}

export function getConfirmDisabledReason(
  permissions: ProviderLifecyclePermissions | null,
): string | null {
  if (!permissions) {
    return vi.provider.bookings.lifecycleLock.UNAVAILABLE;
  }
  if (permissions.canConfirmBookings) return null;
  const status: Exclude<ProviderApprovalStatus, "APPROVED"> =
    permissions.status === "APPROVED" ? "PENDING" : permissions.status;
  return vi.provider.bookings.lifecycleLock[status];
}

/**
 * Mirrors backend BookingsService & provider-lifecycle.policy.ts:
 * - No provider cancel endpoint exists.
 * - confirm requires PENDING_CONFIRMATION + APPROVED provider.
 * - reject (PENDING_CONFIRMATION) and complete / no-show (CONFIRMED) remain allowed
 *   across all 4 lifecycle statuses (wind-down), never hard-locked by client clock.
 */
export function getAvailableBookingActions(
  booking: Pick<ProviderBooking, "status">,
  permissions: ProviderLifecyclePermissions | null,
): BookingActionOption[] {
  if (booking.status === "PENDING_CONFIRMATION") {
    return [
      {
        action: "confirm",
        targetStatus: "CONFIRMED",
        label: BOOKING_ACTION_LABELS.confirm,
        requiresReasonField: false,
        disabledReason: getConfirmDisabledReason(permissions),
      },
      {
        action: "reject",
        targetStatus: "REJECTED",
        label: BOOKING_ACTION_LABELS.reject,
        requiresReasonField: true,
        disabledReason: null,
      },
    ];
  }

  if (booking.status === "CONFIRMED") {
    return [
      {
        action: "complete",
        targetStatus: "COMPLETED",
        label: BOOKING_ACTION_LABELS.complete,
        requiresReasonField: false,
        disabledReason: null,
      },
      {
        action: "no-show",
        targetStatus: "NO_SHOW",
        label: BOOKING_ACTION_LABELS["no-show"],
        requiresReasonField: true,
        disabledReason: null,
      },
    ];
  }

  return [];
}

export function getSlotBoundsMs(
  slot: Pick<ProviderBookingSlot, "slotDate" | "startTime" | "endTime">,
): { startMs: number; endMs: number } | null {
  const startMs = Date.parse(`${slot.slotDate}T${slot.startTime}+07:00`);
  const endMs = Date.parse(`${slot.slotDate}T${slot.endTime}+07:00`);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;
  return { startMs, endMs };
}

/**
 * Advisory time warning in Asia/Ho_Chi_Minh for complete/no-show confirmation.
 * Never blocks submission so client clock skew cannot lock valid server transitions.
 */
export function evaluateBookingTimeNotice(
  slot: Pick<ProviderBookingSlot, "slotDate" | "startTime" | "endTime">,
  action: ProviderBookingAction,
  nowMs: number,
): BookingTimeNoticeKind {
  if (!Number.isFinite(nowMs)) return null;
  const bounds = getSlotBoundsMs(slot);
  if (!bounds) return null;

  if (action === "no-show") {
    return nowMs < bounds.startMs ? "no-show-before-start" : null;
  }
  if (action === "complete") {
    if (nowMs < bounds.startMs) return "complete-before-start";
    if (nowMs < bounds.endMs) return "complete-before-end";
  }
  return null;
}

export function buildReasonPayload(reason: string): ProviderBookingReasonInput {
  const trimmed = reason.trim();
  return trimmed ? { reason: trimmed } : {};
}

export function reconcileUnknownMutation(
  serverStatus: ProviderBookingStatus,
  action: ProviderBookingAction,
): BookingReconcileOutcome {
  if (serverStatus === ACTION_TARGET_STATUS[action]) {
    return "applied";
  }
  if (serverStatus === ACTION_SOURCE_STATUS[action]) {
    return "not-applied";
  }
  return "changed-elsewhere";
}

export function isBookingConflictOrNotFoundCode(code: string): boolean {
  return (
    code === "BOOKING_NOT_PENDING" ||
    code === "BOOKING_NOT_CONFIRMED" ||
    code === "NO_RESERVED_CAPACITY" ||
    code === "NO_SHOW_TIME" ||
    code === "CONFLICT" ||
    code === "BOOKING_NOT_FOUND"
  );
}

export const EMPTY_BOOKING_DRAFT: BookingDraftState = {
  identity: null,
  bookingId: null,
  action: null,
  reason: "",
  openedAtMs: null,
  phase: "idle",
  error: null,
  reconcileError: null,
};

export type PendingUnknownBookingMap = Readonly<{
  identity: string | null;
  byBookingId: Readonly<Record<string, BookingDraftState>>;
}>;

export const EMPTY_PENDING_UNKNOWN_BOOKINGS: PendingUnknownBookingMap = {
  identity: null,
  byBookingId: {},
};

/**
 * R1 recovery for provider booking mutations/reconcile aborted while hidden under
 * <Activity mode="hidden"> on same-identity 503: releases busy phase and moves to
 * "unknown" preserving action & reason; purges 100% on 401/logout/identity switch.
 */
export function recoverAbortedBookingDraft(
  draft: BookingDraftState,
  attemptIdentity: string,
  liveIdentity: string | null,
  fallbackError: ProviderApiErrorInfo,
): BookingDraftState {
  if (liveIdentity !== attemptIdentity) {
    return EMPTY_BOOKING_DRAFT;
  }
  if (draft.identity !== attemptIdentity) return draft;
  if (draft.phase === "submitting") {
    return {
      ...draft,
      phase: "unknown",
      error: fallbackError,
      reconcileError: null,
    };
  }
  if (draft.phase === "reconciling") {
    return {
      ...draft,
      phase: "unknown",
      reconcileError: null,
    };
  }
  return draft;
}

export function storePendingUnknownBooking(
  map: PendingUnknownBookingMap,
  draft: BookingDraftState,
): PendingUnknownBookingMap {
  if (
    draft.phase !== "unknown" ||
    !draft.identity ||
    !draft.bookingId ||
    !draft.action
  ) {
    return map;
  }
  const base = map.identity === draft.identity ? map.byBookingId : {};
  return {
    identity: draft.identity,
    byBookingId: { ...base, [draft.bookingId]: draft },
  };
}

export function clearPendingUnknownBooking(
  map: PendingUnknownBookingMap,
  identity: string | null,
  bookingId: string | null,
): PendingUnknownBookingMap {
  if (!identity || !bookingId || map.identity !== identity) return map;
  if (!Object.hasOwn(map.byBookingId, bookingId)) return map;
  const next = { ...map.byBookingId };
  delete next[bookingId];
  return { identity, byBookingId: next };
}

export function getPendingUnknownBooking(
  map: PendingUnknownBookingMap,
  identity: string | null,
  bookingId: string | null,
): BookingDraftState | null {
  if (!identity || !bookingId || map.identity !== identity) return null;
  const found = Object.hasOwn(map.byBookingId, bookingId)
    ? map.byBookingId[bookingId]
    : null;
  return found && found.phase === "unknown" ? found : null;
}

export const EMPTY_BOOKING_DETAIL: BookingDetailLoadState = {
  identity: null,
  bookingId: null,
  status: "idle",
  detail: null,
  error: null,
};

export type FetchBookingDetailResult =
  | Readonly<{ ok: true; detail: ProviderBookingDetail }>
  | Readonly<{
      ok: false;
      notFound: boolean;
      error: ProviderApiErrorInfo;
      aborted?: false;
    }>
  | Readonly<{ ok: false; aborted: true }>;

export type BookingDetailSyncParams = Readonly<{
  identity: string | null;
  canFetch: boolean;
  selectedBookingId: string | null;
  profileNotFound: boolean;
}>;

export type BookingDetailLoaderSnapshot = Readonly<{
  state: BookingDetailLoadState;
  interrupted: boolean;
  inFlight: boolean;
}>;

export type BookingDetailLoader = Readonly<{
  load: (
    bookingId: string,
    explicitIdentity?: string,
  ) => Promise<FetchBookingDetailResult>;
  selectAndLoad: (
    identity: string,
    bookingId: string,
  ) => Promise<FetchBookingDetailResult>;
  interruptForHide: () => void;
  closeSelection: () => void;
  resetPrivate: () => void;
  syncSession: (
    params: BookingDetailSyncParams,
  ) => Promise<FetchBookingDetailResult> | null;
  getSnapshot: () => BookingDetailLoaderSnapshot;
}>;

/**
 * Coordinates GET /bookings/provider/:id lifecycle across <Activity mode="hidden">
 * aborts on same-identity 503 revalidation vs explicit close, selection switch,
 * and 401/logout/identity-switch purges.
 * - On same-identity 503 hide cleanup: aborts the in-flight request, exits any
 *   orphaned "loading" status (preserving previously loaded detail), records an
 *   interrupted flag, and auto-recovers as soon as canFetch returns true on the
 *   same identity with selectedBookingId still open.
 * - On closeSelection / resetPrivate / identity switch: aborts and clears all
 *   interruption markers so stale requests never resurrect or leak across users.
 */
export function createBookingDetailLoader(deps: Readonly<{
  fetchDetail: (
    bookingId: string,
    options: { signal: AbortSignal },
  ) => Promise<ProviderBookingDetail>;
  classifyError: (err: unknown) => ProviderApiErrorInfo;
  onStateChange: (next: BookingDetailLoadState) => void;
  onDetailLoaded?: (identity: string, detail: ProviderBookingDetail) => void;
  onErrorInfo?: (info: ProviderApiErrorInfo) => void;
  onProfileNotFound?: () => void;
  initialIdentity?: string | null;
  initialCanFetch?: boolean;
}>): BookingDetailLoader {
  let state: BookingDetailLoadState = EMPTY_BOOKING_DETAIL;
  let activeController: AbortController | null = null;
  let activeTarget: { identity: string; bookingId: string } | null = null;
  let interruptedTarget: { identity: string; bookingId: string } | null = null;
  let requestId = 0;
  let liveIdentity: string | null = deps.initialIdentity ?? null;
  let canFetch = deps.initialCanFetch ?? false;
  let selectedBookingId: string | null = null;

  function emit(next: BookingDetailLoadState) {
    state = next;
    deps.onStateChange(next);
  }

  function hasMatchingInterrupted(identity: string, bookingId: string): boolean {
    return (
      interruptedTarget !== null &&
      interruptedTarget.identity === identity &&
      interruptedTarget.bookingId === bookingId
    );
  }

  function hasMatchingActive(identity: string, bookingId: string): boolean {
    return (
      activeController !== null &&
      activeTarget !== null &&
      activeTarget.identity === identity &&
      activeTarget.bookingId === bookingId
    );
  }

  async function load(
    bookingId: string,
    explicitIdentity?: string,
  ): Promise<FetchBookingDetailResult> {
    const targetIdentity = explicitIdentity ?? liveIdentity;
    if (!canFetch || !targetIdentity) {
      if (targetIdentity && selectedBookingId === bookingId) {
        interruptedTarget = { identity: targetIdentity, bookingId };
      }
      return { ok: false, aborted: true };
    }

    const reqId = ++requestId;
    activeController?.abort();
    const controller = new AbortController();
    activeController = controller;
    activeTarget = { identity: targetIdentity, bookingId };
    interruptedTarget = null;

    const preservedDetail =
      state.identity === targetIdentity && state.bookingId === bookingId
        ? state.detail
        : null;

    emit({
      identity: targetIdentity,
      bookingId,
      status: "loading",
      detail: preservedDetail,
      error: null,
    });

    try {
      const detail = await deps.fetchDetail(bookingId, {
        signal: controller.signal,
      });
      if (
        controller.signal.aborted ||
        requestId !== reqId ||
        liveIdentity !== targetIdentity
      ) {
        return { ok: false, aborted: true };
      }
      interruptedTarget = null;
      emit({
        identity: targetIdentity,
        bookingId,
        status: "ready",
        detail,
        error: null,
      });
      deps.onDetailLoaded?.(targetIdentity, detail);
      return { ok: true, detail };
    } catch (err) {
      if (
        isRequestCancelled(err) ||
        controller.signal.aborted ||
        requestId !== reqId ||
        liveIdentity !== targetIdentity
      ) {
        return { ok: false, aborted: true };
      }
      const info = deps.classifyError(err);
      deps.onErrorInfo?.(info);
      if (info.outcome === "session-ended") {
        interruptedTarget = null;
        emit(EMPTY_BOOKING_DETAIL);
        return { ok: false, notFound: false, error: info };
      }
      if (info.code === "PROVIDER_PROFILE_NOT_FOUND") {
        interruptedTarget = null;
        deps.onProfileNotFound?.();
        emit({
          identity: targetIdentity,
          bookingId,
          status: "error",
          detail: null,
          error: info,
        });
        return { ok: false, notFound: false, error: info };
      }
      if (info.code === "BOOKING_NOT_FOUND") {
        interruptedTarget = null;
        emit({
          identity: targetIdentity,
          bookingId,
          status: "not-found",
          detail: null,
          error: info,
        });
        return { ok: false, notFound: true, error: info };
      }
      const retainedDetail =
        state.identity === targetIdentity && state.bookingId === bookingId
          ? state.detail
          : null;
      interruptedTarget = null;
      emit({
        identity: targetIdentity,
        bookingId,
        status: "error",
        detail: retainedDetail,
        error: info,
      });
      return { ok: false, notFound: false, error: info };
    } finally {
      if (activeController === controller) {
        activeController = null;
        activeTarget = null;
      }
    }
  }

  function interruptForHide() {
    const target =
      activeTarget ??
      (liveIdentity !== null &&
      selectedBookingId !== null &&
      state.identity === liveIdentity &&
      state.bookingId === selectedBookingId &&
      state.status === "loading"
        ? { identity: liveIdentity, bookingId: selectedBookingId }
        : null);

    requestId++;
    const controllerToAbort = activeController;
    activeController = null;
    activeTarget = null;

    if (
      target !== null &&
      target.identity === liveIdentity &&
      target.bookingId === selectedBookingId
    ) {
      interruptedTarget = target;
      if (
        state.identity === target.identity &&
        state.bookingId === target.bookingId &&
        state.status === "loading"
      ) {
        emit({
          ...state,
          status: state.detail !== null ? "ready" : "idle",
        });
      }
    }

    controllerToAbort?.abort();
  }

  function selectAndLoad(identity: string, bookingId: string) {
    liveIdentity = identity;
    selectedBookingId = bookingId;
    return load(bookingId, identity);
  }

  function closeSelection() {
    selectedBookingId = null;
    interruptedTarget = null;
    requestId++;
    const controllerToAbort = activeController;
    activeController = null;
    activeTarget = null;
    controllerToAbort?.abort();
    emit(EMPTY_BOOKING_DETAIL);
  }

  function resetPrivate() {
    liveIdentity = null;
    canFetch = false;
    selectedBookingId = null;
    interruptedTarget = null;
    requestId++;
    const controllerToAbort = activeController;
    activeController = null;
    activeTarget = null;
    controllerToAbort?.abort();
    emit(EMPTY_BOOKING_DETAIL);
  }

  function syncSession(
    params: BookingDetailSyncParams,
  ): Promise<FetchBookingDetailResult> | null {
    const identityChanged =
      liveIdentity !== null &&
      params.identity !== null &&
      liveIdentity !== params.identity;

    liveIdentity = params.identity;
    canFetch = params.canFetch;
    selectedBookingId = params.selectedBookingId;

    if (identityChanged || params.identity === null) {
      interruptedTarget = null;
      if (activeController) {
        requestId++;
        const controllerToAbort = activeController;
        activeController = null;
        activeTarget = null;
        controllerToAbort.abort();
      }
      if (state.identity !== null) {
        emit(EMPTY_BOOKING_DETAIL);
      }
      return null;
    }

    if (params.profileNotFound || params.selectedBookingId === null) {
      if (
        interruptedTarget !== null &&
        (interruptedTarget.identity !== params.identity ||
          interruptedTarget.bookingId !== params.selectedBookingId)
      ) {
        interruptedTarget = null;
      }
      return null;
    }

    if (!params.canFetch) {
      if (
        hasMatchingActive(params.identity, params.selectedBookingId) ||
        (state.identity === params.identity &&
          state.bookingId === params.selectedBookingId &&
          state.status === "loading")
      ) {
        interruptForHide();
      }
      return null;
    }

    const orphanedLoading =
      state.identity === params.identity &&
      state.bookingId === params.selectedBookingId &&
      state.status === "loading" &&
      activeController === null;

    if (
      !hasMatchingActive(params.identity, params.selectedBookingId) &&
      (hasMatchingInterrupted(params.identity, params.selectedBookingId) ||
        orphanedLoading)
    ) {
      return load(params.selectedBookingId, params.identity);
    }

    return null;
  }

  return {
    load,
    selectAndLoad,
    interruptForHide,
    closeSelection,
    resetPrivate,
    syncSession,
    getSnapshot: () => ({
      state,
      interrupted: interruptedTarget !== null,
      inFlight: activeController !== null,
    }),
  };
}
