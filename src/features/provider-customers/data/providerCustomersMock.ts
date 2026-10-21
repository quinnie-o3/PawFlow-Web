import type { CustomerBooking, CustomersMockData } from "../types";

export const customersMockFacility = { id: "MOCK-PAWCARE", name: "PawCare Studio" };
export const customersMockNow = "2026-10-15T10:00:00+07:00";

const bookings: CustomerBooking[] = [
  { id: "KH-001", facilityId: "MOCK-PAWCARE", customerId: "C01", petId: "P01", serviceName: "Chăm sóc tạo kiểu", scheduledAt: "2026-09-30T09:00:00+07:00", status: "completed" },
  { id: "KH-002", facilityId: "MOCK-PAWCARE", customerId: "C01", petId: "P01", serviceName: "Tắm & vệ sinh", scheduledAt: "2026-10-01T00:00:00+07:00", status: "completed" },
  { id: "KH-003", facilityId: "MOCK-PAWCARE", customerId: "C01", petId: "P02", serviceName: "Chăm sóc móng", scheduledAt: "2026-10-10T14:00:00+07:00", status: "completed" },
  { id: "KH-004", facilityId: "MOCK-PAWCARE", customerId: "C01", petId: "P01", serviceName: "Chăm sóc tạo kiểu", scheduledAt: "2026-10-16T09:00:00+07:00", status: "pendingConfirmation" },
  { id: "KH-005", facilityId: "MOCK-PAWCARE", customerId: "C01", petId: "P02", serviceName: "Tắm & vệ sinh", scheduledAt: "2026-10-17T10:00:00+07:00", status: "confirmed" },
  { id: "KH-006", facilityId: "MOCK-PAWCARE", customerId: "C01", petId: "P01", serviceName: "Chăm sóc tạo kiểu", scheduledAt: "2026-10-08T09:00:00+07:00", status: "cancelled" },
  { id: "KH-007", facilityId: "MOCK-PAWCARE", customerId: "C01", petId: "P01", serviceName: "Tắm & vệ sinh", scheduledAt: "2026-10-09T09:00:00+07:00", status: "rejected" },
  { id: "KH-008", facilityId: "MOCK-PAWCARE", customerId: "C01", petId: "P02", serviceName: "Chăm sóc móng", scheduledAt: "2026-10-11T09:00:00+07:00", status: "noShow" },
  { id: "KH-009", facilityId: "MOCK-PAWCARE", customerId: "C02", petId: "P03", serviceName: "Tắm & vệ sinh", scheduledAt: "2026-09-30T10:00:00+07:00", status: "completed" },
  { id: "KH-010", facilityId: "MOCK-PAWCARE", customerId: "C02", petId: "P03", serviceName: "Chăm sóc tạo kiểu", scheduledAt: "2026-10-12T11:00:00+07:00", status: "completed" },
  { id: "KH-011", facilityId: "MOCK-PAWCARE", customerId: "C03", petId: "P04", serviceName: "Trông giữ ban ngày", scheduledAt: "2026-10-04T09:00:00+07:00", status: "completed" },
  { id: "KH-012", facilityId: "MOCK-PAWCARE", customerId: "C04", petId: "P05", serviceName: "Tắm & vệ sinh", scheduledAt: "2026-10-18T10:00:00+07:00", status: "confirmed" },
  { id: "KH-013", facilityId: "MOCK-PAWCARE", customerId: "C05", petId: "P06", serviceName: "Chăm sóc tạo kiểu", scheduledAt: "2026-09-28T08:00:00+07:00", status: "completed" },
  { id: "KH-014", facilityId: "MOCK-PAWCARE", customerId: "C06", petId: "P07", serviceName: "Tắm & vệ sinh", scheduledAt: "2026-10-06T14:00:00+07:00", status: "noShow" },
  { id: "KH-015", facilityId: "MOCK-PAWCARE", customerId: "C07", petId: "P08", serviceName: "Chăm sóc móng", scheduledAt: "2026-10-05T08:00:00+07:00", status: "completed" },
  { id: "KH-016", facilityId: "MOCK-PAWCARE", customerId: "C08", petId: "P09", serviceName: "Tắm & vệ sinh dành cho thú cưng cần chăm sóc nhẹ nhàng", scheduledAt: "2026-10-13T08:30:00+07:00", status: "completed" },
  ...["P10", "P11", "P12", "P13"].map((petId, index): CustomerBooking => ({ id: `KH-0${17 + index}`, facilityId: "MOCK-PAWCARE", customerId: "C08", petId, serviceName: "Tắm & vệ sinh", scheduledAt: "2026-10-14T08:00:00+07:00", status: "confirmed" })),
  // Isolation fixtures: none of these records/pets/bookings may enter the current facility UI.
  { id: "OTHER-001", facilityId: "MOCK-OTHER", customerId: "C01", petId: "P-PRIVATE", serviceName: "Dịch vụ cơ sở khác", scheduledAt: "2026-08-01T09:00:00+07:00", status: "completed" },
  { id: "OTHER-002", facilityId: "MOCK-OTHER", customerId: "C07", petId: "P08", serviceName: "Dịch vụ cơ sở khác", scheduledAt: "2026-09-01T09:00:00+07:00", status: "completed" },
  { id: "OTHER-003", facilityId: "MOCK-OTHER", customerId: "C-OTHER", petId: "P-OTHER", serviceName: "Dịch vụ cơ sở khác", scheduledAt: "2026-10-02T09:00:00+07:00", status: "completed" },
];

