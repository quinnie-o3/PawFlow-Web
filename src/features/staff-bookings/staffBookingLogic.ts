import type { StaffBooking, StaffBookingFilters, StaffBookingStatus, StaffBookingTarget, StaffViewContext } from "./types";

export const staffBookingTimeZone = "Asia/Ho_Chi_Minh";

export const staffStatusLabels: Record<StaffBookingStatus, string> = {
  pendingConfirmation: "Chờ xác nhận", confirmed: "Đã xác nhận", completed: "Hoàn thành",
  cancelled: "Đã hủy", rejected: "Từ chối", noShow: "Không đến",
};
export const staffStatusOrder: readonly StaffBookingStatus[] = ["pendingConfirmation", "confirmed", "completed", "cancelled", "rejected", "noShow"];

export function canViewStaffBookings(context: StaffViewContext) {
  return context.role === "providerStaff" && context.membershipStatus === "active" && !!context.providerId?.trim();
}

/** Demo scoping only. The server must authorize and scope responses before sending data. */
export function scopeStaffBookings(bookings: readonly StaffBooking[], context: StaffViewContext) {
  return canViewStaffBookings(context) ? bookings.filter((booking) => booking.providerId === context.providerId) : [];
}

function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLocaleLowerCase("vi").trim();
}

export function filterStaffBookings(bookings: readonly StaffBooking[], context: StaffViewContext, filters: StaffBookingFilters) {
  const query = normalizeSearch(filters.query);
  return scopeStaffBookings(bookings, context).filter((booking) =>
    (filters.status === "all" || booking.status === filters.status) &&
    normalizeSearch(`${booking.id} ${booking.customerName} ${booking.petName}`).includes(query),
  );
}

export function findStaffBooking(bookings: readonly StaffBooking[], context: StaffViewContext, id: string) {
  return scopeStaffBookings(bookings, context).find((booking) => booking.id === id);
}

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  timeZone: staffBookingTimeZone, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

export function formatStaffBookingDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Chưa có thời gian";
  const parts = dateFormatter.formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  return `${part("day")}/${part("month")}/${part("year")} · ${part("hour")}:${part("minute")}`;
}

/** Require an explicit offset: never interpret an API timestamp in the host timezone. */
export function staffBookingStart(booking: StaffBooking) {
  return /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(booking.scheduledAt) ? Date.parse(booking.scheduledAt) : NaN;
}

export function staffBookingEnd(booking: StaffBooking) {
  const duration = booking.durationMinutesSnapshot;
  if (duration === null || !Number.isFinite(duration) || duration <= 0) return null;
  const end = staffBookingStart(booking) + duration * 60_000;
  return Number.isFinite(end) && Math.abs(end) <= 8.64e15 ? end : null;
}

export const staffActionLabels: Record<StaffBookingTarget, string> = {
  confirmed: "Xác nhận yêu cầu", rejected: "Từ chối yêu cầu",
  completed: "Hoàn thành lịch", noShow: "Đánh dấu không đến",
};

/** Frontend demo rules only; backend must independently authorize and recheck. */
export function staffTransitionError(booking: StaffBooking, target: StaffBookingTarget, context: StaffViewContext, now: number): string | null {
  if (!canViewStaffBookings(context) || booking.providerId !== context.providerId) return "Không có quyền xử lý lịch hẹn này tại cơ sở được phân công.";
  if (booking.status !== "pendingConfirmation" && booking.status !== "confirmed") return "Lịch đã kết thúc, không được sửa lại trạng thái.";
  if (booking.status === "pendingConfirmation") {
    if (target === "rejected") return null;
    if (target !== "confirmed") return "Lịch chờ chỉ có thể được xác nhận hoặc từ chối.";
    const start = staffBookingStart(booking);
    if (!Number.isFinite(now) || !Number.isFinite(start)) return "Không thể xác minh thời gian lịch hẹn.";
    return now < start ? null : "Chỉ được xác nhận trước giờ bắt đầu lịch hẹn.";
  }
  if (target !== "completed" && target !== "noShow") return "Lịch đã xác nhận chỉ có thể chuyển Hoàn thành hoặc Không đến.";
  const start = staffBookingStart(booking);
  if (!Number.isFinite(now) || !Number.isFinite(start)) return "Không thể xác minh thời gian lịch hẹn.";
  if (target === "noShow") return now >= start ? null : "Chỉ được đánh dấu không đến từ giờ bắt đầu lịch hẹn.";
  const end = staffBookingEnd(booking);
  if (end === null) return "Thiếu thời lượng snapshot hợp lệ của booking; chưa thể hoàn thành lịch.";
  return now >= end ? null : "Chỉ được hoàn thành từ giờ kết thúc dự kiến trở đi.";
}

export function staffBookingActions(booking: StaffBooking, context: StaffViewContext, now: number) {
  const targets: StaffBookingTarget[] = booking.status === "pendingConfirmation" ? ["confirmed", "rejected"] : booking.status === "confirmed" ? ["completed", "noShow"] : [];
  return targets.map((target) => ({ target, label: staffActionLabels[target], disabledReason: staffTransitionError(booking, target, context, now) }));
}

export function parseStaffMockTime(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return NaN;
  const time = Date.parse(`${value}:00+07:00`);
  return Number.isFinite(time) && new Date(time + 7 * 3_600_000).toISOString().slice(0, 16) === value ? time : NaN;
}

export function formatStaffMockTime(now: number) {
  const parts = dateFormatter.formatToParts(new Date(now));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

export function formatStaffPrice(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value)
    : "Chưa có giá snapshot trong booking";
}
