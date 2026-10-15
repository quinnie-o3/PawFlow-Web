import type { BookingStatus } from "../provider-bookings/types";

export type TimeRange = { start: string; end: string };
/** ISO weekday, Monday = 1. Wall-clock times in Asia/Ho_Chi_Minh. */
export type WeeklyDay = { weekday: number; label: string; ranges: TimeRange[] };
export type WeeklySchedule = { effectiveFrom: string; days: WeeklyDay[] };
export type DateException = { id: string; date: string; ranges: TimeRange[] };
export type AvailabilityService = { id: string; name: string; durationMinutes: number };
/** Manually created, belongs to one service; no shared-resource capacity. */
export type AvailabilitySlot = {
  id: string; serviceId: string; date: string; start: string; end: string; capacity: number; open: boolean;
};
/** Each booking occupies exactly one seat in its selected slot. Independent of FE-007. */
export type SlotReservation = { id: string; slotId: string; status: BookingStatus };
export type AvailabilityCommand =
  | { type: "createSlot"; slot: AvailabilitySlot }
  | { type: "updateSlot"; slot: AvailabilitySlot }
  | { type: "closeSlot"; slotId: string }
  | { type: "deleteSlot"; slotId: string }
  | { type: "saveWeekly"; schedule: WeeklySchedule }
  | { type: "createException"; exception: DateException }
  | { type: "updateException"; exception: DateException }
  | { type: "deleteException"; exceptionId: string };
export type AvailabilityState = {
  slots: AvailabilitySlot[]; reservations: SlotReservation[]; services: AvailabilityService[];
  schedules: WeeklySchedule[]; exceptions: DateException[];
  feedback: { outcome: "success" | "error"; message: string } | null;
};
