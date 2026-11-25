import { createApiClient } from "../../lib/api/transport";
import { ApiError, throwIfCancelled } from "../../lib/api/errors";
import { validId } from "./query";

export type Category = { id: string; name: string; description: string | null };
export type Provider = { id: string; businessName: string; address: string; description: string | null; ratingAvg: string; ratingCount: number; serviceCount: number; minPrice: string | null; maxPrice: string | null };
export type Service = { id: string; name: string; description: string | null; price: string; durationMinutes: number; category: Category; provider: Omit<Provider, "serviceCount" | "minPrice" | "maxPrice"> };
export type Slot = { id: string; slotDate: string; startTime: string; endTime: string; capacity: number; bookedCount: number; service: Omit<Service, "provider">; provider: Service["provider"] };
export type Meta = { page: number; limit: number; totalItems: number; totalPages: number; hasNextPage: boolean; hasPreviousPage: boolean };
export type Page<T> = { items: T[]; meta: Meta; query: Record<string, string | number | null> };
const object = (v: unknown): Record<string, unknown> => { if (!v || typeof v !== "object" || Array.isArray(v)) throw Error(); return v as Record<string, unknown>; };
const string = (v: unknown): string => { if (typeof v !== "string") throw Error(); return v; };
const nullable = (v: unknown) => v === null ? null : string(v);
const integer = (v: unknown, min = 0): number => { if (typeof v !== "number" || !Number.isSafeInteger(v) || v < min) throw Error(); return v; };
const id = (v: unknown) => { if (!validId(v)) throw Error(); return v; };
const numeric = (v: unknown) => { const s = string(v); if (!/^\d{1,10}\.\d{2}$/.test(s)) throw Error(); return s; };
const rating = (v: unknown) => { const s = numeric(v); if (Number(s) > 5) throw Error(); return s; };
export function decodeCategory(v: unknown): Category { const o = object(v); return { id: id(o.id), name: string(o.name), description: nullable(o.description) }; }
function business(v: unknown): Service["provider"] { const o = object(v); return { id: id(o.id), businessName: string(o.businessName), address: string(o.address), description: nullable(o.description), ratingAvg: rating(o.ratingAvg), ratingCount: integer(o.ratingCount) }; }
export function decodeProvider(v: unknown): Provider {
  const o = object(v), result = { ...business(v), serviceCount: integer(o.serviceCount), minPrice: o.minPrice === null ? null : numeric(o.minPrice), maxPrice: o.maxPrice === null ? null : numeric(o.maxPrice) };
  if ((result.serviceCount === 0) !== (result.minPrice === null && result.maxPrice === null) || (result.serviceCount > 0 && (result.minPrice === null || result.maxPrice === null || Number(result.minPrice) > Number(result.maxPrice)))) throw Error();
  return result;
}
export function decodeService(v: unknown): Service { const o = object(v); return { id: id(o.id), name: string(o.name), description: nullable(o.description), price: numeric(o.price), durationMinutes: integer(o.durationMinutes, 1), category: decodeCategory(o.category), provider: business(o.provider) }; }
export function decodeSlot(v: unknown): Slot {
  const o = object(v), service = object(o.service), provider = business(o.provider);
  const s = decodeService({ ...service, provider });
  const date = string(o.slotDate), start = string(o.startTime), end = string(o.endTime), capacity = integer(o.capacity, 1), booked = integer(o.bookedCount);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(start) || !/^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(end) || new Date(date + "T00:00:00Z").toISOString().slice(0, 10) !== date || end <= start || booked >= capacity) throw Error();
  return { id: id(o.id), slotDate: date, startTime: start, endTime: end, capacity, bookedCount: booked, service: { id: s.id, name: s.name, description: s.description, price: s.price, durationMinutes: s.durationMinutes, category: s.category }, provider };
}
export function decodePage<T>(v: unknown, decode: (v: unknown) => T, wire: URLSearchParams, echoKeys: string[]): Page<T> {
  const o = object(v), m = object(o.meta), q = object(o.query);
  if (!Array.isArray(o.items)) throw Error();
  const meta: Meta = { page: integer(m.page, 1), limit: integer(m.limit, 1), totalItems: integer(m.totalItems), totalPages: integer(m.totalPages), hasNextPage: m.hasNextPage as boolean, hasPreviousPage: m.hasPreviousPage as boolean };
  if (meta.page > 1000 || meta.limit > 50 || meta.page !== Number(wire.get("page") ?? 1) || meta.limit !== Number(wire.get("limit") ?? 20) || meta.totalPages !== Math.ceil(meta.totalItems / meta.limit) || meta.hasNextPage !== (meta.page < meta.totalPages) || meta.hasPreviousPage !== (meta.page > 1) || o.items.length > meta.limit) throw Error();
  const query: Page<T>["query"] = {};
  for (const key of echoKeys) {
    const expected = wire.get(key), actual = q[key], numericFilter = ["minPrice", "maxPrice", "minRating"].includes(key);
    if (expected === null ? actual !== null : numericFilter ? typeof actual !== "number" || actual !== Number(expected) : typeof actual !== "string" || actual !== expected) throw Error();
    query[key] = actual as string | number | null;
  }
  const items = o.items.map(decode);
  if (new Set(items.map(item => (item as { id: string }).id)).size !== items.length) throw Error();
  return { items, meta, query };
}
const searchEcho = ["q", "categoryId", "minPrice", "maxPrice", "minRating", "location", "sort"];
export function createPublicApi(config: Parameters<typeof createApiClient>[0] = {}) {
  async function get<T>(path: string, decode: (v: unknown) => T, signal: AbortSignal) {
    const pathname = path.split("?")[0], last = pathname.split("/").at(-1);
    if (pathname !== "/service-categories" && (!/^\/(providers|services|availability)\/public\/[^/]+$/.test(pathname) || (last !== "search" && !validId(last)))) throw new ApiError("http", 400);
    let retryAfter: number | null = null;
    const client = createApiClient({ ...config, fetchImpl: async (url, init) => {
      const response = await (config.fetchImpl ?? fetch)(url, init), raw = response.headers.get("Retry-After")?.trim();
      if (raw && [429, 503].includes(response.status)) {
        const seconds = /^\d+$/.test(raw) ? Number(raw) : Math.ceil((Date.parse(raw) - Date.now()) / 1000);
        if (Number.isSafeInteger(seconds) && seconds >= 0) retryAfter = Math.max(1, seconds);
      }
      return response;
    } });
    try {
      const result = await client.request(path, { credentials: "omit", signal, decode: v => { throwIfCancelled(signal); const value = decode(v); throwIfCancelled(signal); return value; } });
      throwIfCancelled(signal); return result.body as T;
    } catch (error) {
      // Public limiter windows can exceed the shared transport's 15-minute UI cap.
      if (error instanceof ApiError && retryAfter !== null && retryAfter > (error.retryAfterSeconds ?? 0)) throw new ApiError(error.kind, error.status, error.code, error.serverMessage, retryAfter);
      throw error;
    }
  }
  return {
    categories: (signal: AbortSignal) => get("/service-categories", v => { if (!Array.isArray(v)) throw Error(); return v.map(decodeCategory); }, signal),
    providers: (wire: string, signal: AbortSignal) => get("/providers/public/search?" + wire, v => decodePage(v, decodeProvider, new URLSearchParams(wire), searchEcho), signal),
    provider: (providerId: string, signal: AbortSignal) => get("/providers/public/" + providerId, v => { const p = decodeProvider(v); if (p.id !== providerId) throw Error(); return p; }, signal),
    services: (providerId: string, page: number, signal: AbortSignal) => { const wire = new URLSearchParams({ providerId, page: String(page), limit: "20", sort: "newest" }); return get("/services/public/search?" + wire, v => { const p = decodePage(v, decodeService, wire, [...searchEcho, "providerId"]); if (p.items.some(s => s.provider.id !== providerId)) throw Error(); return p; }, signal); },
    service: (providerId: string, serviceId: string, signal: AbortSignal) => get("/services/public/" + serviceId, v => { const s = decodeService(v); if (s.id !== serviceId || s.provider.id !== providerId) throw Error(); return s; }, signal),
    slots: (providerId: string, serviceId: string, page: number, signal: AbortSignal) => { const wire = new URLSearchParams({ providerId, serviceId, page: String(page), limit: "20" }); return get("/availability/public/search?" + wire, v => { const p = decodePage(v, decodeSlot, wire, ["providerId", "serviceId", "date", "fromDate", "toDate"]); if (p.items.some(s => s.provider.id !== providerId || s.service.id !== serviceId)) throw Error(); return p; }, signal); },
  };
}