/** Fresh independent fixture copies; no imports or writes to other modules' mock data. */
export function createCustomersMockData(empty = false): CustomersMockData {
  if (empty) return { customers: [], pets: [], bookings: [] };
  return {
    customers: [
      { id: "C01", name: "Hà Linh", phone: "0900 000 001", email: "halinh@example.com" },
      { id: "C02", name: "Quang Minh", phone: "0900 000 002", email: "quangminh@example.com" },
      { id: "C03", name: "Ngọc Anh", phone: "0900 000 003", email: "ngocanh@example.com" },
      { id: "C04", name: "Lan Phương", phone: "0900 000 004", email: "lanphuong@example.com" },
      { id: "C05", name: "Mai Anh", phone: "0900 000 005", email: "maianh@example.com" },
      { id: "C06", name: "Đức Huy", phone: "0900 000 006", email: "duchuy@example.com" },
      { id: "C07", name: "Hà Linh", phone: "0900 000 007", email: "halinh.khac@example.com" },
      { id: "C08", name: "Nguyễn Hoàng Bảo Ngọc Phương Anh", phone: "0900 000 008", email: "nguyen.hoang.bao.ngoc.phuong.anh@example.com" },
      { id: "C-OTHER", name: "Khách chỉ ở cơ sở khác", phone: "0900 000 099", email: "other@example.com" },
    ],
    pets: [
      { id: "P01", customerId: "C01", name: "Miu", species: "Mèo", breed: "Anh lông ngắn" },
      { id: "P02", customerId: "C01", name: "Bông", species: "Mèo", breed: "Mèo ta" },
      { id: "P03", customerId: "C02", name: "Bắp", species: "Chó", breed: "Corgi" },
      { id: "P04", customerId: "C03", name: "Kiki", species: "Chó", breed: "Poodle" },
      { id: "P05", customerId: "C04", name: "Bon", species: "Mèo", breed: "Mèo ta" },
      { id: "P06", customerId: "C05", name: "Lạc", species: "Chó", breed: "Poodle" },
      { id: "P07", customerId: "C06", name: "Mít", species: "Mèo", breed: "Mèo ta" },
      { id: "P08", customerId: "C07", name: "Miu", species: "Mèo", breed: "Anh lông dài" },
      { id: "P09", customerId: "C08", name: "Bánh Bao Nhỏ Có Bộ Lông Trắng", species: "Chó", breed: "Chó lai" },
      ...["P10", "P11", "P12", "P13"].map((id, index) => ({ id, customerId: "C08", name: ["Nắng", "Mây", "Gạo", "Đậu"][index], species: "Mèo", breed: "Mèo ta" })),
      { id: "P-PRIVATE", customerId: "C01", name: "Thú cưng chỉ ở nơi khác", species: "Mèo", breed: "Mèo ta" },
      { id: "P-OTHER", customerId: "C-OTHER", name: "Thú cưng cơ sở khác", species: "Chó", breed: "Poodle" },
      { id: "P-UNBOOKED", customerId: "C01", name: "Thú cưng chưa từng đặt lịch", species: "Chó", breed: "Chó lai" },
    ],
    bookings: bookings.map((booking) => ({ ...booking })),
  };
}
