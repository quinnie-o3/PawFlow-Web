import type { StaffBooking, StaffViewContext } from "../types";

// Independent Staff demo. Prices are illustrative booking snapshots; masked phone is synthetic.
// No credentials, real contact data, extra pet health data, Owner state or API calls.
export const mockStaffContext: StaffViewContext = {
  role: "providerStaff", providerId: "staff-demo-pawcare", membershipStatus: "active",
};

export const staffBookingsMock: readonly StaffBooking[] = [
  {
    id: "PF-2084", providerId: "staff-demo-pawcare", customerName: "Hà Linh", petName: "Miu", petSpecies: "Mèo",
    serviceName: "Grooming toàn diện", scheduledAt: "2026-10-21T09:00:00+07:00", durationMinutesSnapshot: 90, priceSnapshot: 350_000, contactPhone: "09•• ••• 001 (mô phỏng)",
    status: "pendingConfirmation", notes: "Miu nhạy cảm với tiếng máy sấy.",
  },
  {
    id: "PF-2083", providerId: "staff-demo-pawcare", customerName: "Quang Minh", petName: "Bắp", petSpecies: "Chó",
    serviceName: "Tắm & vệ sinh", scheduledAt: "2026-10-22T14:30:00+07:00", durationMinutesSnapshot: 60,
    status: "pendingConfirmation", notes: "Sử dụng dầu gội dành cho da nhạy cảm.",
  },
  {
    id: "PF-2082", providerId: "staff-demo-pawcare", customerName: "Ngọc Anh", petName: "Kiki", petSpecies: "Chó",
    serviceName: "Trông giữ ban ngày", scheduledAt: "2026-10-22T09:00:00+07:00", durationMinutesSnapshot: null,
    status: "pendingConfirmation", notes: "Khách mang theo thức ăn riêng; đón Kiki lúc 17:00.",
  },
  {
    id: "PF-2079", providerId: "staff-demo-pawcare", customerName: "Lan Phương", petName: "Bon", petSpecies: "Mèo",
    serviceName: "Chăm sóc tạo kiểu", scheduledAt: "2026-10-01T10:00:00+07:00", durationMinutesSnapshot: 90,
    status: "confirmed", notes: "Giữ lại phần lông đuôi.",
  },
  {
    id: "PF-2075", providerId: "staff-demo-pawcare", customerName: "Mai Anh", petName: "Lạc", petSpecies: "Chó",
    serviceName: "Cắt tỉa lông", scheduledAt: "2026-09-28T11:30:00+07:00", durationMinutesSnapshot: 60,
    status: "completed", notes: "",
  },
  {
    id: "PF-2068", providerId: "staff-demo-pawcare", customerName: "Đức Huy", petName: "Mít", petSpecies: "Chó",
    serviceName: "Tắm & vệ sinh", scheduledAt: "2026-09-26T16:00:00+07:00", durationMinutesSnapshot: 60,
    status: "cancelled", notes: "Khách thay đổi kế hoạch.",
  },
  {
    id: "PF-2069", providerId: "staff-demo-pawcare", customerName: "Đức Huy", petName: "Mít", petSpecies: "Chó",
    serviceName: "Tắm & vệ sinh", scheduledAt: "2026-09-25T16:00:00+07:00", durationMinutesSnapshot: 60,
    status: "rejected", notes: "Không thể tiếp nhận vào khung giờ yêu cầu.",
  },
  {
    id: "PF-2070", providerId: "staff-demo-pawcare", customerName: "Đức Huy", petName: "Mít", petSpecies: "Chó",
    serviceName: "Tắm & vệ sinh", scheduledAt: "2026-09-28T14:00:00+07:00", durationMinutesSnapshot: 60,
    status: "noShow", notes: "Khách không đến theo giờ đã đặt.",
  },
];
