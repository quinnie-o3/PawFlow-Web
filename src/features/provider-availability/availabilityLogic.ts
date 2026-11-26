import { formatMessage, vi } from "../../lib/locale";
import {
  isValidCalendarDate,
  normalizeTimeToHhMm,
  type CreateAvailabilitySlotInput,
  type CreateWorkingHourInput,
  type DayOfWeek,
  type ProviderApprovalStatus,
  type ProviderAvailabilityServiceRef,
  type ProviderAvailabilitySlot,
  type ProviderService,
  type ProviderSlotStatus,
  type ProviderWorkingHour,
  type UpdateAvailabilitySlotInput,
  type UpdateWorkingHourInput,
} from "../provider-workspace/liveApi";
import type {
  AvailabilitySummaryMetrics,
  ExpectedSlotState,
  ExpectedWorkingHourState,
  PendingSlotUncertain,
  PendingWorkingHourUncertain,
  ProviderApiErrorInfo,
  ReconcileCreateResult,
  ReconcileUpdateResult,
  ResolvedSlotService,
  SlotDialogSessionState,
  SlotDraft,
  SlotEditorState,
  SlotStatusAction,
  SlotUncertainAction,
  SlotValidationErrors,
  VietnamSchedulingClock,
  WeeklyDaySchedule,
  WorkingHourDraft,
  WorkingHourUncertainAction,
  WorkingHourValidationErrors,
  WorkingHoursDialogSessionState,
  WorkingHoursDialogState,
} from "./types";

export const availabilityTimeZone = "Asia/Ho_Chi_Minh";

/** Display order Monday (1) -> Saturday (6) -> Sunday (0), matching BE 0=Sun..6=Sat. */
export const DISPLAY_WEEKDAYS: readonly DayOfWeek[] = [1, 2, 3, 4, 5, 6, 0];

const MAX_INT32 = 2147483647;
const TIME_FLEXIBLE_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;
const POSITIVE_INTEGER_PATTERN = /^\d+$/;

const WEEKDAY_LABELS: Readonly<Record<DayOfWeek, string>> = {
  0: vi.provider.availability.weekdays.sunday,
  1: vi.provider.availability.weekdays.monday,
  2: vi.provider.availability.weekdays.tuesday,
  3: vi.provider.availability.weekdays.wednesday,
  4: vi.provider.availability.weekdays.thursday,
  5: vi.provider.availability.weekdays.friday,
  6: vi.provider.availability.weekdays.saturday,
};

export function getDayOfWeekLabel(dayOfWeek: DayOfWeek): string {
  return WEEKDAY_LABELS[dayOfWeek];
}

export function isValidDayOfWeek(value: unknown): value is DayOfWeek {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= 6
  );
}

/**
 * Parses `HH:mm` or `HH:mm:ss` into seconds since midnight, mirroring
 * `PawFlow-API/src/common/utils/time-of-day.util.ts`.
 */
