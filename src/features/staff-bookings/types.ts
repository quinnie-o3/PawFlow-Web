/** Frontend-only view models. These are not API DTOs or authentication claims. */
export type StaffBookingStatus = "pendingConfirmation" | "confirmed" | "completed" | "cancelled" | "rejected" | "noShow";

export type StaffBooking = Readonly<{
  id: string;
  providerId: string;
  customerName: string;
  petName: string;
  petSpecies: string;
  serviceName: string;
  scheduledAt: string;
  durationMinutesSnapshot: number | null;
  priceSnapshot?: number | null;
  contactPhone?: string | null;
  petBreed?: string | null;
  petAge?: string | null;
  petWeightKg?: number | null;
  petAllergies?: string | null;
  status: StaffBookingStatus;
  notes: string;
}>;

export type StaffViewContext = Readonly<{
  role: "providerStaff" | "providerOwner" | "customer" | "admin";
  providerId: string | null;
  membershipStatus: "active" | "inactive";
}>;

export type StaffBookingFilters = { query: string; status: StaffBookingStatus | "all" };
export type StaffMockScenario = "normal" | "empty" | "error";
export type StaffBookingTarget = "confirmed" | "rejected" | "completed" | "noShow";
export type StaffBookingCommand = Readonly<{
  bookingId: string;
  expectedStatus: StaffBookingStatus;
  targetStatus: StaffBookingTarget;
  reason: string;
  confirmedActualOutcome: boolean;
}>;
export type StaffActionResult = {
  bookingId: string;
  outcome: "success" | "error";
  message: string;
};
export type StaffAuditEntry = StaffActionResult & {
  id: number;
  previousStatus: StaffBookingStatus | null;
  nextStatus: StaffBookingStatus | null;
  requestedStatus: StaffBookingTarget;
  actor: string;
  occurredAt: string | null;
  reason: string;
  confirmedActualOutcome: boolean;
};
export type StaffSessionState = {
  phase: "loading" | "error" | "ready";
  scenario: StaffMockScenario;
  bookings: readonly StaffBooking[];
  logs: readonly StaffAuditEntry[];
  now: number;
  simulateFailure: boolean;
  result: StaffActionResult | null;
  pendingCommand: StaffBookingCommand | null;
};
