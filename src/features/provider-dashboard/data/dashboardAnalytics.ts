import { vi, formatMessage } from "../../../lib/locale";
import type { DailyDashboardSample, DateRange, MetricCardData, OperationalAlert, WeeklyStatusPoint } from "../types";

export function formatDate(date: string) {
  return date.split("-").reverse().join("/");
}

export function formatRange(range: DateRange) {
  if (range.start.slice(0, 7) === range.end.slice(0, 7)) {
    return range.start.slice(8) + "–" + formatDate(range.end);
  }
  return formatDate(range.start) + " – " + formatDate(range.end);
}

export function formatBookingDate(value: string) {
  const date = value.slice(0, 10).split("-");
  return date[2] + "/" + date[1] + " · " + value.slice(11, 16);
}

export function summarizeDashboard(samples: DailyDashboardSample[], range: DateRange) {
  const selected = samples.filter((sample) => sample.date >= range.start && sample.date <= range.end);
  const sum = (key: "completed" | "cancelled" | "noShow" | "pending" | "confirmed" | "rejected" | "paidCompletedRevenue" | "reviewCount" | "reviewScoreTotal" | "groomingCancelled" | "groomingResolved" | "accepted" | "peakHourAccepted") =>
    selected.reduce((total, sample) => total + sample[key], 0);
  const completed = sum("completed");
  const cancelled = sum("cancelled");
  const noShow = sum("noShow");
  const pending = sum("pending");
  const confirmed = sum("confirmed");
  const rejected = sum("rejected");
  const resolved = completed + cancelled + noShow;
  const total = resolved + pending + confirmed + rejected;
  const hasData = selected.length > 0;
  const services = new Map<string, number>();
  for (const sample of selected) {
    for (const [service, count] of Object.entries(sample.completedServices)) {
      services.set(service, (services.get(service) ?? 0) + count);
    }
  }
  const popular = [...services].sort((a, b) => b[1] - a[1])[0];
  const returning = new Set(selected.flatMap((sample) => sample.returningCustomerIds)).size;
  const percentage = (numerator: number, denominator: number) =>
    (numerator / denominator * 100).toLocaleString("vi-VN", { maximumFractionDigits: 1 }) + "%";
  const metrics: MetricCardData[] = [
    { id: "recognized-revenue", title: vi.provider.dashboard.metrics.recognizedRevenue, icon: "payment", value: hasData ? sum("paidCompletedRevenue").toLocaleString("vi-VN") + " ₫" : "N/A", description: vi.provider.dashboard.metrics.revenueDescription },
    { id: "appointment-status", title: vi.provider.dashboard.metrics.appointmentStatus, icon: "calendar", value: hasData ? String(total) : "N/A", description: vi.provider.dashboard.metrics.noData, breakdown: hasData ? [
      { label: "Completed", value: String(completed), tone: "success" },
      { label: "Cancelled", value: String(cancelled), tone: "danger" },
      { label: "No-show", value: String(noShow), tone: "warning" },
      { label: "Pending Confirmation", value: String(pending), tone: "pending" },
      { label: "Confirmed", value: String(confirmed), tone: "info" },
      { label: "Rejected", value: String(rejected), tone: "danger" },
    ] : undefined },
    { id: "cancellation-rate", title: vi.provider.dashboard.metrics.cancellationRate, icon: "notification", value: resolved ? percentage(cancelled, resolved) : "N/A", description: hasData ? formatMessage(vi.provider.dashboard.metrics.resolvedDescription, { cancelled, resolved }) : vi.provider.dashboard.metrics.noData },
    { id: "popular-service", title: vi.provider.dashboard.metrics.popularService, icon: "stack", value: popular?.[0] ?? "N/A", description: popular ? formatMessage(vi.provider.dashboard.metrics.completedDescription, { count: popular[1] }) : vi.provider.dashboard.metrics.noCompletedBookings },
    { id: "returning-customers", title: vi.provider.dashboard.metrics.returningCustomers, icon: "cards", value: hasData ? String(returning) : "N/A", description: vi.provider.dashboard.metrics.returningDescription },
    { id: "average-rating", title: vi.provider.dashboard.metrics.averageRating, icon: "chart", value: sum("reviewCount") ? (sum("reviewScoreTotal") / sum("reviewCount")).toLocaleString("vi-VN", { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + " / 5" : "N/A", description: formatMessage(vi.provider.dashboard.metrics.ratingDescription, { count: sum("reviewCount") }) },
  ];
  // Group sample dates into consecutive 7-day buckets from the selected start date.
  const groups = new Map<number, WeeklyStatusPoint>();
  for (const sample of selected) {
    const week = Math.floor((Date.parse(sample.date) - Date.parse(range.start)) / 604800000);
    const point = groups.get(week) ?? { week: formatMessage(vi.provider.dashboard.chart.week, { number: week + 1 }), completed: 0, other: 0 };
    point.completed += sample.completed;
    point.other += sample.cancelled + sample.noShow + sample.pending + sample.confirmed + sample.rejected;
    groups.set(week, point);
  }
  const chart = [...groups].sort((a, b) => a[0] - b[0]).map((entry) => entry[1]);
  const alerts: OperationalAlert[] = [];
  const groomingCancelled = sum("groomingCancelled");
  const groomingResolved = sum("groomingResolved");
  if (groomingResolved && groomingCancelled / groomingResolved > 0.25) {
    alerts.push({
      id: "grooming-cancel-rate", title: vi.provider.dashboard.alerts.groomingCancellationTitle,
      description: formatMessage(vi.provider.dashboard.alerts.groomingCancellationDescription, { percentage: percentage(groomingCancelled, groomingResolved) }),
      period: formatRange(range), serviceScope: "Grooming · PawCare Studio", metric: vi.provider.dashboard.alerts.groomingCancellationMetric,
      numerator: groomingCancelled, denominator: groomingResolved, threshold: "25%",
      condition: vi.provider.dashboard.alerts.groomingCancellationCondition,
    });
  }
  const accepted = sum("accepted");
  const peak = sum("peakHourAccepted");
  if (accepted && peak / accepted > 0.4) {
    alerts.push({
      id: "peak-demand", title: vi.provider.dashboard.alerts.peakDemandTitle,
      description: formatMessage(vi.provider.dashboard.alerts.peakDemandDescription, { percentage: percentage(peak, accepted) }),
      period: formatRange(range), serviceScope: vi.provider.dashboard.alerts.allServicesScope, metric: vi.provider.dashboard.alerts.peakDemandMetric,
      numerator: peak, denominator: accepted, threshold: "40%",
      condition: vi.provider.dashboard.alerts.peakDemandCondition,
    });
  }
  return { metrics, chart, alerts, hasData };
}