export function timeToSeconds(value: string): number | null {
  if (!TIME_FLEXIBLE_PATTERN.test(value)) return null;
  const [hours, minutes, seconds = 0] = value.split(":").map(Number);
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Formats persisted `HH:mm:ss` for display: trims `:00` to `HH:mm`, while
 * preserving non-zero seconds if any exist on legacy DB rows.
 */
export function formatTimeHhMm(value: string): string {
  const normalized = normalizeTimeToHhMm(value);
  return normalized ?? value;
}

/**
 * Formats `HH:mm:ss` to `<input type="time">` value (`HH:mm`), keeping non-zero
 * seconds untouched so inputs never silently corrupt legacy data.
 */
export function timeToInputValue(value: string): string {
  return formatTimeHhMm(value);
}

/**
 * Captures the current Asia/Ho_Chi_Minh scheduling clock (date + seconds with
 * milliseconds), independent of host/browser timezone.
 */
export function captureVietnamClock(
  now: Date | string = new Date(),
): VietnamSchedulingClock {
  const date = typeof now === "string" ? new Date(now) : now;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: availabilityTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "00";
  const rawHour = Number(part("hour"));
  const hour = rawHour === 24 ? 0 : rawHour;
  const minute = Number(part("minute"));
  const second = Number(part("second"));
  const ms = date.getUTCMilliseconds();
  const pad = (n: number) => String(n).padStart(2, "0");

  return {
    today: `${part("year")}-${part("month")}-${part("day")}`,
    secondsOfDay: hour * 3600 + minute * 60 + second + ms / 1000,
    hhMm: `${pad(hour)}:${pad(minute)}`,
  };
}

export function localDate(now: Date | string = new Date()): string {
  return captureVietnamClock(now).today;
}

/**
 * Computes `0 = Sunday .. 6 = Saturday` for a strict `YYYY-MM-DD` date in UTC,
 * mirroring `PawFlow-API/src/availability/slot-eligibility.ts` `getDayOfWeek`.
 */
export function getDayOfWeek(slotDate: string): DayOfWeek | null {
  if (!isValidCalendarDate(slotDate)) return null;
  const [year, month, day] = slotDate.split("-").map(Number);
  const date = new Date(Date.UTC(2000, month - 1, day));
  date.setUTCFullYear(year);
  return date.getUTCDay() as DayOfWeek;
}

export function formatAvailabilityDate(
  date: string,
  includeYear = true,
): string {
  if (!isValidCalendarDate(date)) return date;
  const [year, month, day] = date.split("-");
  return includeYear ? `${day}/${month}/${year}` : `${day}/${month}`;
}

export function formatTimeInterval(startTime: string, endTime: string): string {
  return `${formatTimeHhMm(startTime)}–${formatTimeHhMm(endTime)}`;
}

export function formatRanges(
  hours: readonly Pick<ProviderWorkingHour, "startTime" | "endTime">[],
): string {
  if (hours.length === 0) return vi.provider.availability.labels.noHours;
  return hours
    .map((item) => formatTimeInterval(item.startTime, item.endTime))
    .join("  ·  ");
}

function compareWorkingHours(
  a: ProviderWorkingHour,
  b: ProviderWorkingHour,
): number {
  const aStart = timeToSeconds(a.startTime) ?? 0;
  const bStart = timeToSeconds(b.startTime) ?? 0;
  if (aStart !== bStart) return aStart - bStart;
  const aEnd = timeToSeconds(a.endTime) ?? 0;
  const bEnd = timeToSeconds(b.endTime) ?? 0;
  if (aEnd !== bEnd) return aEnd - bEnd;
  return a.id.localeCompare(b.id);
}

export function groupWorkingHoursByDay(
  workingHours: readonly ProviderWorkingHour[],
): WeeklyDaySchedule[] {
  return DISPLAY_WEEKDAYS.map((dayOfWeek) => {
    const forDay = workingHours.filter((item) => item.dayOfWeek === dayOfWeek);
    return {
      dayOfWeek,
      label: getDayOfWeekLabel(dayOfWeek),
      active: forDay
        .filter((item) => item.isActive)
        .sort(compareWorkingHours),
      inactive: forDay
        .filter((item) => !item.isActive)
        .sort(compareWorkingHours),
    };
  });
}

export function isSameWorkingInterval(
  a: Pick<ProviderWorkingHour, "dayOfWeek" | "startTime" | "endTime">,
  b: Pick<ProviderWorkingHour, "dayOfWeek" | "startTime" | "endTime">,
): boolean {
  const aStart = timeToSeconds(a.startTime);
  const bStart = timeToSeconds(b.startTime);
  const aEnd = timeToSeconds(a.endTime);
  const bEnd = timeToSeconds(b.endTime);
  return (
    a.dayOfWeek === b.dayOfWeek &&
    aStart !== null &&
    bStart !== null &&
    aEnd !== null &&
    bEnd !== null &&
    aStart === bStart &&
    aEnd === bEnd
  );
}

/**
 * Mirrors BE `findOverlappingWorkingInterval`: half-open `[start, end)` check
 * against active intervals of the same weekday (adjacent intervals are allowed).
 */
export function findOverlappingWorkingHour(
  candidate: Pick<ProviderWorkingHour, "dayOfWeek" | "startTime" | "endTime">,
  workingHours: readonly ProviderWorkingHour[],
  excludeId?: string,
): ProviderWorkingHour | null {
  const start = timeToSeconds(candidate.startTime);
  const end = timeToSeconds(candidate.endTime);
  if (start === null || end === null || end <= start) return null;

  return (
    workingHours.find((item) => {
      if (!item.isActive) return false;
      if (excludeId !== undefined && item.id === excludeId) return false;
      if (item.dayOfWeek !== candidate.dayOfWeek) return false;
      const itemStart = timeToSeconds(item.startTime);
      const itemEnd = timeToSeconds(item.endTime);
      if (itemStart === null || itemEnd === null) return false;
      return itemStart < end && start < itemEnd;
    }) ?? null
  );
}

/**
 * Finds an inactive working-hour record with the exact same
 * `(dayOfWeek, startTime, endTime)` so adding a shift can reactivate it cleanly
 * via `PATCH { isActive: true }` instead of hitting DB unique `23505`.
 */
export function findExactInactiveWorkingHour(
  candidate: Pick<ProviderWorkingHour, "dayOfWeek" | "startTime" | "endTime">,
  workingHours: readonly ProviderWorkingHour[],
  excludeId?: string,
): ProviderWorkingHour | null {
  return (
    workingHours.find(
      (item) =>
        !item.isActive &&
        (excludeId === undefined || item.id !== excludeId) &&
        isSameWorkingInterval(item, candidate),
    ) ?? null
  );
}

export function workingHourToDraft(
  hour?: ProviderWorkingHour | null,
  defaultDayOfWeek: DayOfWeek = 1,
): WorkingHourDraft {
  if (!hour) {
    return {
      dayOfWeek: defaultDayOfWeek,
      startTime: "09:00",
      endTime: "17:00",
    };
  }
  return {
    dayOfWeek: hour.dayOfWeek,
    startTime: timeToInputValue(hour.startTime),
    endTime: timeToInputValue(hour.endTime),
  };
}

export function hasWorkingHourDraftChanges(
  existing: ProviderWorkingHour,
  draft: WorkingHourDraft,
): boolean {
  const startNorm = normalizeTimeToHhMm(draft.startTime);
  const endNorm = normalizeTimeToHhMm(draft.endTime);
  if (startNorm === null || endNorm === null) return true;
  return !isSameWorkingInterval(existing, {
    dayOfWeek: draft.dayOfWeek,
    startTime: startNorm,
    endTime: endNorm,
  });
}

export function validateWorkingHourDraft(
  draft: WorkingHourDraft,
  workingHours: readonly ProviderWorkingHour[],
  editingWorkingHour?: ProviderWorkingHour | null,
): WorkingHourValidationErrors {
  const errors: Record<string, string> = {};

  if (!isValidDayOfWeek(draft.dayOfWeek)) {
    errors.dayOfWeek = vi.provider.availability.errors.invalidDay;
  }

  const startNorm = normalizeTimeToHhMm(draft.startTime);
  const endNorm = normalizeTimeToHhMm(draft.endTime);

  if (startNorm === null) {
    errors.startTime = vi.provider.availability.errors.invalidTimes;
  }
  if (endNorm === null) {
    errors.endTime = vi.provider.availability.errors.invalidTimes;
  }

  if (startNorm !== null && endNorm !== null) {
    const startSec = timeToSeconds(startNorm);
    const endSec = timeToSeconds(endNorm);
    if (startSec === null || endSec === null || endSec <= startSec) {
      errors.endTime = vi.provider.availability.errors.endAfterStart;
      return errors;
    }

    if (isValidDayOfWeek(draft.dayOfWeek)) {
      const candidate = {
        dayOfWeek: draft.dayOfWeek,
        startTime: startNorm,
        endTime: endNorm,
      };
      const overlap = findOverlappingWorkingHour(
        candidate,
        workingHours,
        editingWorkingHour?.id,
      );
      if (overlap) {
        errors.form = formatMessage(
          vi.provider.availability.errors.workingHourOverlap,
          {
            day: getDayOfWeekLabel(draft.dayOfWeek),
            start: formatTimeHhMm(overlap.startTime),
            end: formatTimeHhMm(overlap.endTime),
          },
        );
        return errors;
      }

      // Gate #1: when editing an existing row A, block/guide clearly if the new
      // (dayOfWeek, startTime, endTime) matches a different inactive row B so
      // PATCH won't hit Postgres unique 23505 (WORKING_HOUR_DUPLICATE).
      if (editingWorkingHour) {
        const duplicateInactive = findExactInactiveWorkingHour(
          candidate,
          workingHours,
          editingWorkingHour.id,
        );
        if (duplicateInactive) {
          errors.form = formatMessage(
            vi.provider.availability.errors.workingHourDuplicateInactive,
            {
              day: getDayOfWeekLabel(draft.dayOfWeek),
              start: startNorm,
              end: endNorm,
            },
          );
          return errors;
        }
      }
    }
  }

  return errors;
}

export type WorkingHourMutationPlan =
  | Readonly<{
      kind: "create";
      input: CreateWorkingHourInput;
      expected: Readonly<{
        dayOfWeek: DayOfWeek;
        startTime: string;
        endTime: string;
        isActive: true;
      }>;
    }>
  | Readonly<{
      kind: "reactivate";
      workingHourId: string;
      input: Readonly<{ isActive: true }>;
      expected: Readonly<{
        dayOfWeek: DayOfWeek;
        startTime: string;
        endTime: string;
        isActive: true;
      }>;
    }>
  | Readonly<{
      kind: "update";
      workingHourId: string;
      input: UpdateWorkingHourInput;
      expected: ExpectedWorkingHourState;
    }>;

/**
 * Builds the exact single-call working-hour mutation plan:
 * - Create matching an existing `isActive: false` row -> `reactivate` via `PATCH { isActive: true }`.
 * - Edit -> sparse `PATCH` containing only changed fields (returns `null` if no-op so `PATCH {}` is never sent).
 */
export function buildWorkingHourMutationPlan(
  draft: WorkingHourDraft,
  workingHours: readonly ProviderWorkingHour[],
  editingWorkingHour?: ProviderWorkingHour | null,
): WorkingHourMutationPlan | null {
  if (
    Object.keys(
      validateWorkingHourDraft(draft, workingHours, editingWorkingHour),
    ).length > 0
  ) {
    return null;
  }

  const startNorm = normalizeTimeToHhMm(draft.startTime);
  const endNorm = normalizeTimeToHhMm(draft.endTime);
  if (!isValidDayOfWeek(draft.dayOfWeek) || startNorm === null || endNorm === null) {
    return null;
  }

  if (editingWorkingHour) {
    const input: {
      dayOfWeek?: DayOfWeek;
      startTime?: string;
      endTime?: string;
    } = {};
    const expected: {
      dayOfWeek?: DayOfWeek;
      startTime?: string;
      endTime?: string;
    } = {};

    if (draft.dayOfWeek !== editingWorkingHour.dayOfWeek) {
      input.dayOfWeek = draft.dayOfWeek;
      expected.dayOfWeek = draft.dayOfWeek;
    }
    if (timeToSeconds(startNorm) !== timeToSeconds(editingWorkingHour.startTime)) {
      input.startTime = startNorm;
      expected.startTime = startNorm;
    }
    if (timeToSeconds(endNorm) !== timeToSeconds(editingWorkingHour.endTime)) {
      input.endTime = endNorm;
      expected.endTime = endNorm;
    }

    if (Object.keys(input).length === 0) {
      return null;
    }

    return {
      kind: "update",
      workingHourId: editingWorkingHour.id,
      input,
      expected,
    };
  }

  const inactiveMatch = findExactInactiveWorkingHour(
    {
      dayOfWeek: draft.dayOfWeek,
      startTime: startNorm,
      endTime: endNorm,
    },
    workingHours,
  );
  if (inactiveMatch) {
    return {
      kind: "reactivate",
      workingHourId: inactiveMatch.id,
      input: { isActive: true },
      expected: {
        dayOfWeek: draft.dayOfWeek,
        startTime: startNorm,
        endTime: endNorm,
        isActive: true,
      },
    };
  }

  return {
    kind: "create",
    input: {
      dayOfWeek: draft.dayOfWeek,
      startTime: startNorm,
      endTime: endNorm,
      isActive: true,
    },
    expected: {
      dayOfWeek: draft.dayOfWeek,
      startTime: startNorm,
      endTime: endNorm,
      isActive: true,
    },
  };
}

/**
 * Mirrors BE `slotFitsWorkingHours`: slot must lie completely inside ONE active
 * working interval of its weekday. Adjacent intervals are never merged.
 */
export function slotFitsWorkingHours(
  slot: Pick<ProviderAvailabilitySlot, "slotDate" | "startTime" | "endTime">,
  workingHours: readonly ProviderWorkingHour[],
): boolean {
  const dayOfWeek = getDayOfWeek(slot.slotDate);
  const start = timeToSeconds(slot.startTime);
  const end = timeToSeconds(slot.endTime);
  if (dayOfWeek === null || start === null || end === null || end <= start) {
    return false;
  }

  return workingHours.some((interval) => {
    if (!interval.isActive || interval.dayOfWeek !== dayOfWeek) return false;
    const iStart = timeToSeconds(interval.startTime);
    const iEnd = timeToSeconds(interval.endTime);
    if (iStart === null || iEnd === null) return false;
    return iStart <= start && end <= iEnd;
  });
}

/**
 * Non-blocking preview mirroring BE `assertScheduleChangeKeepsActiveBookings`:
 * finds slots dated `today` or later with `bookedCount > 0` that currently fit
 * active working hours but would fall outside after a proposed edit/deactivation.
 */
export function findAffectedBookedSlotsForWorkingHourChange(
  current: ProviderWorkingHour,
  next: Pick<
    ProviderWorkingHour,
    "id" | "dayOfWeek" | "startTime" | "endTime" | "isActive"
  >,
  workingHours: readonly ProviderWorkingHour[],
  slots: readonly ProviderAvailabilitySlot[],
  now: Date | string = new Date(),
): ProviderAvailabilitySlot[] {
  if (!current.isActive) return [];

  const today = localDate(now);
  const activeIntervals = workingHours.filter((item) => item.isActive);
  const nextIntervals: ProviderWorkingHour[] = activeIntervals
    .filter((item) => item.id !== current.id)
    .concat(
      next.isActive
        ? [
            {
              ...current,
              dayOfWeek: next.dayOfWeek,
              startTime: next.startTime,
              endTime: next.endTime,
              isActive: true,
            },
          ]
        : [],
    );

  return slots.filter(
    (slot) =>
      slot.bookedCount > 0 &&
      slot.slotDate >= today &&
      slotFitsWorkingHours(slot, activeIntervals) &&
      !slotFitsWorkingHours(slot, nextIntervals),
  );
}

function matchesExpectedWorkingHour(
  item: ProviderWorkingHour,
  expected: ExpectedWorkingHourState,
): boolean {
  if (
    expected.dayOfWeek !== undefined &&
    item.dayOfWeek !== expected.dayOfWeek
  ) {
    return false;
  }
  if (
    expected.startTime !== undefined &&
    timeToSeconds(item.startTime) !== timeToSeconds(expected.startTime)
  ) {
    return false;
  }
  if (
    expected.endTime !== undefined &&
    timeToSeconds(item.endTime) !== timeToSeconds(expected.endTime)
  ) {
    return false;
  }
  if (expected.isActive !== undefined && item.isActive !== expected.isActive) {
    return false;
  }
  return true;
}

export function reconcileWorkingHourCreate(
  expected: Readonly<{
    dayOfWeek: DayOfWeek;
    startTime: string;
    endTime: string;
    isActive: true;
  }>,
  preSubmitIds: readonly string[],
  serverItems: readonly ProviderWorkingHour[],
  approvalStatus?: ProviderApprovalStatus | null,
): ReconcileCreateResult<ProviderWorkingHour> {
  const known = new Set(preSubmitIds);
  const created =
    serverItems.find(
      (item) => !known.has(item.id) && matchesExpectedWorkingHour(item, expected),
    ) ?? null;
  if (created) {
    return { outcome: "created", item: created };
  }
  if (approvalStatus === "REJECTED" || approvalStatus === "SUSPENDED") {
    return { outcome: "forbidden-lifecycle", approvalStatus };
  }
  return { outcome: "not-created" };
}

export function reconcileWorkingHourUpdate(
  workingHourId: string,
  expected: ExpectedWorkingHourState,
  serverItems: readonly ProviderWorkingHour[],
  approvalStatus?: ProviderApprovalStatus | null,
): ReconcileUpdateResult<ProviderWorkingHour> {
  const existing = serverItems.find((item) => item.id === workingHourId);
  if (!existing) {
    return { outcome: "not-found" };
  }
  if (matchesExpectedWorkingHour(existing, expected)) {
    return { outcome: "saved", item: existing };
  }
  if (approvalStatus === "REJECTED" || approvalStatus === "SUSPENDED") {
    return { outcome: "forbidden-lifecycle", approvalStatus };
  }
  return { outcome: "not-saved" };
}

export function reconcileWorkingHourDeactivate(
  workingHourId: string,
  serverItems: readonly ProviderWorkingHour[],
  approvalStatus?: ProviderApprovalStatus | null,
): ReconcileUpdateResult<ProviderWorkingHour> {
  return reconcileWorkingHourUpdate(
    workingHourId,
    { isActive: false },
    serverItems,
    approvalStatus,
  );
}

export function applyLocalWorkingHourMutation(
  current: readonly ProviderWorkingHour[],
  mutation:
    | Readonly<{ kind: "create" | "update"; workingHour: ProviderWorkingHour }>
    | Readonly<{ kind: "deactivate"; workingHourId: string }>,
): ProviderWorkingHour[] {
  const next =
    mutation.kind === "deactivate"
      ? current.map((item) =>
          item.id === mutation.workingHourId
            ? { ...item, isActive: false }
            : item,
        )
      : mutation.kind === "create"
        ? [
            ...current.filter((item) => item.id !== mutation.workingHour.id),
            mutation.workingHour,
          ]
        : current.map((item) =>
            item.id === mutation.workingHour.id ? mutation.workingHour : item,
          );

  return [...next].sort((a, b) => {
    if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
    return compareWorkingHours(a, b);
  });
}

/**
 * Mirrors BE `hasSlotStarted` in `Asia/Ho_Chi_Minh`: true once the slot's start
 * instant is at or before `now` (including seconds and milliseconds).
 */
export function hasSlotStarted(
  slot: Pick<ProviderAvailabilitySlot, "slotDate" | "startTime">,
  now: Date | string = new Date(),
): boolean {
  const clock = captureVietnamClock(now);
  if (slot.slotDate !== clock.today) {
    return slot.slotDate < clock.today;
  }
  const startSeconds = timeToSeconds(slot.startTime);
  if (startSeconds === null) return true;
  return startSeconds <= clock.secondsOfDay;
}

/**
 * Mirrors BE `slotCoversServiceDuration` (P2-08A): `end - start >= durationMinutes`.
 */
export function slotCoversServiceDuration(
  startTime: string,
  endTime: string,
  durationMinutes: number,
): boolean {
  const startSec = timeToSeconds(startTime);
  const endSec = timeToSeconds(endTime);
  if (startSec === null || endSec === null || durationMinutes <= 0) {
    return false;
  }
  return endSec - startSec >= durationMinutes * 60;
}

/**
 * Suggests default `endTime = startTime + durationMinutes` (`HH:mm`).
 * Returns `null` if `startTime` is invalid or if the end would exceed `23:59`
 * (never emits invalid times like `24:30`).
 */
export function suggestSlotEndTime(
  startTime: string,
  durationMinutes: number,
): string | null {
  const normalizedStart = normalizeTimeToHhMm(startTime);
  if (
    normalizedStart === null ||
    !Number.isSafeInteger(durationMinutes) ||
    durationMinutes <= 0
  ) {
    return null;
  }
  const [hours, minutes] = normalizedStart.split(":").map(Number);
  const totalMinutes = hours * 60 + minutes + durationMinutes;
  if (totalMinutes > 23 * 60 + 59) {
    return null;
  }
  const endHours = Math.floor(totalMinutes / 60);
  const endMinutes = totalMinutes % 60;
  return `${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}`;
}

export function resolveSlotService(
  slot: Pick<ProviderAvailabilitySlot, "serviceId" | "service">,
  services: readonly ProviderService[],
): ResolvedSlotService | null {
  const fromList = services.find((item) => item.id === slot.serviceId);
  if (fromList) {
    return {
      id: fromList.id,
      name: fromList.name,
      durationMinutes: fromList.durationMinutes,
      status: fromList.status,
      source: "services-list",
    };
  }
  if (slot.service) {
    return {
      id: slot.service.id,
      name: slot.service.name,
      durationMinutes: slot.service.durationMinutes,
      status: slot.service.status,
      source: "slot-relation",
    };
  }
  return null;
}

export function isSameSlotSchedule(
  a: Pick<
    ProviderAvailabilitySlot,
    "serviceId" | "slotDate" | "startTime" | "endTime"
  >,
  b: Pick<
    ProviderAvailabilitySlot,
    "serviceId" | "slotDate" | "startTime" | "endTime"
  >,
): boolean {
  const aStart = timeToSeconds(a.startTime);
  const bStart = timeToSeconds(b.startTime);
  const aEnd = timeToSeconds(a.endTime);
  const bEnd = timeToSeconds(b.endTime);
  return (
    a.serviceId === b.serviceId &&
    a.slotDate === b.slotDate &&
    aStart !== null &&
    bStart !== null &&
    aEnd !== null &&
    bEnd !== null &&
    aStart === bStart &&
    aEnd === bEnd
  );
}

export function findDuplicateSlot(
  candidate: Pick<
    ProviderAvailabilitySlot,
    "serviceId" | "slotDate" | "startTime" | "endTime"
  >,
  slots: readonly ProviderAvailabilitySlot[],
  excludeId?: string,
): ProviderAvailabilitySlot | null {
  return (
    slots.find(
      (item) =>
        (excludeId === undefined || item.id !== excludeId) &&
        isSameSlotSchedule(item, candidate),
    ) ?? null
  );
}

export function slotToDraft(
  slot?: ProviderAvailabilitySlot | null,
  defaultDate?: string,
  defaultServiceId = "",
): SlotDraft {
  if (!slot) {
    return {
      serviceId: defaultServiceId,
      slotDate: defaultDate ?? localDate(),
      startTime: "",
      endTime: "",
      capacity: "1",
    };
  }
  return {
    serviceId: slot.serviceId,
    slotDate: slot.slotDate,
    startTime: timeToInputValue(slot.startTime),
    endTime: timeToInputValue(slot.endTime),
    capacity: String(slot.capacity),
  };
}

function parseCapacityInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!POSITIVE_INTEGER_PATTERN.test(trimmed)) return null;
  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > MAX_INT32) {
    return null;
  }
  return parsed;
}

