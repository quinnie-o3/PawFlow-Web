import type { BookingRequest, DailyDashboardSample, DateRange, PrioritySummary } from "../types";

// Dữ liệu mô phỏng; không đại diện cho API hoặc quy tắc nghiệp vụ chính thức.
export const providerName = "PawCare Studio";
export const initialReportingRange: DateRange = { start: "2026-09-01", end: "2026-09-30" };
export const sampleToday = "2026-09-30";
// Snapshot vận hành độc lập với kỳ báo cáo: 3 dòng xem trước trong 6 yêu cầu chờ.
export const prioritySummary: PrioritySummary = {
  title: "Cần xử lý hôm nay",
  waitingRequests: "06 yêu cầu chờ xác nhận",
  todayAppointments: "04 lịch hẹn hôm nay",
};

// Các ngày có dữ liệu mẫu. Ngoài các ngày này chưa có dữ liệu quan sát.
// Rejected = 0 được người dùng chốt cho bộ mock này, không suy ra từ proposal.
export const dailySamples: DailyDashboardSample[] = [
  {
    date: "2026-09-07", completed: 22, cancelled: 2, noShow: 3, pending: 2, confirmed: 7, rejected: 0,
    paidCompletedRevenue: 4500000, completedServices: { "Chăm sóc tạo kiểu": 10, "Tắm & vệ sinh": 12 },
    returningCustomerIds: ["C01", "C02", "C03", "C04", "C05", "C06"],
    reviewCount: 9, reviewScoreTotal: 42, groomingCancelled: 2, groomingResolved: 6,
    accepted: 16, peakHourAccepted: 7,
  },
  {
    date: "2026-09-14", completed: 17, cancelled: 2, noShow: 3, pending: 1, confirmed: 3, rejected: 0,
    paidCompletedRevenue: 3400000, completedServices: { "Chăm sóc tạo kiểu": 8, "Tắm & vệ sinh": 5, "Trông giữ ban ngày": 4 },
    returningCustomerIds: ["C07", "C08", "C09", "C10", "C11"],
    reviewCount: 7, reviewScoreTotal: 33, groomingCancelled: 1, groomingResolved: 5,
    accepted: 12, peakHourAccepted: 5,
  },
  {
    date: "2026-09-21", completed: 28, cancelled: 3, noShow: 4, pending: 2, confirmed: 6, rejected: 0,
    paidCompletedRevenue: 6000000, completedServices: { "Chăm sóc tạo kiểu": 14, "Tắm & vệ sinh": 8, "Trông giữ ban ngày": 6 },
    returningCustomerIds: ["C12", "C13", "C14", "C15", "C16", "C17", "C18", "C19"],
    reviewCount: 12, reviewScoreTotal: 56, groomingCancelled: 2, groomingResolved: 8,
    accepted: 20, peakHourAccepted: 9,
  },
  {
    date: "2026-09-28", completed: 21, cancelled: 2, noShow: 3, pending: 1, confirmed: 2, rejected: 0,
    paidCompletedRevenue: 4550000, completedServices: { "Chăm sóc tạo kiểu": 10, "Tắm & vệ sinh": 6, "Trông giữ ban ngày": 5 },
    returningCustomerIds: ["C20", "C21", "C22", "C23", "C24", "C25", "C26"],
    reviewCount: 8, reviewScoreTotal: 38, groomingCancelled: 2, groomingResolved: 6,
    accepted: 14, peakHourAccepted: 6,
  },
  {
    date: "2026-10-05", completed: 12, cancelled: 1, noShow: 0, pending: 2, confirmed: 3, rejected: 0,
    paidCompletedRevenue: 2200000, completedServices: { "Tắm & vệ sinh": 9, "Chăm sóc tạo kiểu": 3 },
    returningCustomerIds: ["C01", "C02", "C27"],
    reviewCount: 4, reviewScoreTotal: 18, groomingCancelled: 0, groomingResolved: 3,
    accepted: 10, peakHourAccepted: 2,
  },
  {
    date: "2026-10-12", completed: 16, cancelled: 0, noShow: 1, pending: 1, confirmed: 4, rejected: 0,
    paidCompletedRevenue: 3100000, completedServices: { "Tắm & vệ sinh": 10, "Trông giữ ban ngày": 6 },
    returningCustomerIds: ["C02", "C03", "C28", "C29"],
    reviewCount: 6, reviewScoreTotal: 29, groomingCancelled: 0, groomingResolved: 0,
    accepted: 14, peakHourAccepted: 4,
  },
];

export const bookingRequests: BookingRequest[] = [
  {
    id: "PF-2084", customerName: "Hà Linh", petName: "Miu", serviceName: "Chăm sóc toàn diện",
    scheduledAt: "2026-09-30T09:00:00+07:00", durationMinutes: 90, price: 450000,
    status: "pendingConfirmation", notes: "Miu nhạy cảm với tiếng máy sấy; vui lòng thao tác nhẹ nhàng.",
  },
  {
    id: "PF-2083", customerName: "Quang Minh", petName: "Bắp", serviceName: "Tắm & vệ sinh",
    scheduledAt: "2026-09-30T14:30:00+07:00", durationMinutes: 60, price: 250000,
    status: "pendingConfirmation", notes: "Sử dụng dầu gội dành cho da nhạy cảm.",
  },
  {
    id: "PF-2082", customerName: "Ngọc Anh", petName: "Kiki", serviceName: "Trông giữ ban ngày",
    scheduledAt: "2026-10-01T08:30:00+07:00", durationMinutes: 480, price: 350000,
    status: "pendingConfirmation", notes: "Khách mang theo thức ăn riêng; đón Kiki lúc 16:30.",
  },
];
