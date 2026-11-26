import { vi } from "../../lib/locale";
import { matchesSearch, normalizeSearch } from "../../lib/search";
import {
  isValidCalendarDate,
  type ProviderApiErrorInfo,
  type ProviderApprovalStatus,
  type ProviderBooking,
  type ProviderBookingReasonInput,
  type ProviderBookingSlot,
  type ProviderBookingStatus,
} from "../provider-workspace/liveApi";
import type { ProviderLifecyclePermissions } from "../provider-workspace/lifecycle";
import type {
  BookingActionOption,
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
