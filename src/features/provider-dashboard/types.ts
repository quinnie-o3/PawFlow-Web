export type MetricTone = "success" | "danger" | "info" | "warning" | "pending";
export type MetricIconName = "payment" | "calendar" | "notification" | "cards" | "stack" | "chart";
export type DateRange = { start: string; end: string };
export type ProviderSummary = { providerName: string; reportingPeriod: string };
export type PrioritySummary = { title: string; waitingRequests: string; todayAppointments: string };
export type MetricBreakdownItem = { label: string; value: string; tone: MetricTone };
export type MetricCardData = {
  id: string;
  title: string;
  value: string;
  description: string;
  icon: MetricIconName;
  breakdown?: MetricBreakdownItem[];
};
export type WeeklyStatusPoint = { week: string; completed: number; other: number };
export type OperationalAlert = {
  id: string;
  title: string;
  description: string;
  period: string;
  serviceScope: string;
  metric: string;
  numerator: number;
  denominator: number;
  threshold: string;
  condition: string;
};
export type BookingRequest = {
  id: string;
  customerName: string;
  petName: string;
  serviceName: string;
  scheduledAt: string;
  durationMinutes: number;
  price: number;
  notes: string;
  status: "pendingConfirmation";
};
// Observed daily sample facts, not an API contract or production metric rules.
export type DailyDashboardSample = {
  date: string;
  completed: number;
  cancelled: number;
  noShow: number;
  pending: number;
  confirmed: number;
  rejected: number;
  paidCompletedRevenue: number;
  completedServices: Record<string, number>;
  returningCustomerIds: string[];
  reviewCount: number;
  reviewScoreTotal: number;
  groomingCancelled: number;
  groomingResolved: number;
  accepted: number;
  peakHourAccepted: number;
};
