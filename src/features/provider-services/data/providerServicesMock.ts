import type { ProviderService, ServicesState } from "../types";

// Labels and service content from the main Provider Dịch vụ design.
const serviceCategories = ["Grooming", "Chăm sóc", "Vệ sinh", "Trông giữ"];

const services: ProviderService[] = [
  { id: "styling", version: 1, name: "Chăm sóc tạo kiểu", category: "Grooming", description: "Tạo kiểu và chăm sóc bộ lông theo nhu cầu của thú cưng.", price: 280000, duration: { unit: "minutes", value: 90 }, active: true, completedCount: 42 },
  { id: "full-grooming", version: 1, name: "Grooming toàn diện", category: "Chăm sóc", description: "Tắm, sấy, chải lông và vệ sinh cơ bản trọn gói.", price: 350000, duration: { unit: "minutes", value: 90 }, active: true, completedCount: 0 },
  { id: "bath", version: 1, name: "Tắm & vệ sinh", category: "Vệ sinh", description: "Tắm, làm sạch tai và chăm sóc móng cơ bản.", price: 180000, duration: { unit: "minutes", value: 60 }, active: true, completedCount: 0 },
  { id: "daycare", version: 1, name: "Trông giữ ban ngày", category: "Trông giữ", description: "Trông giữ trong giờ hoạt động của cơ sở.", price: 250000, duration: { unit: "day", value: 1 }, active: true, completedCount: 0 },
  { id: "haircut", version: 1, name: "Cắt tỉa lông", category: "Grooming", description: "Cắt tỉa theo tình trạng lông và yêu cầu đã ghi nhận.", price: 220000, duration: { unit: "minutes", value: 75 }, active: true, completedCount: 0 },
  { id: "ears-nails", version: 1, name: "Vệ sinh tai & móng", category: "Vệ sinh", description: "Dịch vụ ngắn đang tạm ngừng nhận lịch mới.", price: 90000, duration: { unit: "minutes", value: 30 }, active: false, completedCount: 0 },
];

export function createServicesMock(empty = false): ServicesState {
  return {
    services: empty ? [] : services.map((service) => ({ ...service, duration: { ...service.duration } })),
    categories: [...serviceCategories],
    // Explicitly independent of FE-007 and FE-008 fixtures. Never edited by service commands.
    bookings: empty ? [] : [
      { id: "MOCK-BOOKING-1", serviceId: "styling", price: 280000, duration: { unit: "minutes", value: 90 }, status: "confirmed" },
      { id: "MOCK-BOOKING-2", serviceId: "ears-nails", price: 90000, duration: { unit: "minutes", value: 30 }, status: "confirmed" },
    ],
    slots: empty ? [] : [
      { id: "MOCK-SLOT-1", serviceId: "styling", label: "21/10/2026 · 09:00–10:30", durationMinutes: 90 },
      { id: "MOCK-SLOT-2", serviceId: "styling", label: "22/10/2026 · 14:00–15:30", durationMinutes: 90 },
    ],
    feedback: null,
  };
}
