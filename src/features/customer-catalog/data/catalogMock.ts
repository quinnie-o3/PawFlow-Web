import type { MockCatalog, MockProvider, MockService, MockSlot } from "../types";

export const MOCK_NOW = "2026-11-04T10:00:00+07:00";
export const categories = [{ id: "bath", name: "Tắm & spa" }, { id: "groom", name: "Cắt tỉa" }, { id: "boarding", name: "Trông giữ" }] as const;
export const areas = [{ id: "q3", name: "Quận 3" }, { id: "q1", name: "Quận 1" }, { id: "phunhuan", name: "Phú Nhuận" }, { id: "q7", name: "Quận 7" }] as const;
const asset = (file: string) => `/customer-discovery/${file}`;
const providers: MockProvider[] = [
  { id: "1", name: "Pet House", area: "q3", address: "Quận 3 · TP.HCM", rating: 4.6, ratingCount: 86, image: asset("6f46b.png"), species: ["dog", "cat"], description: "Dịch vụ chăm sóc thường ngày với tư vấn trước buổi hẹn." },
  { id: "2", name: "Mây Pet Spa", area: "q1", address: "Quận 1 · TP.HCM", rating: 4.8, ratingCount: 42, image: asset("d63b9.png"), species: ["dog", "cat"], description: "Chăm sóc bộ lông và vệ sinh cho thú cưng theo nhu cầu." },
  { id: "3", name: "Nhà Mèo Nhỏ", area: "phunhuan", address: "Phú Nhuận · TP.HCM", rating: 4.7, ratingCount: 35, image: asset("85793.png"), species: ["cat"], description: "Không gian dành cho mèo, trao đổi thói quen của bé trước khi gửi yêu cầu." },
  { id: "4", name: "Bông Grooming", area: "q7", address: "Quận 7 · TP.HCM", rating: 4.6, ratingCount: 69, image: asset("edaa7.png"), species: ["dog"], description: "Tư vấn kiểu lông và chăm sóc phù hợp với từng bé." },
].map((p, fixtureOrder) => ({ ...p, approval: "APPROVED", hours: "09:00–18:00", fixtureOrder } as MockProvider));
// Additional, explicitly labelled fixtures exercise pagination and missing-data states.
providers.push(
  { id: "5", name: "Vườn Thú Cưng · mẫu", area: "q3", address: "Quận 3 · TP.HCM", rating: 4.8, ratingCount: 12, image: null, species: null, description: "Cơ sở mẫu bổ sung để xem phân trang và lịch hết chỗ.", approval: "APPROVED", hours: "09:00–18:00", fixtureOrder: 4 },
  { id: "6", name: "Góc Nhỏ · mẫu", area: "q1", address: "Quận 1 · TP.HCM", rating: null, ratingCount: null, image: null, species: null, description: "Cơ sở mẫu chưa có đủ thông tin giá, đánh giá và lịch.", approval: "APPROVED", hours: null, fixtureOrder: 5 },
  { id: "7", name: "An Nhiên · mẫu", area: "q7", address: "Quận 7 · TP.HCM", rating: null, ratingCount: 0, image: null, species: ["dog", "cat"], description: "Cơ sở mẫu chưa có đánh giá hoặc lịch được công bố.", approval: "APPROVED", hours: null, fixtureOrder: 6 },
  { id: "8", name: "Cơ sở chưa duyệt · mẫu", area: "q3", address: "Quận 3 · TP.HCM", rating: null, ratingCount: 0, image: null, species: null, description: "", approval: "PENDING", hours: null, fixtureOrder: 7 },
  { id: "9", name: "Cơ sở tạm ngưng · mẫu", area: "q3", address: "Quận 3 · TP.HCM", rating: 4.9, ratingCount: 20, image: null, species: null, description: "", approval: "SUSPENDED", hours: null, fixtureOrder: 8 },
);
function service(id: string, providerId: string, name: string, categoryId: MockService["categoryId"], price: string | null, durationMinutes: number | null, changes: Partial<MockService> = {}): MockService {
  return { id, providerId, name, categoryId, price, durationMinutes, description: "Trao đổi với cơ sở về nhu cầu và tình trạng thực tế của thú cưng.", active: true, categoryActive: true, schedule: "known", image: null, ...changes };
}
const services: MockService[] = [
  service("101", "1", "Tắm & vệ sinh", "bath", "250000.00", 60, { image: asset("6f46b.png") }),
  service("102", "1", "Cắt tỉa lông", "groom", "350000.00", 90, { image: "/customer-provider-detail/b87b9.png" }),
  service("103", "1", "Vệ sinh tai & móng", "groom", "90000.00", 30, { active: false }),
  service("104", "1", "Dịch vụ danh mục tạm ẩn", "boarding", "100000.00", 60, { categoryActive: false }),
  service("201", "2", "Tắm & spa", "bath", "280000.00", 60, { image: asset("d63b9.png") }),
  service("202", "2", "Chăm sóc lông", "groom", "320000.00", 75),
  service("301", "3", "Trông giữ theo ca", "boarding", "220000.00", 240, { image: asset("85793.png") }),
  service("302", "3", "Chăm sóc mèo", "bath", "180000.00", 60),
  service("401", "4", "Cắt tỉa lông", "groom", "300000.00", 75, { image: asset("edaa7.png") }),
  service("402", "4", "Tắm & vệ sinh", "bath", "250000.00", 60),
  service("501", "5", "Trông giữ ban ngày", "boarding", "220000.00", 240),
  service("601", "6", "Tư vấn chăm sóc", "bath", null, null, { schedule: "unknown", description: null }),
  service("701", "7", "Tắm dịu nhẹ", "bath", "0.00", 30),
  service("801", "8", "Tắm & spa", "bath", "100000.00", 60),
  service("901", "9", "Cắt tỉa", "groom", "100000.00", 60),
];
function slot(id: string, serviceId: string, date: string, start: string, booked: number | null = 0, changes: Partial<MockSlot> = {}): MockSlot {
  return { id, serviceId, providerId: services.find(s => s.id === serviceId)!.providerId, date, start, end: "18:00", status: "OPEN", capacity: 2, booked, ...changes };
}
const slots = [
  slot("s1", "101", "2026-11-04", "09:00"), // already past at the frozen mock clock
  slot("s2", "101", "2026-11-04", "14:00", 1),
  slot("s3", "101", "2026-11-05", "09:00"),
  slot("s4", "102", "2026-11-05", "10:00", 2),
  slot("s5", "201", "2026-11-05", "11:00"),
  slot("s6", "301", "2026-11-06", "09:00"),
  slot("s7", "401", "2026-11-05", "14:00", 0, { status: "CLOSED" }),
  slot("s8", "501", "2026-11-05", "09:00", 2),
  slot("s9", "402", "2026-11-05", "09:00", null),
];
export function createCatalogMock(): MockCatalog { return structuredClone({ providers, services, slots }); }
