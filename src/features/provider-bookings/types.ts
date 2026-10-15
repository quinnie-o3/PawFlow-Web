export type BookingStatus =
  | "pendingConfirmation"
  | "confirmed"
  | "rejected"
  | "cancelled"
  | "completed"
  | "noShow";

export type Booking = {
  id: string;
  customerName: string;
  petName: string;
  petSpecies: string;
  serviceName: string;
  scheduledAt: string;
  /** Snapshot of the duration agreed at booking time. */
  durationMinutes: number;
  price: number;
  notes: string;
  status: BookingStatus;
};

export type BookingActor = {
  id: string;
  name: string;
  role: "providerOwner" | "providerStaff";
};

export type BookingFilters = { query: string; status: BookingStatus | "all" };
export type BookingCommand = {
  bookingId: string;
  expectedStatus: BookingStatus;
  targetStatus: BookingStatus;
  reason: string;
  confirmedActualOutcome: boolean;
  simulateFailure: boolean;
};

export type BookingLog = {
  id: number;
  bookingId: string;
  previousStatus: BookingStatus;
  nextStatus: BookingStatus;
  requestedStatus: BookingStatus;
  actor: BookingActor;
  occurredAt: string;
  reason: string;
  outcome: "success" | "error";
  message: string;
};

export type MockBookingsState = {
  bookings: Booking[];
  logs: BookingLog[];
  pending: BookingCommand | null;
  feedback: { bookingId: string; outcome: "success" | "error"; message: string } | null;
};
