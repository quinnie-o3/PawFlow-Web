import type {
  DssAlertCode,
  DssAlertSeverity,
} from "../provider-workspace/liveApi";

export type MetricTone = "success" | "danger" | "info" | "warning" | "pending";

export type MetricIconName =
  | "payment"
  | "calendar"
  | "notification"
  | "cards"
  | "stack"
  | "chart";

export type DateRange = Readonly<{
  start: string;
  end: string;
}>;

export type DashboardRangePreset = "7d" | "30d" | "90d" | "custom";

export type ProviderSummary = Readonly<{
  providerName: string | null;
  reportingPeriod: string;
}>;

export type PrioritySummary = Readonly<{
  title: string;
  todayDate: string;
  waitingCount: number;
  todayCount: number;
  waitingRequests: string;
  todayAppointments: string;
  missingActiveServices: boolean;
  missingUpcomingOpenSlots: boolean;
}>;

export type MetricBreakdownItem = Readonly<{
  label: string;
  value: string;
  tone: MetricTone;
}>;

export type MetricCardData = Readonly<{
  id: string;
  title: string;
  value: string;
  description: string;
  icon: MetricIconName;
  breakdown?: readonly MetricBreakdownItem[];
}>;

export type WeeklyStatusPoint = Readonly<{
  key: string;
  label: string;
  rangeLabel: string;
  completed: number;
  other: number;
}>;

export type LocalizedDssAlert = Readonly<{
  id: string;
  code: DssAlertCode;
  severity: DssAlertSeverity;
  severityLabel: string;
  title: string;
  summary: string;
  period: string;
  scope: string;
  metric: string;
  threshold: string;
  recommendation: string;
}>;

export type DssAlertLookups = Readonly<{
  facilityName: string | null;
  serviceNames: ReadonlyMap<string, string>;
  customerNames: ReadonlyMap<string, string>;
}>;

export type SetupHintsCounts = Readonly<{
  activeServices: number;
  upcomingOpenSlots: number;
}>;
