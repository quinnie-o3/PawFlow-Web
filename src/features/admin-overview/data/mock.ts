// Titles and queue destinations from the seven main Admin screens.
// No KPI values or chart series until their definitions are confirmed.
export const overviewMetricLabels = ["Cơ sở đã duyệt", "Người dùng", "Lịch hẹn trong kỳ", "Dịch vụ đang hiển thị", "Điểm đánh giá trung bình", "Khiếu nại mở"] as const;

export const adminQueueLinks = [
  { href: "/admin/providers", label: "Cơ sở chờ duyệt" },
  { href: "/admin/complaints", label: "Khiếu nại chưa giải quyết" },
  { href: "/admin/reviews", label: "Đánh giá bị báo cáo" },
] as const;
