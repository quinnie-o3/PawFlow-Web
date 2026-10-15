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
  return ranges.length ? ranges.map((range) => `${range.start}–${range.end}`).join("  ·  ") : "Không nhận lịch";
}
export function slotStart(slot: AvailabilitySlot) { return new Date(`${slot.date}T${slot.start}:00+07:00`).getTime(); }
export function isHistorical(slot: AvailabilitySlot, now: string) { return slotStart(slot) <= new Date(now).getTime(); }
export function dateError(date: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "Vui lòng chọn ngày hợp lệ.";
  const parsed = new Date(`${date}T00:00:00Z`);
  return !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date ? "Vui lòng chọn ngày hợp lệ." : null;
}
export function rangesError(ranges: TimeRange[]): string | null {
  for (const range of ranges) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(range.start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(range.end)) return "Vui lòng nhập đủ giờ bắt đầu và kết thúc hợp lệ.";
    if (range.start >= range.end) return "Giờ kết thúc phải sau giờ bắt đầu trong cùng ngày; chưa hỗ trợ khoảng qua đêm.";
  }
  const sorted = [...ranges].sort((a, b) => a.start.localeCompare(b.start));
  return sorted.some((range, index) => index > 0 && range.start < sorted[index - 1].end) ? "Các khoảng giờ bị chồng lấn. Vui lòng kiểm tra lại." : null;
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
  return `${slot.id} · ${formatAvailabilityDate(slot.date)} ${slot.start}–${slot.end} · ${heldSeats(slot.id, state.reservations)} chỗ đang giữ`;
}
function hoursConflicts(state: AvailabilityState, slots: AvailabilitySlot[]) {
  const conflicts = slots.filter((slot) => !fitsHours(slot, effectiveHours(state, slot.date)));
  return conflicts.length ? `Slot nằm ngoài giờ hoạt động mới. Xử lý các slot này trước; booking được giữ nguyên:\n${conflicts.map((slot) => conflictDescription(slot, state)).join("\n")}` : null;
}
function daysError(days: WeeklyDay[]) {
  if (days.length !== 7 || [1, 2, 3, 4, 5, 6, 7].some((weekday) => days.filter((day) => day.weekday === weekday).length !== 1)) return "Lịch tuần phải có đủ bảy ngày, không trùng ngày.";
  for (const day of days) { const error = rangesError(day.ranges); if (error) return `${day.label}: ${error}`; }
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
    if (schedule.effectiveFrom < today) return "Ngày hiệu lực không được trước ngày hiện tại theo Asia/Ho_Chi_Minh.";
    const next = { ...state, schedules: [...state.schedules.filter((item) => item.effectiveFrom !== schedule.effectiveFrom), schedule] };
    return hoursConflicts(next, state.slots.filter((slot) => slot.date >= schedule.effectiveFrom));
  }
  if (command.type === "createException" || command.type === "updateException" || command.type === "deleteException") {
    const existing = command.type === "deleteException" ? state.exceptions.find((item) => item.id === command.exceptionId) : state.exceptions.find((item) => item.id === command.exception.id);
    if (command.type !== "createException" && !existing) return "Ngoại lệ không còn tồn tại. Vui lòng kiểm tra lại.";
    if (command.type === "createException" && existing) return "Ngoại lệ đã tồn tại. Vui lòng sửa mục hiện có.";
    const exception = command.type === "deleteException" ? existing! : command.exception;
    const error = dateError(exception.date) ?? rangesError(exception.ranges);
    if (error) return error;
    if (exception.date < today || (existing && existing.date < today)) return "Ngoại lệ thuộc lịch sử; không được chỉnh sửa hoặc xóa.";
    if (existing && existing.date !== exception.date) return "Không đổi ngày của cấu hình hiện có. Hãy tạo ngoại lệ cho ngày khác.";
    if (state.exceptions.some((item) => item.date === exception.date && item.id !== exception.id)) return "Ngày này đã có ngoại lệ. Hãy chỉnh sửa cấu hình hiện có.";
    const next = { ...state, exceptions: state.exceptions.filter((item) => item.id !== exception.id) };
    if (command.type !== "deleteException") next.exceptions = [...next.exceptions, exception];
    return hoursConflicts(next, state.slots.filter((slot) => slot.date === exception.date));
  }
  const slotId = "slot" in command ? command.slot.id : command.slotId;
  const existing = state.slots.find((item) => item.id === slotId);
  if (command.type !== "createSlot" && !existing) return "Khung giờ không còn tồn tại. Vui lòng kiểm tra lại.";
  if (command.type === "createSlot" && existing) return "Khung giờ đã tồn tại. Vui lòng kiểm tra lại.";
  if (existing && isHistorical(existing, now)) return "Slot đã bắt đầu hoặc thuộc lịch sử; không được chỉnh sửa, đóng hoặc xóa.";
  const held = heldSeats(slotId, state.reservations);
  if (command.type === "closeSlot" || command.type === "deleteSlot") {
    return held > 0 ? `Khung giờ đang giữ ${held} chỗ (Chờ xác nhận + Đã xác nhận). Không thể đóng hoặc xóa; booking được giữ nguyên.` : null;
  }
  const slot = command.slot;
  if (existing && held > 0 && ["serviceId", "date", "start", "end", "open"].some((key) => existing[key as keyof AvailabilitySlot] !== slot[key as keyof AvailabilitySlot])) return `Khung giờ đang giữ ${held} chỗ. Chỉ được sửa sức chứa; không đổi dịch vụ, ngày giờ hoặc trạng thái mở.`;
  if (!Number.isSafeInteger(slot.capacity) || slot.capacity < 1) return "Sức chứa phải là số nguyên dương.";
  if (slot.capacity < held) return `Khung giờ đang giữ ${held} chỗ (Chờ xác nhận + Đã xác nhận). Không thể giảm sức chứa dưới ${held}.`;
  const service = state.services.find((item) => item.id === slot.serviceId);
  if (!service) return "Vui lòng chọn dịch vụ hợp lệ.";
  const error = dateError(slot.date) ?? rangesError([{ start: slot.start, end: slot.end }]);
  if (error) return error;
  if (slot.date < today || isHistorical(slot, now)) return "Slot phải bắt đầu sau thời gian hiện tại theo Asia/Ho_Chi_Minh.";
  const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
  if (minutes(slot.end) - minutes(slot.start) !== service.durationMinutes) return `Độ dài slot phải bằng thời lượng dịch vụ: ${service.durationMinutes} phút.`;
  if (!fitsHours(slot, effectiveHours(state, slot.date))) return "Slot phải nằm hoàn toàn trong một khoảng giờ hoạt động có hiệu lực; ngoại lệ ngày thay thế toàn bộ giờ tuần.";
  const overlaps = state.slots.filter((item) => item.id !== slot.id && item.serviceId === slot.serviceId && item.date === slot.date && slot.start < item.end && item.start < slot.end);
  return overlaps.length ? `Slot cùng dịch vụ bị chồng lấn:\n${overlaps.map((item) => conflictDescription(item, state)).join("\n")}` : null;
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
  const error = availabilityCommandError(state, command, now) ?? (simulateFailure ? "Mô phỏng lỗi lưu: dữ liệu chưa thay đổi. Tắt mô phỏng lỗi và thử lại." : null);
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
  const message = command.type === "saveWeekly" ? `Đã lưu giờ tuần từ ${formatAvailabilityDate(command.schedule.effectiveFrom)}. Giữ lịch sử và toàn bộ slot đã tạo.` : command.type === "deleteSlot" ? "Đã xóa slot mô phỏng. Booking được giữ nguyên." : command.type === "closeSlot" ? "Đã đóng slot mô phỏng. Booking được giữ nguyên." : command.type === "deleteException" ? "Đã xóa ngoại lệ; dùng lại giờ tuần có hiệu lực." : command.type === "createException" || command.type === "updateException" ? "Đã lưu ngoại lệ ngày, thay thế toàn bộ giờ tuần của ngày đó." : "Đã lưu slot mô phỏng trong phiên này.";
  return { ...next, feedback: { outcome: "success", message } };
}
export type AvailabilityAction = { type: "command"; command: AvailabilityCommand; now: string; simulateFailure: boolean } | { type: "reset"; state: AvailabilityState } | { type: "clearFeedback" };
export function availabilityReducer(state: AvailabilityState, action: AvailabilityAction) {
  if (action.type === "reset") return action.state;
  if (action.type === "clearFeedback") return { ...state, feedback: null };
  return applyAvailabilityCommand(state, action.command, action.now, action.simulateFailure);
}
