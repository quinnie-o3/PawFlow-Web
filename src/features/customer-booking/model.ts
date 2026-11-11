/** Independent UI/mock domain. No API DTOs, auth session, fixtures, or UI copy. */
export type BookingStatus =
  | "PENDING_CONFIRMATION" | "CONFIRMED" | "REJECTED"
  | "COMPLETED" | "CANCELLED" | "NO_SHOW";
export type ComplaintStatus = "OPEN" | "IN_REVIEW" | "RESOLVED" | "REJECTED";
export type Actor = Readonly<{ id: string; role: string }>;
export type Quote = Readonly<{
  petId: string; providerId: string; serviceId: string; slotId: string;
  price: string;
  /** Review-time value only: never labelled as booked duration. */
  serviceDurationMinutes: number;
  slotStartAt: number; slotEndAt: number;
}>;
export type BookingDraft = Readonly<{
  petId: string | null; providerId: string | null;
  serviceId: string | null; slotId: string | null;
  customerNote: string;
  reviewedQuote: Quote | null;
}>;

/**
 * Ephemeral projections from the existing pet/catalog sources.
 * The future adapter reads them in the SAME mock transaction as state/capacity.
 * These types do not own a pet/catalog collection.
 * Instants come from the existing Vietnam-time catalog adapter, not a new parser.
 */
export type BookingFacts = Readonly<{
  pet: Readonly<{ id: string; ownerId: string; active: boolean }> | null;
  provider: Readonly<{ id: string; approved: boolean }> | null;
  service: Readonly<{
    id: string; providerId: string; active: boolean; categoryActive: boolean;
    price: string | null; durationMinutes: number | null;
  }> | null;
  slot: Readonly<{
    id: string; providerId: string; serviceId: string;
    startAt: number; endAt: number; status: "OPEN" | "CLOSED" | "CANCELLED";
    capacity: number | null; booked: number | null;
  }> | null;
}>;
export type StatusLog = Readonly<{
  oldStatus: BookingStatus | null; newStatus: BookingStatus;
  changedBy: string; changedAt: number; reason: string | null;
}>;
export type MockBooking = Readonly<{
  id: string; customerId: string;
  petId: string; providerId: string; serviceId: string; slotId: string;
  bookedPrice: string; customerNote: string | null;
  /**
   * Mock receipt of the selected appointment. These internal fields are NOT
   * claims that BE dev has time/duration snapshot columns.
   * No service.durationMinutes is stored on the booking.
   */
  appointmentStartAt: number; appointmentEndAt: number;
  createdAt: number; status: BookingStatus;
  statusLogs: readonly StatusLog[];
}>;
export type AttemptReceipt = Readonly<{
  customerId: string; attemptId: string; fingerprint: string; bookingId: string;
}>;
export type MockReview = Readonly<{
  bookingId: string; customerId: string;
  rating: number; comment: string | null; createdAt: number;
}>;
export type MockComplaint = Readonly<{
  id: string; bookingId: string; customerId: string;
  reason: string; status: ComplaintStatus; createdAt: number;
}>;
export type BookingState = Readonly<{
  bookings: readonly MockBooking[];
  attempts: readonly AttemptReceipt[];
  reviews: readonly MockReview[];
  complaints: readonly MockComplaint[];
}>;
export type ErrorCode =
  | "CUSTOMER_REQUIRED" | "CLOCK_INVALID" | "SELECTION_REQUIRED"
  | "PET_UNAVAILABLE" | "PROVIDER_UNAVAILABLE" | "SERVICE_UNAVAILABLE"
  | "SLOT_UNAVAILABLE" | "CONTEXT_MISMATCH" | "SLOT_TIME_UNKNOWN"
  | "SLOT_STARTED" | "SLOT_CLOSED" | "SLOT_FULL" | "CAPACITY_UNKNOWN"
  | "PRICE_UNKNOWN" | "DURATION_UNKNOWN" | "SLOT_TOO_SHORT"
  | "REVIEW_REQUIRED" | "QUOTE_CHANGED" | "SLOT_CHANGED"
  | "INVALID_ATTEMPT" | "ATTEMPT_MISMATCH" | "ID_CONFLICT"
  | "NETWORK_BEFORE_CREATE" | "BOOKING_NOT_FOUND"
  | "CANCEL_STATUS" | "CANCEL_TIME" | "NO_RESERVED_CAPACITY"
  | "REVIEW_STATUS" | "ALREADY_REVIEWED" | "RATING_INVALID"
  | "COMPLAINT_STATUS" | "ACTIVE_COMPLAINT" | "REASON_INVALID";
export type Result<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; code: ErrorCode }>;
export type CapacityChange = Readonly<{ slotId: string; delta: 1 | -1 }>;
export type Mutation =
  | Readonly<{
      ok: true; state: BookingState; bookingId: string;
      capacityChange: CapacityChange | null; replayed: boolean;
    }>
  | Readonly<{ ok: false; state: BookingState; code: ErrorCode }>;
export type AttemptLookup =
  | Readonly<{ kind: "found"; bookingId: string }>
  | Readonly<{ kind: "absent" }>
  | Readonly<{ kind: "mismatch" }>;

export function emptyBookingState(): BookingState {
  return { bookings: [], attempts: [], reviews: [], complaints: [] };
}
