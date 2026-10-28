import { findStaffBooking, staffStatusLabels, staffTransitionError } from "./staffBookingLogic";
import type { StaffBooking, StaffBookingCommand, StaffMockScenario, StaffSessionState, StaffViewContext } from "./types";

export const staffMockNow = Date.parse("2026-10-21T08:00:00+07:00");
const mockActor = "Ngọc Mai · Staff (mô phỏng)";

export function createStaffSession(bookings: readonly StaffBooking[]): StaffSessionState {
  return { phase: "loading", scenario: "normal", bookings, logs: [], now: staffMockNow, simulateFailure: false, result: null, pendingCommand: null };
}

export type StaffSessionAction =
  | { type: "load"; scenario: StaffMockScenario }
  | { type: "loaded" }
  | { type: "clock"; now: number }
  | { type: "failure"; enabled: boolean }
  | { type: "clearResult" }
  | { type: "reset"; bookings: readonly StaffBooking[] }
  | { type: "submit"; command: StaffBookingCommand }
  | { type: "resolve"; command: StaffBookingCommand };

/** Each command is resolved atomically against the latest session state and clock. */
export function staffSessionReducer(state: StaffSessionState, action: StaffSessionAction, context: StaffViewContext): StaffSessionState {
  switch (action.type) {
    case "load": return {
      ...state, phase: "loading", scenario: action.scenario,
      bookings: action.scenario === "empty" ? [] : state.bookings,
      result: null, pendingCommand: null,
    };
    case "loaded": return { ...state, phase: state.scenario === "error" ? "error" : "ready" };
    case "clock": return Number.isFinite(action.now) && Math.abs(action.now) <= 8.64e15 ? { ...state, now: action.now } : state;
    case "failure": return { ...state, simulateFailure: action.enabled };
    case "clearResult": return { ...state, result: null };
    case "reset": return createStaffSession(action.bookings);
    case "submit": return state.pendingCommand ? state : { ...state, pendingCommand: action.command, result: null };
    case "resolve": {
      // Ignore a cancelled timer or a second response for an already resolved command.
      if (state.pendingCommand !== action.command) return state;
      const command = action.command;
      // Lookup is scoped before reading detail or creating a log. Do not leak foreign status.
      const booking = findStaffBooking(state.bookings, context, command.bookingId);
      const reason = command.reason.trim();
      let error = !booking ? "Không tìm thấy lịch hẹn trong phạm vi cơ sở được phân công."
        : state.phase !== "ready" || state.scenario !== "normal" ? "Danh sách chưa sẵn sàng. Vui lòng tải lại rồi thử lại."
        : booking.status !== command.expectedStatus ? "Trạng thái đã thay đổi. Vui lòng kiểm tra lại lịch hẹn."
        : staffTransitionError(booking, command.targetStatus, context, state.now);
      if (!error && (command.targetStatus === "rejected" || command.targetStatus === "noShow") && !reason) error = "Vui lòng nhập lý do / ghi nhận, không chỉ có khoảng trắng.";
      if (!error && (command.targetStatus === "completed" || command.targetStatus === "noShow") && !command.confirmedActualOutcome) error = "Vui lòng xác nhận kết quả thực tế của lịch hẹn.";
      if (!error && state.simulateFailure) error = "Mô phỏng lỗi: chưa cập nhật lịch hẹn. Đóng chi tiết, tắt lỗi trong khu vực dữ liệu mô phỏng rồi thử lại.";
      const outcome = error ? "error" : "success";
      const result = { bookingId: command.bookingId, outcome, message: error ?? `${command.bookingId}: đã cập nhật thành ${staffStatusLabels[command.targetStatus].toLowerCase()}.` } as const;
      return {
        ...state,
        bookings: error ? state.bookings : state.bookings.map((item) => item.id === booking!.id && item.providerId === booking!.providerId ? { ...item, status: command.targetStatus } : item),
        result, pendingCommand: null,
        logs: [...state.logs, {
          ...result, id: state.logs.length + 1, previousStatus: booking?.status ?? null,
          nextStatus: error ? booking?.status ?? null : command.targetStatus,
          requestedStatus: command.targetStatus, actor: mockActor,
          occurredAt: Number.isFinite(state.now) && Math.abs(state.now) <= 8.64e15 ? new Date(state.now).toISOString() : null,
          reason, confirmedActualOutcome: command.confirmedActualOutcome,
        }],
      };
    }
  }
}
