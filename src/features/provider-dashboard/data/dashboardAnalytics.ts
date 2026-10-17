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
    { id: "recognized-revenue", title: "Doanh thu ghi nhận", icon: "payment", value: hasData ? sum("paidCompletedRevenue").toLocaleString("vi-VN") + " ₫" : "N/A", description: "Lịch Completed có trạng thái thanh toán Paid" },
    { id: "appointment-status", title: "Lịch hẹn theo trạng thái", icon: "calendar", value: hasData ? String(total) : "N/A", description: "Chưa có dữ liệu trong kỳ", breakdown: hasData ? [
      { label: "Completed", value: String(completed), tone: "success" },
      { label: "Cancelled", value: String(cancelled), tone: "danger" },
      { label: "No-show", value: String(noShow), tone: "warning" },
      { label: "Pending Confirmation", value: String(pending), tone: "pending" },
      { label: "Confirmed", value: String(confirmed), tone: "info" },
      { label: "Rejected", value: String(rejected), tone: "danger" },
    ] : undefined },
    { id: "cancellation-rate", title: "Tỷ lệ hủy", icon: "notification", value: resolved ? percentage(cancelled, resolved) : "N/A", description: hasData ? cancelled + " / " + resolved + " lịch đã giải quyết" : "Chưa có dữ liệu trong kỳ" },
    { id: "popular-service", title: "Dịch vụ phổ biến", icon: "stack", value: popular?.[0] ?? "N/A", description: popular ? popular[1] + " lịch Completed trong kỳ" : "Chưa có lịch Completed trong kỳ" },
    { id: "returning-customers", title: "Khách hàng quay lại", icon: "cards", value: hasData ? String(returning) : "N/A", description: "Có lịch Completed trước đó với cơ sở" },
    { id: "average-rating", title: "Điểm đánh giá trung bình", icon: "chart", value: sum("reviewCount") ? (sum("reviewScoreTotal") / sum("reviewCount")).toLocaleString("vi-VN", { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + " / 5" : "N/A", description: sum("reviewCount") + " đánh giá hiển thị trong kỳ" },
  ];
  // Group sample dates into consecutive 7-day buckets from the selected start date.
  const groups = new Map<number, WeeklyStatusPoint>();
  for (const sample of selected) {
    const week = Math.floor((Date.parse(sample.date) - Date.parse(range.start)) / 604800000);
    const point = groups.get(week) ?? { week: "Tuần " + (week + 1), completed: 0, other: 0 };
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
      id: "grooming-cancel-rate", title: "Tỷ lệ hủy Grooming vượt ngưỡng",
      description: percentage(groomingCancelled, groomingResolved) + " trong kỳ; ngưỡng 25%. Xem lại lịch, giá hoặc phản hồi gần đây.",
      period: formatRange(range), serviceScope: "Grooming · PawCare Studio", metric: "Tỷ lệ hủy Grooming",
      numerator: groomingCancelled, denominator: groomingResolved, threshold: "25%",
      condition: "Số lịch Grooming bị hủy / số lịch Grooming đã giải quyết > 25%.",
    });
  }
  const accepted = sum("accepted");
  const peak = sum("peakHourAccepted");
  if (accepted && peak / accepted > 0.4) {
    alerts.push({
      id: "peak-demand", title: "Nhu cầu tập trung 17:00–20:00",
      description: percentage(peak, accepted) + " lịch được chấp nhận; ngưỡng 40%. Xem lại sức chứa giờ cao điểm.",
      period: formatRange(range), serviceScope: "Tất cả dịch vụ · PawCare Studio", metric: "Tỷ trọng lịch được chấp nhận 17:00–20:00",
      numerator: peak, denominator: accepted, threshold: "40%",
      condition: "Số lịch được chấp nhận 17:00–20:00 / tổng lịch được chấp nhận > 40%.",
    });
  }
  return { metrics, chart, alerts, hasData };
}
