import type { Booking, BookingActor, BookingCommand, BookingFilters, BookingStatus, MockBookingsState } from "./types";

export const bookingTimeZone = "Asia/Ho_Chi_Minh";
export const statusLabels: Record<BookingStatus, string> = {
  pendingConfirmation: "Chờ xác nhận", confirmed: "Đã xác nhận", rejected: "Từ chối",
  cancelled: "Đã hủy", completed: "Hoàn thành", noShow: "Không đến",
};
export const statusOrder: BookingStatus[] = ["pendingConfirmation", "confirmed", "completed", "cancelled", "rejected", "noShow"];
export const actionLabels: Partial<Record<BookingStatus, string>> = {
  confirmed: "Xác nhận yêu cầu", rejected: "Từ chối yêu cầu", cancelled: "Hủy lịch hẹn",
  completed: "Đánh dấu hoàn thành", noShow: "Đánh dấu không đến",
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
  if (actor.role !== "providerOwner") return "Thao tác chỉ dành cho Provider Owner.";
  if (booking.status === "pendingConfirmation") {
    return target === "confirmed" || target === "rejected" ? null : "Yêu cầu đang chờ chỉ có thể được xác nhận hoặc từ chối.";
  }
  if (booking.status !== "confirmed") return "Lịch đã kết thúc; không thể chuyển trạng thái tiếp.";
  const time = new Date(now).getTime();
  const start = new Date(booking.scheduledAt).getTime();
  if (!Number.isFinite(time) || !Number.isFinite(start) || !Number.isFinite(booking.durationMinutes) || booking.durationMinutes <= 0) {
    return "Không thể xác minh thời gian của lịch hẹn.";
  }
  switch (target) {
    case "cancelled": return time < start ? null : "Chỉ được hủy trước giờ bắt đầu lịch hẹn.";
    case "completed": return time >= scheduledEnd(booking) ? null : "Chỉ được hoàn thành từ giờ kết thúc dự kiến trở đi.";
    case "noShow": return time >= start ? null : "Chỉ được đánh dấu không đến từ giờ bắt đầu lịch hẹn.";
    default: return "Chuyển trạng thái không hợp lệ.";
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
  if (!booking) return { ...state, pending: null, feedback: { bookingId: command.bookingId, outcome: "error", message: "Không tìm thấy lịch hẹn." } };
  const reason = command.reason.trim();
  let error = booking.status !== command.expectedStatus ? "Trạng thái đã thay đổi. Vui lòng kiểm tra lại lịch hẹn." : transitionError(booking, command.targetStatus, actor, now);
  if (!error && command.targetStatus === "cancelled" && !reason) error = "Vui lòng nhập lý do hủy; không được chỉ có khoảng trắng.";
  if (!error && ["completed", "noShow"].includes(command.targetStatus) && !command.confirmedActualOutcome) error = "Vui lòng xác nhận kết quả thực tế của lịch hẹn.";
  if (!error && command.simulateFailure) error = "Mô phỏng lỗi: chưa cập nhật lịch hẹn. Vui lòng thử lại.";
  const outcome = error ? "error" : "success";
  const message = error ?? `${booking.id}: đã cập nhật thành ${statusLabels[command.targetStatus].toLowerCase()}.`;
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
