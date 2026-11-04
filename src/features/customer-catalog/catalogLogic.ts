import type { MockCatalog, MockProvider, MockService, MockSlot, Species } from "./types";

export const TIME_ZONE = "Asia/Ho_Chi_Minh";
export function moneyMinor(value: string | null): number | null {
  if (value === null || !/^\d{1,10}(\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}
export function formatPrice(value: string | null): string {
  const minor = moneyMinor(value);
  return minor === null ? "Chưa có giá" : new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: minor % 100 ? 2 : 0 }).format(minor / 100);
}
export function formatDuration(value: number | null): string { return value !== null && Number.isInteger(value) && value > 0 ? `${value} phút` : "Chưa có thời lượng"; }
export function providerRating(provider: MockProvider): number | null { return provider.ratingCount !== null && provider.ratingCount > 0 && provider.rating !== null && Number.isFinite(provider.rating) && provider.rating >= 0 && provider.rating <= 5 ? provider.rating : null; }
export function formatRating(provider: MockProvider): string {
  if (provider.ratingCount === 0) return "Chưa có đánh giá";
  const rating = providerRating(provider);
  return rating === null ? "Chưa có dữ liệu đánh giá" : `${rating.toLocaleString("vi-VN")} / 5 · ${provider.ratingCount} đánh giá`;
}
export function validDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function formatDateOnly(value: string): string { return validDateOnly(value) ? value.split("-").reverse().join("/") : "Chưa có ngày"; }
function validTime(value: string): boolean { return /^([01]\d|2[0-3]):[0-5]\d$/.test(value); }
export function slotInstant(slot: MockSlot): number | null { return validDateOnly(slot.date) && validTime(slot.start) ? Date.parse(`${slot.date}T${slot.start}:00+07:00`) : null; }
export function remaining(slot: MockSlot): number | null {
  return slot.capacity !== null && slot.booked !== null && Number.isInteger(slot.capacity) && slot.capacity > 0 && Number.isInteger(slot.booked) && slot.booked >= 0 && slot.booked <= slot.capacity ? slot.capacity - slot.booked : null;
}
export type SlotState = "past" | "closed" | "full" | "unknown" | "available";
export function slotState(slot: MockSlot, now: string): SlotState {
  const instant = slotInstant(slot); const current = Date.parse(now);
  if (instant === null || !Number.isFinite(current) || !validTime(slot.end) || slot.end <= slot.start) return "unknown";
  if (instant <= current) return "past";
  if (slot.status !== "OPEN") return "closed";
  const count = remaining(slot);
  return count === null ? "unknown" : count === 0 ? "full" : "available";
}
export function publicService(provider: MockProvider, service: MockService): boolean { return provider.approval === "APPROVED" && service.providerId === provider.id && service.active && service.categoryActive; }
export function serviceSlots(catalog: MockCatalog, service: MockService): MockSlot[] { return catalog.slots.filter(s => s.providerId === service.providerId && s.serviceId === service.id).sort((a, b) => `${a.date}T${a.start}`.localeCompare(`${b.date}T${b.start}`) || a.id.localeCompare(b.id)); }
export function hasAvailability(catalog: MockCatalog, service: MockService, now: string): boolean { return service.schedule === "known" && serviceSlots(catalog, service).some(s => slotState(s, now) === "available"); }
export function availabilityLabel(service: MockService, slots: MockSlot[], now: string): string {
  if (service.schedule === "unknown") return "Chưa biết lịch khả dụng";
  if (slots.some(s => slotState(s, now) === "available")) return "Có khung giờ còn chỗ";
  if (slots.some(s => slotState(s, now) === "unknown")) return "Chưa biết số chỗ";
  if (slots.some(s => slotState(s, now) === "full")) return "Hết chỗ trong lịch công bố";
  if (slots.some(s => slotState(s, now) === "closed")) return "Lịch đang đóng";
  if (slots.length) return "Chưa có lịch sắp tới";
  return "Chưa có lịch công bố";
}
export function mockEligibility(provider: MockProvider, species: Species | "none"): string {
  if (species === "none") return "Chưa có hồ sơ thú cưng mẫu. Bạn vẫn có thể xem toàn bộ thông tin công khai.";
  if (provider.species === null) return "Chưa có thông tin loại thú cưng được tiếp nhận trong dữ liệu mẫu.";
  return provider.species.includes(species) ? "Loại thú cưng mẫu phù hợp theo dữ liệu mô phỏng." : "Loại thú cưng mẫu chưa phù hợp với cơ sở này theo dữ liệu mô phỏng.";
}
