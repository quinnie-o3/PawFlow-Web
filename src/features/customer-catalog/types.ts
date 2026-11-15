/** UI fixture models only. These are not backend DTOs or an API contract. */
export type CategoryId = "bath" | "groom" | "boarding";
export type SortOrder = "fixture" | "rating-desc" | "price-asc" | "price-desc";
export type AreaId = "q3" | "q1" | "phunhuan" | "q7";
export type Species = "dog" | "cat";
export interface MockProvider {
  id: string; name: string; address: string; area: AreaId; description: string;
  approval: "APPROVED" | "PENDING" | "SUSPENDED";
  rating: number | null; ratingCount: number | null; image: string | null;
  fixtureOrder: number; hours: string | null; species: Species[] | null;
}
export interface MockService {
  id: string; providerId: string; categoryId: CategoryId; name: string;
  description: string | null; price: string | null; durationMinutes: number | null;
  active: boolean; categoryActive: boolean; schedule: "known" | "unknown";
  image: string | null;
}
export interface MockSlot {
  id: string; providerId: string; serviceId: string; date: string;
  start: string; end: string; status: "OPEN" | "CLOSED" | "CANCELLED";
  capacity: number | null; booked: number | null;
}
export interface MockCatalog { providers: MockProvider[]; services: MockService[]; slots: MockSlot[] }
export interface DiscoveryQuery {
  q: string; categoryId: CategoryId | ""; area: AreaId | "";
  maxPrice: string; minRating: string; available: boolean; sort: SortOrder; page: number;
}
export interface DiscoveryCard { provider: MockProvider; service: MockService }
export interface DiscoveryResult { cards: DiscoveryCard[]; total: number; pages: number; page: number }
export interface ProviderDetail { provider: MockProvider; services: MockService[] }
export interface MockRequestOptions { signal: AbortSignal; delayMs?: number; fail?: boolean }