export function isSlotScheduleLocked(
  slot: ProviderAvailabilitySlot,
  now: Date | string = new Date(),
): boolean {
  return slot.bookedCount > 0 || hasSlotStarted(slot, now);
}

export function hasSlotDraftChanges(
  existing: ProviderAvailabilitySlot,
  draft: SlotDraft,
  now: Date | string = new Date(),
): boolean {
  const capacity = parseCapacityInput(draft.capacity);
  if (capacity === null || capacity !== existing.capacity) return true;

  if (isSlotScheduleLocked(existing, now)) {
    return false;
  }

  if (draft.serviceId !== existing.serviceId) return true;
  if (draft.slotDate !== existing.slotDate) return true;

  const startNorm = normalizeTimeToHhMm(draft.startTime);
  const endNorm = normalizeTimeToHhMm(draft.endTime);
  if (startNorm === null || endNorm === null) return true;
  if (timeToSeconds(startNorm) !== timeToSeconds(existing.startTime)) {
    return true;
  }
  if (timeToSeconds(endNorm) !== timeToSeconds(existing.endTime)) {
    return true;
  }

  return false;
}

export function validateSlotDraft(
  draft: SlotDraft,
  context: Readonly<{
    services: readonly ProviderService[];
    workingHours: readonly ProviderWorkingHour[];
    slots: readonly ProviderAvailabilitySlot[];
    editingSlot?: ProviderAvailabilitySlot | null;
    now?: Date | string;
  }>,
): SlotValidationErrors {
  const now = context.now ?? new Date();
  const clock = captureVietnamClock(now);
  const existing = context.editingSlot ?? null;
  const errors: Record<string, string> = {};

  const capacity = parseCapacityInput(draft.capacity);
  if (capacity === null) {
    errors.capacity = vi.provider.availability.errors.invalidCapacity;
  } else if (existing && capacity < existing.bookedCount) {
    errors.capacity = formatMessage(
      vi.provider.availability.errors.capacityBelowBooked,
      { booked: existing.bookedCount },
    );
  }

  // If editing a slot whose 4 schedule fields are locked (bookedCount > 0 or
  // already started), only capacity is validated and patched.
  if (existing && isSlotScheduleLocked(existing, now)) {
    return errors;
  }

  const startNorm = normalizeTimeToHhMm(draft.startTime);
  const endNorm = normalizeTimeToHhMm(draft.endTime);
  const scheduleChanging =
    !existing ||
    draft.serviceId !== existing.serviceId ||
    draft.slotDate !== existing.slotDate ||
    startNorm === null ||
    endNorm === null ||
    timeToSeconds(startNorm) !== timeToSeconds(existing.startTime) ||
    timeToSeconds(endNorm) !== timeToSeconds(existing.endTime);

  // If editing an unlocked slot and only capacity changed, skip schedule
  // re-validation so providers can adjust capacity even if service went INACTIVE
  // or working hours changed later (matching BE sparse PATCH).
  if (existing && !scheduleChanging) {
    return errors;
  }

  const selectedService = context.services.find(
    (item) => item.id === draft.serviceId,
  );
  const fallbackService =
    !selectedService &&
    existing &&
    existing.serviceId === draft.serviceId &&
    existing.service
      ? existing.service
      : null;
  const effectiveService = selectedService ?? fallbackService;

  if (!draft.serviceId || !effectiveService) {
    errors.serviceId = vi.provider.availability.errors.invalidService;
  } else if (
    (!existing || draft.serviceId !== existing.serviceId) &&
    effectiveService.status !== "ACTIVE"
  ) {
    errors.serviceId = vi.provider.availability.errors.inactiveService;
  }

  const validDate = isValidCalendarDate(draft.slotDate);
  if (!validDate) {
    errors.slotDate = vi.provider.availability.errors.invalidDate;
  } else if (draft.slotDate < clock.today) {
    errors.slotDate = vi.provider.availability.errors.slotInPast;
  }

  if (startNorm === null) {
    errors.startTime = vi.provider.availability.errors.invalidTimes;
  }
  if (endNorm === null) {
    errors.endTime = vi.provider.availability.errors.invalidTimes;
  }

  if (startNorm !== null && endNorm !== null) {
    const startSec = timeToSeconds(startNorm);
    const endSec = timeToSeconds(endNorm);
    if (startSec === null || endSec === null || endSec <= startSec) {
      errors.endTime = vi.provider.availability.errors.endAfterStart;
      return errors;
    }

    if (validDate && draft.slotDate >= clock.today) {
      if (
        hasSlotStarted(
          { slotDate: draft.slotDate, startTime: startNorm },
          now,
        )
      ) {
        errors.startTime = vi.provider.availability.errors.slotStarted;
        return errors;
      }
    }

    if (
      effectiveService &&
      !slotCoversServiceDuration(
        startNorm,
        endNorm,
        effectiveService.durationMinutes,
      )
    ) {
      errors.endTime = formatMessage(
        vi.provider.availability.errors.slotTooShort,
        { minutes: effectiveService.durationMinutes },
      );
      return errors;
    }

    if (validDate && draft.slotDate >= clock.today) {
      const dayOfWeek = getDayOfWeek(draft.slotDate);
      if (
        dayOfWeek !== null &&
        !slotFitsWorkingHours(
          {
            slotDate: draft.slotDate,
            startTime: startNorm,
            endTime: endNorm,
          },
          context.workingHours,
        )
      ) {
        errors.form = formatMessage(
          vi.provider.availability.errors.slotOutsideWorkingHours,
          { day: getDayOfWeekLabel(dayOfWeek) },
        );
        return errors;
      }

      if (draft.serviceId) {
        const duplicate = findDuplicateSlot(
          {
            serviceId: draft.serviceId,
            slotDate: draft.slotDate,
            startTime: startNorm,
            endTime: endNorm,
          },
          context.slots,
          existing?.id,
        );
        if (duplicate) {
          errors.form = formatMessage(
            vi.provider.availability.errors.slotDuplicate,
            { start: startNorm, end: endNorm },
          );
          return errors;
        }
      }
    }
  }

  return errors;
}

