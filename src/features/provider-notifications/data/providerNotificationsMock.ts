import type { NotificationScope, ProviderNotification } from "../types";

// Independent snapshot based on the main Figma screen. Never imports another module's data.
export const notificationsMockScope: NotificationScope = { ownerId: "owner-demo", facilityId: "MOCK-PAWCARE" };
export const notificationsMockOwner = "Dane Nguyen";
export const notificationsMockFacility = "PawCare Studio";
export const notificationsMockNow = "2026-09-29T15:00:00+07:00";

const source: ProviderNotification[] = [
  { id: "NOT-001", recipientOwnerId: "owner-demo", facilityId: "MOCK-PAWCARE", kind: "newBooking", title: "Yêu cầu đặt lịch mới", body: "PF-2084 · Hà Linh đặt Grooming toàn diện cho Miu vào 30/09, 09:00.", createdAt: "2026-09-29T14:55:00+07:00", readAt: null, bookingId: "PF-2084" },
  { id: "NOT-002", recipientOwnerId: "owner-demo", facilityId: "MOCK-PAWCARE", kind: "newBooking", title: "Yêu cầu đặt lịch mới", body: "PF-2083 · Quang Minh đặt Tắm & vệ sinh cho Bắp vào 30/09, 14:30.", createdAt: "2026-09-29T14:42:00+07:00", readAt: null, bookingId: "PF-2083" },
  { id: "NOT-003", recipientOwnerId: "owner-demo", facilityId: "MOCK-PAWCARE", kind: "upcomingBooking", title: "Sắp đến giờ hẹn", body: "PF-2079 · Lan Phương và Bon có lịch vào 01/10, 10:00.", createdAt: "2026-09-29T08:30:00+07:00", readAt: null, bookingId: "PF-2079" },
  { id: "NOT-004", recipientOwnerId: "owner-demo", facilityId: "MOCK-PAWCARE", kind: "bookingCancelled", title: "Khách đã hủy lịch", body: "PF-2068 · Đức Huy đã hủy lịch Tắm & vệ sinh ngày 26/09.", createdAt: "2026-09-29T09:10:00+07:00", readAt: "2026-09-29T09:20:00+07:00", bookingId: "PF-2068" },
  { id: "NOT-005", recipientOwnerId: "owner-demo", facilityId: "MOCK-PAWCARE", kind: "newReview", title: "Đánh giá mới", body: "PawCare Studio nhận đánh giá sau một lịch đã hoàn thành.", createdAt: "2026-09-28T14:20:00+07:00", readAt: "2026-09-28T15:00:00+07:00" },
  { id: "NOT-006", recipientOwnerId: "owner-demo", facilityId: "MOCK-PAWCARE", kind: "profileApproved", title: "Hồ sơ được duyệt", body: "Thông tin PawCare Studio đã được quản trị viên phê duyệt.", createdAt: "2026-09-27T15:30:00+07:00", readAt: "2026-09-27T16:00:00+07:00" },
  { id: "NOT-007", recipientOwnerId: "owner-demo", facilityId: "MOCK-PAWCARE", kind: "bookingCompleted", title: "Lịch đã hoàn thành", body: "PF-2075 · Mai Anh và Lạc đã hoàn thành dịch vụ Cắt tỉa lông.", createdAt: "2026-09-27T11:45:00+07:00", readAt: "2026-09-27T12:00:00+07:00", bookingId: "PF-2075" },
  // Boundary fixtures must never reach page state, the list, details or counts.
  { id: "OTHER-OWNER", recipientOwnerId: "another-owner", facilityId: "MOCK-PAWCARE", kind: "newBooking", title: "Thông báo của người nhận khác", body: "Không thuộc Owner hiện tại.", createdAt: "2026-09-29T14:59:00+07:00", readAt: null },
  { id: "OTHER-FACILITY", recipientOwnerId: "owner-demo", facilityId: "MOCK-OTHER", kind: "newBooking", title: "Thông báo của cơ sở khác", body: "Không thuộc cơ sở đang quản lý.", createdAt: "2026-09-29T14:58:00+07:00", readAt: null },
  { id: "OTHER-BOTH", recipientOwnerId: "another-owner", facilityId: "MOCK-OTHER", kind: "newReview", title: "Thông báo ngoài phạm vi", body: "Không thuộc Owner hoặc cơ sở hiện tại.", createdAt: "2026-09-29T14:57:00+07:00", readAt: null },
];

export function createNotificationsMockData(empty = false, longContent = false): ProviderNotification[] {
  if (empty) return [];
  return source.map((item) => ({ ...item, body: longContent && item.id === "NOT-005" ? `${Array.from({ length: 35 }, () => item.body).join("\n\n")}\n\nKết thúc nội dung dài mô phỏng.` : item.body }));
}
