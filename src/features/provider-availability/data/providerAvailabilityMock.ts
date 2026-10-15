import type { AvailabilitySlot, AvailabilityState, DateException, SlotReservation, WeeklyDay } from "../types";

// Injected frozen clock; explicitly labelled in the UI. No dependency on host timezone.
export const availabilityMockNow = "2026-10-15T10:00:00+07:00";
export const mockWeeklyHours: WeeklyDay[] = [
  { weekday: 1, label: "Thứ Hai", ranges: [{ start: "09:00", end: "12:00" }, { start: "13:30", end: "18:00" }] },
  { weekday: 2, label: "Thứ Ba", ranges: [{ start: "09:00", end: "12:00" }, { start: "13:30", end: "18:00" }] },
  { weekday: 3, label: "Thứ Tư", ranges: [{ start: "09:00", end: "12:00" }, { start: "13:30", end: "18:00" }] },
  { weekday: 4, label: "Thứ Năm", ranges: [{ start: "09:00", end: "12:00" }, { start: "13:30", end: "18:00" }] },
  { weekday: 5, label: "Thứ Sáu", ranges: [{ start: "09:00", end: "12:00" }, { start: "13:30", end: "18:00" }] },
  { weekday: 6, label: "Thứ Bảy", ranges: [{ start: "09:00", end: "12:00" }, { start: "14:00", end: "17:00" }] },
  { weekday: 7, label: "Chủ Nhật", ranges: [] },
];
export const mockDateExceptions: DateException[] = [
  { id: "exception-1", date: "2026-10-02", ranges: [] },
  { id: "exception-2", date: "2026-10-09", ranges: [{ start: "09:00", end: "12:00" }] },
];
// Handwritten snapshots, never auto-generated. First three retain Figma history.
// Its 01/10 08:30 sample is inconsistent with Thursday hours: read-only history.
export const mockAvailabilitySlots: AvailabilitySlot[] = [
  { id: "slot-1", serviceId: "grooming", date: "2026-09-30", start: "09:00", end: "10:30", capacity: 3, open: true },
  { id: "slot-2", serviceId: "spa", date: "2026-09-30", start: "14:30", end: "15:30", capacity: 2, open: true },
  { id: "slot-3", serviceId: "spa", date: "2026-10-01", start: "08:30", end: "09:30", capacity: 3, open: true },
  { id: "slot-4", serviceId: "spa", date: "2026-10-15", start: "14:30", end: "15:30", capacity: 3, open: true },
  { id: "slot-5", serviceId: "grooming", date: "2026-10-16", start: "09:00", end: "10:30", capacity: 2, open: true },
  { id: "slot-6", serviceId: "spa", date: "2026-10-16", start: "14:30", end: "15:30", capacity: 2, open: true },
  { id: "slot-7", serviceId: "grooming", date: "2026-10-17", start: "09:00", end: "10:30", capacity: 1, open: true },
  { id: "slot-8", serviceId: "spa", date: "2026-10-19", start: "09:00", end: "10:00", capacity: 2, open: true },
  { id: "slot-9", serviceId: "spa", date: "2026-10-20", start: "09:00", end: "10:00", capacity: 2, open: false },
];
export const mockSlotReservations: SlotReservation[] = [
  { id: "MOCK-01", slotId: "slot-1", status: "pendingConfirmation" },
  { id: "MOCK-02", slotId: "slot-1", status: "confirmed" },
  { id: "MOCK-03", slotId: "slot-2", status: "confirmed" },
  { id: "MOCK-04", slotId: "slot-3", status: "pendingConfirmation" },
  { id: "MOCK-05", slotId: "slot-4", status: "pendingConfirmation" },
  { id: "MOCK-06", slotId: "slot-4", status: "confirmed" },
  { id: "MOCK-07", slotId: "slot-5", status: "confirmed" },
  { id: "MOCK-08", slotId: "slot-7", status: "confirmed" },
  { id: "MOCK-09", slotId: "slot-4", status: "cancelled" },
  { id: "MOCK-10", slotId: "slot-5", status: "completed" },
  { id: "MOCK-11", slotId: "slot-6", status: "rejected" },
  { id: "MOCK-12", slotId: "slot-8", status: "noShow" },
];
export function createAvailabilityMock(empty = false): AvailabilityState {
  return {
    slots: empty ? [] : mockAvailabilitySlots.map((slot) => ({ ...slot })),
    reservations: empty ? [] : mockSlotReservations.map((reservation) => ({ ...reservation })),
    services: [{ id: "grooming", name: "Tắm & cắt tỉa", durationMinutes: 90 }, { id: "spa", name: "Spa thư giãn", durationMinutes: 60 }],
    schedules: [{ effectiveFrom: "2026-01-01", days: mockWeeklyHours.map((day) => ({ ...day, ranges: day.ranges.map((range) => ({ ...range })) })) }],
    exceptions: empty ? [] : mockDateExceptions.map((exception) => ({ ...exception, ranges: exception.ranges.map((range) => ({ ...range })) })),
    feedback: null,
  };
}