export function buildCreateSlotPayload(
  draft: SlotDraft,
): Readonly<{
  input: CreateAvailabilitySlotInput;
  expected: Readonly<{
    serviceId: string;
    slotDate: string;
    startTime: string;
    endTime: string;
    capacity: number;
  }>;
}> | null {
  const startTime = normalizeTimeToHhMm(draft.startTime);
  const endTime = normalizeTimeToHhMm(draft.endTime);
  const capacity = parseCapacityInput(draft.capacity);
  if (
    !draft.serviceId ||
    !isValidCalendarDate(draft.slotDate) ||
    startTime === null ||
    endTime === null ||
    capacity === null ||
    endTime <= startTime
  ) {
    return null;
  }
  const input: CreateAvailabilitySlotInput = {
    serviceId: draft.serviceId,
    slotDate: draft.slotDate,
    startTime,
    endTime,
    capacity,
  };
  return { input, expected: input };
}

/**
 * Builds a strictly sparse `PATCH /availability/mine/:id` payload containing
 * ONLY changed fields:
 * - Never includes `serviceId`, `slotDate`, `startTime`, `endTime` when
 *   `bookedCount > 0` or the slot has already started (avoiding BE 409/400).
 * - Never re-sends unchanged `serviceId` (allowing capacity/status edits when
 *   the slot's service is now `INACTIVE`).
 * - Returns an empty `input` object when nothing changed so callers never emit
 *   an empty `PATCH {}`.
 */
