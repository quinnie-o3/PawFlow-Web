import type {
  ProviderApiErrorInfo,
  ProviderBooking,
  ProviderBookingDetail,
  ProviderBookingStatus,
} from "../provider-workspace/liveApi";

export type ProviderBookingAction = "confirm" | "reject" | "complete" | "no-show";

export type BookingFilters = Readonly<{
  query: string;
  status: ProviderBookingStatus | "all";
  fromDate: string;
  toDate: string;
}>;

export type BookingSummaryItem = Readonly<{
  status: ProviderBookingStatus;
  title: string;
  count: number;
}>;

export type BookingActionOption = Readonly<{
  action: ProviderBookingAction;
  targetStatus: ProviderBookingStatus;
  label: string;
  requiresReasonField: boolean;
  disabledReason: string | null;
}>;

export type BookingTimeNoticeKind = "no-show-before-start" | "complete-before-start" | "complete-before-end" | null;

export type BookingReconcileOutcome =
  | "applied"
  | "not-applied"
  | "changed-elsewhere";

export type BookingFeedback = Readonly<{
  bookingId: string;
  tone: "success" | "error" | "warning";
  message: string;
}>;

export type BookingDraftState = Readonly<{
  identity: string | null;
  bookingId: string | null;
  action: ProviderBookingAction | null;
  reason: string;
  openedAtMs: number | null;
  phase: "idle" | "submitting" | "unknown" | "reconciling";
  error: ProviderApiErrorInfo | null;
  reconcileError: ProviderApiErrorInfo | null;
}>;

export type BookingDetailLoadState = Readonly<{
  identity: string | null;
  bookingId: string | null;
  status: "idle" | "loading" | "ready" | "not-found" | "error";
  detail: ProviderBookingDetail | null;
  error: ProviderApiErrorInfo | null;
}>;

export type BookingListLoadState = Readonly<{
  identity: string | null;
  status: "idle" | "loading" | "ready" | "error";
  bookings: readonly ProviderBooking[];
  error: ProviderApiErrorInfo | null;
  reloading: boolean;
  refreshError: ProviderApiErrorInfo | null;
}>;
