import { vi, formatMessage } from "../../lib/locale";
import type { Booking, BookingActor, BookingCommand, BookingFilters, BookingStatus, MockBookingsState } from "./types";

export const bookingTimeZone = "Asia/Ho_Chi_Minh";
export const statusLabels: Record<BookingStatus, string> = {
  pendingConfirmation: vi.provider.bookings.status.pendingConfirmation, confirmed: vi.provider.bookings.status.confirmed, rejected: vi.provider.bookings.status.rejected,
  cancelled: vi.provider.bookings.status.cancelled, completed: vi.provider.bookings.status.completed, noShow: vi.provider.bookings.status.noShow,
};
export const statusOrder: BookingStatus[] = ["pendingConfirmation", "confirmed", "completed", "cancelled", "rejected", "noShow"];
export const actionLabels: Partial<Record<BookingStatus, string>> = {
  confirmed: vi.provider.bookings.actions.confirmed, rejected: vi.provider.bookings.actions.rejected, cancelled: vi.provider.bookings.actions.cancelled,
  completed: vi.provider.bookings.actions.completed, noShow: vi.provider.bookings.actions.noShow,
};

export function formatBookingDate(value: string, includeYear = false) {
  const parts = new Intl.DateTimeFormat("vi-VN", {
    timeZone: bookingTimeZone, day: "2-digit", month: "2-digit",
    ...(includeYear ? { year: "numeric" as const } : {}), hour: "2-digit", minute: "2-digit",
  }).formatToParts(new Date(value));
  const part = (name: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === name)?.value;
  const date = `${part("day")}/${part("month")}${includeYear ? `/${part("year")}` : ""}`;
  return `${date} · ${part("hour")}:${part("minute")}`;
}

function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase().trim();
}

export function filterBookings(bookings: Booking[], filters: BookingFilters) {
  const query = normalizeSearch(filters.query);
  return bookings.filter((booking) =>
    (filters.status === "all" || booking.status === filters.status) &&
    normalizeSearch(`${booking.id} ${booking.customerName} ${booking.petName}`).includes(query));
}

export function summarizeBookings(bookings: Booking[]) {
  return ["pendingConfirmation", "confirmed", "completed"].map((status) => ({
    status: status as BookingStatus,
    title: statusLabels[status as BookingStatus],
    count: bookings.filter((booking) => booking.status === status).length,
  }));
}

export function scheduledEnd(booking: Booking) {
  return new Date(booking.scheduledAt).getTime() + booking.durationMinutes * 60_000;
}

/** No staff permissions are inferred. Time is injected, never read from the host clock. */
export function transitionError(booking: Booking, target: BookingStatus, actor: BookingActor, now: string): string | null {
  if (actor.role !== "providerOwner") return vi.provider.bookings.errors.ownerOnly;
  if (booking.status === "pendingConfirmation") {
    return target === "confirmed" || target === "rejected" ? null : vi.provider.bookings.errors.pendingTransition;
  }
  if (booking.status !== "confirmed") return vi.provider.bookings.errors.finalStatus;
  const time = new Date(now).getTime();
  const start = new Date(booking.scheduledAt).getTime();
  if (!Number.isFinite(time) || !Number.isFinite(start) || !Number.isFinite(booking.durationMinutes) || booking.durationMinutes <= 0) {
    return vi.provider.bookings.errors.invalidTime;
  }
  switch (target) {
    case "cancelled": return time < start ? null : vi.provider.bookings.errors.cancelBeforeStart;
    case "completed": return time >= scheduledEnd(booking) ? null : vi.provider.bookings.errors.completeAfterEnd;
    case "noShow": return time >= start ? null : vi.provider.bookings.errors.noShowAfterStart;
    default: return vi.provider.bookings.errors.invalidTransition;
  }
}

export function bookingActions(booking: Booking, actor: BookingActor, now: string) {
  const targets: BookingStatus[] = booking.status === "pendingConfirmation"
    ? ["confirmed", "rejected"] : booking.status === "confirmed" ? ["completed", "noShow", "cancelled"] : [];
  return targets.map((target) => ({ target, label: actionLabels[target]!, disabledReason: transitionError(booking, target, actor, now) }));
}

export function createMockState(bookings: Booking[]): MockBookingsState {
  return { bookings: bookings.map((booking) => ({ ...booking })), logs: [], pending: null, feedback: null };
}

/** Resolve against the latest state, rechecking status, role, time, reason, and attestation. */
export function resolveMockCommand(state: MockBookingsState, command: BookingCommand, actor: BookingActor, now: string): MockBookingsState {
  const booking = state.bookings.find((item) => item.id === command.bookingId);
  if (!booking) return { ...state, pending: null, feedback: { bookingId: command.bookingId, outcome: "error", message: vi.provider.bookings.errors.notFound } };
  const reason = command.reason.trim();
  let error = booking.status !== command.expectedStatus ? vi.provider.bookings.errors.statusChanged : transitionError(booking, command.targetStatus, actor, now);
  if (!error && command.targetStatus === "cancelled" && !reason) error = vi.provider.bookings.errors.cancellationReason;
  if (!error && ["completed", "noShow"].includes(command.targetStatus) && !command.confirmedActualOutcome) error = vi.provider.bookings.errors.attestation;
  if (!error && command.simulateFailure) error = vi.provider.bookings.errors.simulatedFailure;
  const outcome = error ? "error" : "success";
  const message = error ?? formatMessage(vi.provider.bookings.feedback.statusUpdated, { bookingId: booking.id, status: statusLabels[command.targetStatus].toLowerCase() });
  const nextStatus = error ? booking.status : command.targetStatus;
  return {
    bookings: error ? state.bookings : state.bookings.map((item) => item.id === booking.id ? { ...item, status: nextStatus } : item),
    logs: [...state.logs, {
      id: state.logs.length + 1, bookingId: booking.id, previousStatus: booking.status, nextStatus,
      requestedStatus: command.targetStatus, actor: { ...actor }, occurredAt: now, reason, outcome, message,
    }],
    pending: null, feedback: { bookingId: booking.id, outcome, message },
  };
}

export type MockBookingsAction =
  | { type: "submit"; command: BookingCommand }
  | { type: "resolve"; actor: BookingActor; now: string }
  | { type: "scenario"; bookings: Booking[] };

export function mockBookingsReducer(state: MockBookingsState, action: MockBookingsAction): MockBookingsState {
  switch (action.type) {
    case "submit": return state.pending ? state : { ...state, pending: action.command, feedback: null };
    case "resolve": return state.pending ? resolveMockCommand(state, state.pending, action.actor, action.now) : state;
    case "scenario": return state.pending ? state : createMockState(action.bookings);
  }
}