export function buildUpdateSlotPatch(
  existing: ProviderAvailabilitySlot,
  draft: SlotDraft,
  now: Date | string = new Date(),
): Readonly<{
  input: UpdateAvailabilitySlotInput;
  expected: ExpectedSlotState;
}> {
  const input: {
    serviceId?: string;
    slotDate?: string;
    startTime?: string;
    endTime?: string;
    capacity?: number;
  } = {};
  const expected: {
    serviceId?: string;
    slotDate?: string;
    startTime?: string;
    endTime?: string;
    capacity?: number;
  } = {};

  const capacity = parseCapacityInput(draft.capacity);
  if (capacity !== null && capacity !== existing.capacity) {
    input.capacity = capacity;
    expected.capacity = capacity;
  }

  if (!isSlotScheduleLocked(existing, now)) {
    if (draft.serviceId && draft.serviceId !== existing.serviceId) {
      input.serviceId = draft.serviceId;
      expected.serviceId = draft.serviceId;
    }
    if (
      isValidCalendarDate(draft.slotDate) &&
      draft.slotDate !== existing.slotDate
    ) {
      input.slotDate = draft.slotDate;
      expected.slotDate = draft.slotDate;
    }
    const startNorm = normalizeTimeToHhMm(draft.startTime);
    if (
      startNorm !== null &&
      timeToSeconds(startNorm) !== timeToSeconds(existing.startTime)
    ) {
      input.startTime = startNorm;
      expected.startTime = startNorm;
    }
    const endNorm = normalizeTimeToHhMm(draft.endTime);
    if (
      endNorm !== null &&
      timeToSeconds(endNorm) !== timeToSeconds(existing.endTime)
    ) {
      input.endTime = endNorm;
      expected.endTime = endNorm;
    }
  }

  return { input, expected };
}

