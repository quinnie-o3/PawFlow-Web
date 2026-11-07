import { vi, formatMessage } from "../../lib/locale";
import type { AvailabilityCommand, AvailabilitySlot, AvailabilityState, SlotReservation, TimeRange, WeeklyDay } from "./types";

export const availabilityTimeZone = "Asia/Ho_Chi_Minh";
export function occupiesSeat(reservation: SlotReservation) {
  return reservation.status === "pendingConfirmation" || reservation.status === "confirmed";
}
export function heldSeats(slotId: string, reservations: SlotReservation[]) {
  return reservations.filter((item) => item.slotId === slotId && occupiesSeat(item)).length;
}
export function localDate(now: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: availabilityTimeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(now));
  const part = (key: string) => parts.find((item) => item.type === key)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function formatAvailabilityDate(date: string, includeYear = true) {
  const parts = new Intl.DateTimeFormat("vi-VN", { timeZone: availabilityTimeZone, day: "2-digit", month: "2-digit", year: "numeric" }).formatToParts(new Date(`${date}T12:00:00+07:00`));
  const part = (key: string) => parts.find((item) => item.type === key)!.value;
  return `${part("day")}/${part("month")}${includeYear ? `/${part("year")}` : ""}`;
}
export function formatRanges(ranges: TimeRange[]) {
  return ranges.length ? ranges.map((range) => `${range.start}–${range.end}`).join("  ·  ") : vi.provider.availability.labels.noHours;
}
export function slotStart(slot: AvailabilitySlot) { return new Date(`${slot.date}T${slot.start}:00+07:00`).getTime(); }
export function isHistorical(slot: AvailabilitySlot, now: string) { return slotStart(slot) <= new Date(now).getTime(); }
export function dateError(date: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return vi.provider.availability.errors.invalidDate;
  const parsed = new Date(`${date}T00:00:00Z`);
  return !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date ? vi.provider.availability.errors.invalidDate : null;
}
export function rangesError(ranges: TimeRange[]): string | null {
  for (const range of ranges) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(range.start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(range.end)) return vi.provider.availability.errors.invalidTimes;
    if (range.start >= range.end) return vi.provider.availability.errors.endAfterStart;
  }
  const sorted = [...ranges].sort((a, b) => a.start.localeCompare(b.start));
  return sorted.some((range, index) => index > 0 && range.start < sorted[index - 1].end) ? vi.provider.availability.errors.overlappingRanges : null;
}
export function weeklyHours(state: AvailabilityState, date: string) {
  const version = [...state.schedules].filter((item) => item.effectiveFrom <= date).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
  return version?.days ?? [];
}
export function effectiveHours(state: AvailabilityState, date: string): TimeRange[] {
  const exception = state.exceptions.find((item) => item.date === date);
  if (exception) return exception.ranges;
  const weekday = new Date(`${date}T12:00:00+07:00`).getUTCDay() || 7;
  return weeklyHours(state, date).find((day) => day.weekday === weekday)?.ranges ?? [];
}
function fitsHours(slot: AvailabilitySlot, ranges: TimeRange[]) { return ranges.some((range) => range.start <= slot.start && range.end >= slot.end); }
function conflictDescription(slot: AvailabilitySlot, state: AvailabilityState) {
  return formatMessage(vi.provider.availability.conflicts.slot, { slotId: slot.id, date: formatAvailabilityDate(slot.date), start: slot.start, end: slot.end, held: heldSeats(slot.id, state.reservations) });
}
function hoursConflicts(state: AvailabilityState, slots: AvailabilitySlot[]) {
  const conflicts = slots.filter((slot) => !fitsHours(slot, effectiveHours(state, slot.date)));
  return conflicts.length ? formatMessage(vi.provider.availability.errors.hoursConflicts, { conflicts: conflicts.map((slot) => conflictDescription(slot, state)).join("\n") }) : null;
}
function daysError(days: WeeklyDay[]) {
  if (days.length !== 7 || [1, 2, 3, 4, 5, 6, 7].some((weekday) => days.filter((day) => day.weekday === weekday).length !== 1)) return vi.provider.availability.errors.weeklyDays;
  for (const day of days) { const error = rangesError(day.ranges); if (error) return formatMessage(vi.provider.availability.errors.dayRange, { day: day.label, error }); }
  return null;
}
export function canAcceptBooking(state: AvailabilityState, slot: AvailabilitySlot, now: string) {
  return slot.open && !isHistorical(slot, now) && heldSeats(slot.id, state.reservations) < slot.capacity && fitsHours(slot, effectiveHours(state, slot.date));
}
/** Pure validation, reused by forms and re-run in the reducer against its latest state. */
export function availabilityCommandError(state: AvailabilityState, command: AvailabilityCommand, now: string): string | null {
  const today = localDate(now);
  if (command.type === "saveWeekly") {
    const schedule = command.schedule;
    const error = dateError(schedule.effectiveFrom) ?? daysError(schedule.days);
    if (error) return error;
    if (schedule.effectiveFrom < today) return vi.provider.availability.errors.effectiveDateInPast;
    const next = { ...state, schedules: [...state.schedules.filter((item) => item.effectiveFrom !== schedule.effectiveFrom), schedule] };
    return hoursConflicts(next, state.slots.filter((slot) => slot.date >= schedule.effectiveFrom));
  }
  if (command.type === "createException" || command.type === "updateException" || command.type === "deleteException") {
    const existing = command.type === "deleteException" ? state.exceptions.find((item) => item.id === command.exceptionId) : state.exceptions.find((item) => item.id === command.exception.id);
    if (command.type !== "createException" && !existing) return vi.provider.availability.errors.exceptionNotFound;
    if (command.type === "createException" && existing) return vi.provider.availability.errors.exceptionExists;
    const exception = command.type === "deleteException" ? existing! : command.exception;
    const error = dateError(exception.date) ?? rangesError(exception.ranges);
    if (error) return error;
    if (exception.date < today || (existing && existing.date < today)) return vi.provider.availability.errors.historicalException;
    if (existing && existing.date !== exception.date) return vi.provider.availability.errors.exceptionDateChanged;
    if (state.exceptions.some((item) => item.date === exception.date && item.id !== exception.id)) return vi.provider.availability.errors.duplicateExceptionDate;
    const next = { ...state, exceptions: state.exceptions.filter((item) => item.id !== exception.id) };
    if (command.type !== "deleteException") next.exceptions = [...next.exceptions, exception];
    return hoursConflicts(next, state.slots.filter((slot) => slot.date === exception.date));
  }
  const slotId = "slot" in command ? command.slot.id : command.slotId;
  const existing = state.slots.find((item) => item.id === slotId);
  if (command.type !== "createSlot" && !existing) return vi.provider.availability.errors.slotNotFound;
  if (command.type === "createSlot" && existing) return vi.provider.availability.errors.slotExists;
  if (existing && isHistorical(existing, now)) return vi.provider.availability.errors.historicalSlot;
  const held = heldSeats(slotId, state.reservations);
  if (command.type === "closeSlot" || command.type === "deleteSlot") {
    return held > 0 ? formatMessage(vi.provider.availability.errors.heldCannotRemove, { held }) : null;
  }
  const slot = command.slot;
  if (existing && held > 0 && ["serviceId", "date", "start", "end", "open"].some((key) => existing[key as keyof AvailabilitySlot] !== slot[key as keyof AvailabilitySlot])) return formatMessage(vi.provider.availability.errors.heldFieldsLocked, { held });
  if (!Number.isSafeInteger(slot.capacity) || slot.capacity < 1) return vi.provider.availability.errors.invalidCapacity;
  if (slot.capacity < held) return formatMessage(vi.provider.availability.errors.capacityBelowHeld, { held });
  const service = state.services.find((item) => item.id === slot.serviceId);
  if (!service) return vi.provider.availability.errors.invalidService;
  const error = dateError(slot.date) ?? rangesError([{ start: slot.start, end: slot.end }]);
  if (error) return error;
  if (slot.date < today || isHistorical(slot, now)) return vi.provider.availability.errors.slotInPast;
  const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
  if (minutes(slot.end) - minutes(slot.start) !== service.durationMinutes) return formatMessage(vi.provider.availability.errors.serviceDuration, { minutes: service.durationMinutes });
  if (!fitsHours(slot, effectiveHours(state, slot.date))) return vi.provider.availability.errors.outsideHours;
  const overlaps = state.slots.filter((item) => item.id !== slot.id && item.serviceId === slot.serviceId && item.date === slot.date && slot.start < item.end && item.start < slot.end);
  return overlaps.length ? formatMessage(vi.provider.availability.errors.overlappingSlots, { conflicts: overlaps.map((item) => conflictDescription(item, state)).join("\n") }) : null;
}
export function upcomingSlots(state: AvailabilityState, now: string) {
  return state.slots.filter((slot) => !isHistorical(slot, now)).sort((a, b) => slotStart(a) - slotStart(b));
}
export function summarizeAvailability(state: AvailabilityState, now: string) {
  const end = new Date(now).getTime() + 7 * 24 * 60 * 60 * 1000;
  const upcoming = upcomingSlots(state, now).filter((slot) => slotStart(slot) < end);
  return {
    open: upcoming.filter((slot) => canAcceptBooking(state, slot, now)).length,
    heldBookings: state.reservations.filter((item) => occupiesSeat(item) && upcoming.some((slot) => slot.id === item.slotId)).length,
    exceptions: state.exceptions.length,
  };
}
export function applyAvailabilityCommand(state: AvailabilityState, command: AvailabilityCommand, now: string, simulateFailure = false): AvailabilityState {
  const error = availabilityCommandError(state, command, now) ?? (simulateFailure ? vi.provider.availability.errors.simulatedFailure : null);
  if (error) return { ...state, feedback: { outcome: "error", message: error } };
  let next = state;
  switch (command.type) {
    case "createSlot": next = { ...state, slots: [...state.slots, { ...command.slot }] }; break;
    case "updateSlot": next = { ...state, slots: state.slots.map((slot) => slot.id === command.slot.id ? { ...command.slot } : slot) }; break;
    case "closeSlot": next = { ...state, slots: state.slots.map((slot) => slot.id === command.slotId ? { ...slot, open: false } : slot) }; break;
    case "deleteSlot": next = { ...state, slots: state.slots.filter((slot) => slot.id !== command.slotId) }; break;
    case "saveWeekly": next = { ...state, schedules: [...state.schedules.filter((schedule) => schedule.effectiveFrom !== command.schedule.effectiveFrom), { ...command.schedule, days: command.schedule.days.map((day) => ({ ...day, ranges: day.ranges.map((range) => ({ ...range })) })) }].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom)) }; break;
    case "createException": case "updateException": next = { ...state, exceptions: [...state.exceptions.filter((item) => item.id !== command.exception.id), { ...command.exception, ranges: command.exception.ranges.map((range) => ({ ...range })) }].sort((a, b) => a.date.localeCompare(b.date)) }; break;
    case "deleteException": next = { ...state, exceptions: state.exceptions.filter((item) => item.id !== command.exceptionId) }; break;
  }
  const message = command.type === "saveWeekly" ? formatMessage(vi.provider.availability.feedback.weeklySaved, { date: formatAvailabilityDate(command.schedule.effectiveFrom) }) : command.type === "deleteSlot" ? vi.provider.availability.feedback.slotDeleted : command.type === "closeSlot" ? vi.provider.availability.feedback.slotClosed : command.type === "deleteException" ? vi.provider.availability.feedback.exceptionDeleted : command.type === "createException" || command.type === "updateException" ? vi.provider.availability.feedback.exceptionSaved : vi.provider.availability.feedback.slotSaved;
  return { ...next, feedback: { outcome: "success", message } };
}
export type AvailabilityAction = { type: "command"; command: AvailabilityCommand; now: string; simulateFailure: boolean } | { type: "reset"; state: AvailabilityState } | { type: "clearFeedback" };
export function availabilityReducer(state: AvailabilityState, action: AvailabilityAction) {
  if (action.type === "reset") return action.state;
  if (action.type === "clearFeedback") return { ...state, feedback: null };
  return applyAvailabilityCommand(state, action.command, action.now, action.simulateFailure);
}