/**
 * Mirrors BE `updateMySlot` reopen checks (`status: "OPEN"` from `CLOSED` or
 * `CANCELLED`): slot must not have started in `Asia/Ho_Chi_Minh`, must cover
 * its service's `durationMinutes`, and must fit an active working-hour entry.
 * Note: BE does NOT reject reopening when `service.status === 'INACTIVE'`
 * (because `dto.serviceId` is omitted), so we expose `serviceInactiveWarning`
 * instead of falsely blocking a valid reopen.
 */
export function canReopenSlot(
  slot: ProviderAvailabilitySlot,
  services: readonly ProviderService[],
  workingHours: readonly ProviderWorkingHour[],
  now: Date | string = new Date(),
):
  | Readonly<{ allowed: true; serviceInactiveWarning: boolean }>
  | Readonly<{ allowed: false; reason: string }> {
  if (hasSlotStarted(slot, now)) {
    return {
      allowed: false,
      reason: vi.provider.availability.errors.cannotReopenStarted,
    };
  }

  const resolvedService = resolveSlotService(slot, services);
  if (
    resolvedService &&
    !slotCoversServiceDuration(
      slot.startTime,
      slot.endTime,
      resolvedService.durationMinutes,
    )
  ) {
    return {
      allowed: false,
      reason: formatMessage(
        vi.provider.availability.errors.cannotReopenTooShort,
        { minutes: resolvedService.durationMinutes },
      ),
    };
  }

  if (!slotFitsWorkingHours(slot, workingHours)) {
    const dayOfWeek = getDayOfWeek(slot.slotDate);
    return {
      allowed: false,
      reason: formatMessage(
        vi.provider.availability.errors.cannotReopenOutsideHours,
        {
          day:
            dayOfWeek !== null
              ? getDayOfWeekLabel(dayOfWeek)
              : formatAvailabilityDate(slot.slotDate),
        },
      ),
    };
  }

  return {
    allowed: true,
    serviceInactiveWarning: resolvedService?.status === "INACTIVE",
  };
}

function matchesExpectedSlot(
  item: ProviderAvailabilitySlot,
  expected: ExpectedSlotState,
): boolean {
  if (expected.serviceId !== undefined && item.serviceId !== expected.serviceId) {
    return false;
  }
  if (expected.slotDate !== undefined && item.slotDate !== expected.slotDate) {
    return false;
  }
  if (
    expected.startTime !== undefined &&
    timeToSeconds(item.startTime) !== timeToSeconds(expected.startTime)
  ) {
    return false;
  }
  if (
    expected.endTime !== undefined &&
    timeToSeconds(item.endTime) !== timeToSeconds(expected.endTime)
  ) {
    return false;
  }
  if (expected.capacity !== undefined && item.capacity !== expected.capacity) {
    return false;
  }
  if (expected.status !== undefined && item.status !== expected.status) {
    return false;
  }
  return true;
}

export function reconcileSlotCreate(
  expected: Readonly<{
    serviceId: string;
    slotDate: string;
    startTime: string;
    endTime: string;
    capacity: number;
  }>,
  preSubmitIds: readonly string[],
  serverSlots: readonly ProviderAvailabilitySlot[],
  approvalStatus?: ProviderApprovalStatus | null,
): ReconcileCreateResult<ProviderAvailabilitySlot> {
  const known = new Set(preSubmitIds);
  const created =
    serverSlots.find(
      (item) => !known.has(item.id) && matchesExpectedSlot(item, expected),
    ) ?? null;
  if (created) {
    return { outcome: "created", item: created };
  }
  if (approvalStatus === "REJECTED" || approvalStatus === "SUSPENDED") {
    return { outcome: "forbidden-lifecycle", approvalStatus };
  }
  return { outcome: "not-created" };
}

export function reconcileSlotUpdate(
  slotId: string,
  expected: ExpectedSlotState,
  serverSlots: readonly ProviderAvailabilitySlot[],
  approvalStatus?: ProviderApprovalStatus | null,
): ReconcileUpdateResult<ProviderAvailabilitySlot> {
  const existing = serverSlots.find((item) => item.id === slotId);
  if (!existing) {
    return { outcome: "not-found" };
  }
  if (matchesExpectedSlot(existing, expected)) {
    return { outcome: "saved", item: existing };
  }
  if (approvalStatus === "REJECTED" || approvalStatus === "SUSPENDED") {
    return { outcome: "forbidden-lifecycle", approvalStatus };
  }
  return { outcome: "not-saved" };
}

export function reconcileSlotCancel(
  slotId: string,
  serverSlots: readonly ProviderAvailabilitySlot[],
  approvalStatus?: ProviderApprovalStatus | null,
): ReconcileUpdateResult<ProviderAvailabilitySlot> {
  return reconcileSlotUpdate(
    slotId,
    { status: "CANCELLED" },
    serverSlots,
    approvalStatus,
  );
}

function toAvailabilityServiceRef(
  service: ProviderService,
): ProviderAvailabilityServiceRef {
  return {
    id: service.id,
    categoryId: service.categoryId,
    name: service.name,
    price: service.price,
    durationMinutes: service.durationMinutes,
    description: service.description,
    status: service.status,
  };
}

function compareSlotsChronologically(
  a: ProviderAvailabilitySlot,
  b: ProviderAvailabilitySlot,
): number {
  if (a.slotDate !== b.slotDate) {
    return a.slotDate.localeCompare(b.slotDate);
  }
  const aStart = timeToSeconds(a.startTime) ?? 0;
  const bStart = timeToSeconds(b.startTime) ?? 0;
  if (aStart !== bStart) return aStart - bStart;
  const aEnd = timeToSeconds(a.endTime) ?? 0;
  const bEnd = timeToSeconds(b.endTime) ?? 0;
  if (aEnd !== bEnd) return aEnd - bEnd;
  return a.id.localeCompare(b.id);
}

/**
 * Fallback local merge used only when a slot mutation succeeded on the server
 * but the follow-up `GET /availability/mine` failed transiently. Attaches the
 * joined `service` ref from `services` or the previous row so UI never loses
 * service name or duration.
 */
export function applyLocalSlotMutation(
  current: readonly ProviderAvailabilitySlot[],
  mutation:
    | Readonly<{ kind: "create" | "update"; slot: ProviderAvailabilitySlot }>
    | Readonly<{ kind: "cancel"; slotId: string }>,
  services: readonly ProviderService[],
): ProviderAvailabilitySlot[] {
  if (mutation.kind === "cancel") {
    return current.map((item) =>
      item.id === mutation.slotId
        ? { ...item, status: "CANCELLED" as ProviderSlotStatus }
        : item,
    );
  }

  const previous = current.find((item) => item.id === mutation.slot.id);
  const serviceFromList = services.find(
    (item) => item.id === mutation.slot.serviceId,
  );
  const resolvedRef: ProviderAvailabilityServiceRef | null =
    mutation.slot.service ??
    (serviceFromList
      ? toAvailabilityServiceRef(serviceFromList)
      : previous && previous.serviceId === mutation.slot.serviceId
        ? previous.service
        : null);

  const hydrated: ProviderAvailabilitySlot = {
    ...mutation.slot,
    service: resolvedRef,
  };

  const next =
    mutation.kind === "create"
      ? [...current.filter((item) => item.id !== hydrated.id), hydrated]
      : current.map((item) => (item.id === hydrated.id ? hydrated : item));

  return [...next].sort(compareSlotsChronologically);
}

export function upcomingSlots(
  slots: readonly ProviderAvailabilitySlot[],
  now: Date | string = new Date(),
): ProviderAvailabilitySlot[] {
  return slots
    .filter((slot) => !hasSlotStarted(slot, now))
    .sort(compareSlotsChronologically);
}

export function sortSlotsForDisplay(
  slots: readonly ProviderAvailabilitySlot[],
  now: Date | string = new Date(),
): ProviderAvailabilitySlot[] {
  const future: ProviderAvailabilitySlot[] = [];
  const past: ProviderAvailabilitySlot[] = [];
  for (const slot of slots) {
    if (hasSlotStarted(slot, now)) {
      past.push(slot);
    } else {
      future.push(slot);
    }
  }
  future.sort(compareSlotsChronologically);
  past.sort((a, b) => compareSlotsChronologically(b, a));
  return [...future, ...past];
}

function addDaysToCalendarDate(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(2000, month - 1, day + days));
  date.setUTCFullYear(year);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function isSlotWithinNextDays(
  slot: Pick<ProviderAvailabilitySlot, "slotDate" | "startTime">,
  days: number,
  now: Date | string = new Date(),
): boolean {
  if (hasSlotStarted(slot, now)) return false;
  const clock = captureVietnamClock(now);
  const endDate = addDaysToCalendarDate(clock.today, days);
  if (slot.slotDate < endDate) return true;
  if (slot.slotDate > endDate) return false;
  const startSec = timeToSeconds(slot.startTime);
  return startSec !== null && startSec < clock.secondsOfDay;
}

export function isSlotBookableUnderSchedule(
  slot: ProviderAvailabilitySlot,
  workingHours: readonly ProviderWorkingHour[],
  services: readonly ProviderService[],
  now: Date | string = new Date(),
): boolean {
  if (slot.status !== "OPEN") return false;
  if (slot.bookedCount >= slot.capacity) return false;
  if (hasSlotStarted(slot, now)) return false;
  const resolvedService = resolveSlotService(slot, services);
  if (resolvedService) {
    if (resolvedService.status !== "ACTIVE") return false;
    if (
      !slotCoversServiceDuration(
        slot.startTime,
        slot.endTime,
        resolvedService.durationMinutes,
      )
    ) {
      return false;
    }
  }
  return slotFitsWorkingHours(slot, workingHours);
}

export function summarizeAvailability(
  workingHours: readonly ProviderWorkingHour[],
  slots: readonly ProviderAvailabilitySlot[],
  services: readonly ProviderService[],
  now: Date | string = new Date(),
): AvailabilitySummaryMetrics {
  const next7Days = slots.filter((slot) => isSlotWithinNextDays(slot, 7, now));
  const openSlotsNext7Days = next7Days.filter((slot) =>
    isSlotBookableUnderSchedule(slot, workingHours, services, now),
  ).length;
  const heldBookingsNext7Days = next7Days.reduce(
    (sum, slot) => sum + slot.bookedCount,
    0,
  );
  const activeShifts = workingHours.filter((item) => item.isActive);
  const activeDaysCount = new Set(activeShifts.map((item) => item.dayOfWeek))
    .size;

  return {
    openSlotsNext7Days,
    heldBookingsNext7Days,
    activeDaysCount,
    activeShiftsCount: activeShifts.length,
  };
}

export const INITIAL_WORKING_HOURS_SESSION: WorkingHoursDialogSessionState = {
  dialogOpen: false,
  dialog: null,
  pendingUncertain: null,
};

export const INITIAL_SLOT_DIALOG_SESSION: SlotDialogSessionState = {
  dialogOpen: false,
  editor: null,
  pendingUncertain: null,
};

export function buildWorkingHoursDialogFromPending(
  pending: PendingWorkingHourUncertain,
): WorkingHoursDialogState {
  return {
    identity: pending.identity,
    mode: pending.mode,
    editingId: pending.editingId,
    draft: pending.draft,
    errors: {},
    saving: false,
    mutatingRowId: null,
    confirmDeactivateId: null,
    reconciling: false,
    error: pending.error,
    uncertain: pending.uncertain,
    reconcileNote: pending.reconcileNote,
    inlineFeedback: null,
  };
}

export function enterWorkingHoursUncertainSession(
  state: WorkingHoursDialogSessionState,
  params: Readonly<{
    attemptIdentity: string;
    mode: "create" | "edit";
    editingId: string | null;
    draft: WorkingHourDraft;
    uncertain: WorkingHourUncertainAction;
    error: ProviderApiErrorInfo;
  }>,
): WorkingHoursDialogSessionState {
  const pending: PendingWorkingHourUncertain = {
    identity: params.attemptIdentity,
    mode: params.mode,
    editingId: params.editingId,
    draft: params.draft,
    uncertain: params.uncertain,
    error: params.error,
    reconcileNote: null,
  };
  const base =
    state.dialog && state.dialog.identity === params.attemptIdentity
      ? state.dialog
      : buildWorkingHoursDialogFromPending(pending);
  return {
    dialogOpen: state.dialogOpen,
    pendingUncertain: pending,
    dialog: {
      ...base,
      mode: params.mode,
      editingId: params.editingId,
      draft: params.draft,
      saving: false,
      mutatingRowId: null,
      confirmDeactivateId: null,
      reconciling: false,
      error: params.error,
      uncertain: params.uncertain,
      reconcileNote: null,
    },
  };
}

export function recoverAbortedWorkingHoursMutation(
  state: WorkingHoursDialogSessionState,
  params: Readonly<{
    attemptIdentity: string;
    liveIdentity: string | null;
    mode: "create" | "edit";
    editingId: string | null;
    draft: WorkingHourDraft;
    uncertain: WorkingHourUncertainAction;
    error: ProviderApiErrorInfo;
  }>,
): WorkingHoursDialogSessionState {
  if (params.liveIdentity !== params.attemptIdentity) {
    return INITIAL_WORKING_HOURS_SESSION;
  }
  return enterWorkingHoursUncertainSession(state, params);
}

export function recoverAbortedWorkingHoursReconcile(
  state: WorkingHoursDialogSessionState,
  attemptIdentity: string,
  liveIdentity: string | null,
): WorkingHoursDialogSessionState {
  if (liveIdentity !== attemptIdentity) {
    return INITIAL_WORKING_HOURS_SESSION;
  }
  return {
    ...state,
    dialog:
      state.dialog && state.dialog.identity === attemptIdentity
        ? { ...state.dialog, reconciling: false }
        : state.dialog,
  };
}

export function closeWorkingHoursDialogSession(
  state: WorkingHoursDialogSessionState,
): WorkingHoursDialogSessionState {
  if (
    state.dialog &&
    (state.dialog.saving ||
      state.dialog.mutatingRowId !== null ||
      state.dialog.reconciling)
  ) {
    return state;
  }
  if (state.pendingUncertain !== null) {
    return {
      dialogOpen: false,
      dialog: state.dialog ?? buildWorkingHoursDialogFromPending(state.pendingUncertain),
      pendingUncertain: state.pendingUncertain,
    };
  }
  return INITIAL_WORKING_HOURS_SESSION;
}

export function openWorkingHoursDialogSession(
  state: WorkingHoursDialogSessionState,
  identity: string,
): WorkingHoursDialogSessionState {
  if (
    state.pendingUncertain !== null &&
    state.pendingUncertain.identity === identity
  ) {
    return {
      dialogOpen: true,
      dialog: buildWorkingHoursDialogFromPending(state.pendingUncertain),
      pendingUncertain: state.pendingUncertain,
    };
  }
  return {
    dialogOpen: true,
    pendingUncertain: null,
    dialog: {
      identity,
      mode: "create",
      editingId: null,
      draft: workingHourToDraft(null, 1),
      errors: {},
      saving: false,
      mutatingRowId: null,
      confirmDeactivateId: null,
      reconciling: false,
      error: null,
      uncertain: null,
      reconcileNote: null,
      inlineFeedback: null,
    },
  };
}

export function reopenPendingWorkingHoursSession(
  state: WorkingHoursDialogSessionState,
  identity: string,
): WorkingHoursDialogSessionState {
  if (
    state.pendingUncertain === null ||
    state.pendingUncertain.identity !== identity
  ) {
    return state;
  }
  const existing =
    state.dialog && state.dialog.identity === identity ? state.dialog : null;
  return {
    dialogOpen: true,
    pendingUncertain: state.pendingUncertain,
    dialog: existing ?? buildWorkingHoursDialogFromPending(state.pendingUncertain),
  };
}

export function buildSlotEditorFromPending(
  pending: PendingSlotUncertain,
): SlotEditorState {
  const isStatus =
    pending.uncertain.kind === "status" || pending.uncertain.kind === "cancel";
  return {
    identity: pending.identity,
    mode: pending.mode,
    slotId: pending.slotId,
    draft: pending.draft,
    autoEndTime: pending.autoEndTime,
    errors: {},
    saving: false,
    updatingStatus: false,
    reconciling: false,
    confirmAction: pending.confirmAction,
    saveError: isStatus ? null : pending.error,
    statusError: isStatus ? pending.error : null,
    uncertain: pending.uncertain,
    reconcileNote: pending.reconcileNote,
    statusFeedback: null,
  };
}

export function enterSlotUncertainSession(
  state: SlotDialogSessionState,
  params: Readonly<{
    attemptIdentity: string;
    mode: "create" | "edit";
    slotId: string | null;
    draft: SlotDraft;
    autoEndTime: boolean;
    confirmAction: SlotStatusAction | null;
    uncertain: SlotUncertainAction;
    error: ProviderApiErrorInfo;
  }>,
): SlotDialogSessionState {
  const pending: PendingSlotUncertain = {
    identity: params.attemptIdentity,
    mode: params.mode,
    slotId: params.slotId,
    draft: params.draft,
    autoEndTime: params.autoEndTime,
    confirmAction: params.confirmAction,
    uncertain: params.uncertain,
    error: params.error,
    reconcileNote: null,
  };
  const base =
    state.editor && state.editor.identity === params.attemptIdentity
      ? state.editor
      : buildSlotEditorFromPending(pending);
  const isStatus =
    params.uncertain.kind === "status" || params.uncertain.kind === "cancel";
  return {
    dialogOpen: state.dialogOpen,
    pendingUncertain: pending,
    editor: {
      ...base,
      mode: params.mode,
      slotId: params.slotId,
      draft: params.draft,
      autoEndTime: params.autoEndTime,
      saving: false,
      updatingStatus: false,
      reconciling: false,
      confirmAction: params.confirmAction,
      saveError: isStatus ? null : params.error,
      statusError: isStatus ? params.error : null,
      uncertain: params.uncertain,
      reconcileNote: null,
    },
  };
}

export function recoverAbortedSlotMutation(
  state: SlotDialogSessionState,
  params: Readonly<{
    attemptIdentity: string;
    liveIdentity: string | null;
    mode: "create" | "edit";
    slotId: string | null;
    draft: SlotDraft;
    autoEndTime: boolean;
    confirmAction: SlotStatusAction | null;
    uncertain: SlotUncertainAction;
    error: ProviderApiErrorInfo;
  }>,
): SlotDialogSessionState {
  if (params.liveIdentity !== params.attemptIdentity) {
    return INITIAL_SLOT_DIALOG_SESSION;
  }
  return enterSlotUncertainSession(state, params);
}

export function recoverAbortedSlotReconcile(
  state: SlotDialogSessionState,
  attemptIdentity: string,
  liveIdentity: string | null,
): SlotDialogSessionState {
  if (liveIdentity !== attemptIdentity) {
    return INITIAL_SLOT_DIALOG_SESSION;
  }
  return {
    ...state,
    editor:
      state.editor && state.editor.identity === attemptIdentity
        ? { ...state.editor, reconciling: false }
        : state.editor,
  };
}

export function closeSlotDialogSession(
  state: SlotDialogSessionState,
): SlotDialogSessionState {
  if (
    state.editor &&
    (state.editor.saving ||
      state.editor.updatingStatus ||
      state.editor.reconciling)
  ) {
    return state;
  }
  if (state.pendingUncertain !== null) {
    return {
      dialogOpen: false,
      editor: state.editor ?? buildSlotEditorFromPending(state.pendingUncertain),
      pendingUncertain: state.pendingUncertain,
    };
  }
  return INITIAL_SLOT_DIALOG_SESSION;
}

export function openCreateSlotDialogSession(
  state: SlotDialogSessionState,
  identity: string,
  defaultDate: string,
  defaultServiceId: string,
): SlotDialogSessionState {
  if (
    state.pendingUncertain !== null &&
    state.pendingUncertain.identity === identity
  ) {
    return {
      dialogOpen: true,
      editor: buildSlotEditorFromPending(state.pendingUncertain),
      pendingUncertain: state.pendingUncertain,
    };
  }
  return {
    dialogOpen: true,
    pendingUncertain: null,
    editor: {
      identity,
      mode: "create",
      slotId: null,
      draft: slotToDraft(null, defaultDate, defaultServiceId),
      autoEndTime: true,
      errors: {},
      saving: false,
      updatingStatus: false,
      reconciling: false,
      confirmAction: null,
      saveError: null,
      statusError: null,
      uncertain: null,
      reconcileNote: null,
      statusFeedback: null,
    },
  };
}

export function openEditSlotDialogSession(
  state: SlotDialogSessionState,
  identity: string,
  target: ProviderAvailabilitySlot,
): SlotDialogSessionState {
  if (
    state.pendingUncertain !== null &&
    state.pendingUncertain.identity === identity
  ) {
    return {
      dialogOpen: true,
      editor: buildSlotEditorFromPending(state.pendingUncertain),
      pendingUncertain: state.pendingUncertain,
    };
  }
  return {
    dialogOpen: true,
    pendingUncertain: null,
    editor: {
      identity,
      mode: "edit",
      slotId: target.id,
      draft: slotToDraft(target),
      autoEndTime: false,
      errors: {},
      saving: false,
      updatingStatus: false,
      reconciling: false,
      confirmAction: null,
      saveError: null,
      statusError: null,
      uncertain: null,
      reconcileNote: null,
      statusFeedback: null,
    },
  };
}

export function reopenPendingSlotSession(
  state: SlotDialogSessionState,
  identity: string,
): SlotDialogSessionState {
  if (
    state.pendingUncertain === null ||
    state.pendingUncertain.identity !== identity
  ) {
    return state;
  }
  const existing =
    state.editor && state.editor.identity === identity ? state.editor : null;
  return {
    dialogOpen: true,
    pendingUncertain: state.pendingUncertain,
    editor: existing ?? buildSlotEditorFromPending(state.pendingUncertain),
  };
}
