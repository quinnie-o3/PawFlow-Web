import { areas, categories } from "../customer-catalog/data/catalogMock";
import { moneyMinor } from "../customer-catalog/catalogLogic";
import type { DiscoveryQuery, SortOrder } from "../customer-catalog/types";

export const defaultQuery: DiscoveryQuery = { q: "", categoryId: "", area: "", maxPrice: "", minRating: "", available: false, sort: "fixture", page: 1 };
const sorts: SortOrder[] = ["fixture", "rating-desc", "price-asc", "price-desc"];
export function cleanSearch(value: string): string { return value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 120); }
export function parseDiscoveryQuery(params: URLSearchParams): DiscoveryQuery {
  const rawPrice = params.get("maxPrice") ?? ""; const minor = moneyMinor(rawPrice);
  const rawRating = params.get("minRating") ?? ""; const rawPage = params.get("page") ?? "";
  const rating = /^\d(\.\d)?$/.test(rawRating) && Number(rawRating) <= 5 ? String(Number(rawRating)) : "";
  const price = minor !== null ? String(minor / 100) : "";
  const categoryId = categories.find(c => c.id === params.get("categoryId"))?.id ?? "";
  const area = areas.find(a => a.id === params.get("area"))?.id ?? "";
  const sort = sorts.find(s => s === params.get("sort")) ?? "fixture";
  const page = /^[1-9]\d{0,5}$/.test(rawPage) ? Number(rawPage) : 1;
  return { q: cleanSearch(params.get("q") ?? ""), categoryId, area, maxPrice: price, minRating: rating, available: params.get("available") === "1", sort, page };
}
export function serializeQuery(query: DiscoveryQuery): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.categoryId) params.set("categoryId", query.categoryId);
  if (query.area) params.set("area", query.area);
  if (query.maxPrice) params.set("maxPrice", query.maxPrice);
  if (query.minRating) params.set("minRating", query.minRating);
  if (query.available) params.set("available", "1");
  if (query.sort !== "fixture") params.set("sort", query.sort);
  if (query.page > 1) params.set("page", String(query.page));
  return params.toString();
}
export function discoveryHref(query: DiscoveryQuery): string { const search = serializeQuery(query); return `/discover${search ? `?${search}` : ""}`; }
export function safeReturnTo(value: string | null): string {
  if (!value || value.length > 2000 || /[\\\u0000-\u0020\u007f]/.test(value) || !/^\/discover(?:\?|#|$)/.test(value)) return "/discover";
  try {
    const url = new URL(value, "https://pawflow.invalid");
    if (url.origin !== "https://pawflow.invalid" || url.pathname !== "/discover") return "/discover";
    return discoveryHref(parseDiscoveryQuery(url.searchParams));
  } catch { return "/discover"; }
}
export function detailHref(providerId: string, serviceId: string, returnTo: string): string {
  const params = new URLSearchParams({ serviceId, returnTo: safeReturnTo(returnTo) });
  return `/providers/${encodeURIComponent(providerId)}?${params}`;
}
export function changeCriteria(query: DiscoveryQuery, patch: Partial<DiscoveryQuery>): DiscoveryQuery { return parseDiscoveryQuery(new URLSearchParams(serializeQuery({ ...query, ...patch, page: 1 }))); }
export function presetActive(query: DiscoveryQuery, preset: "nearby" | "rated"): boolean { return preset === "nearby" ? query.area === "q3" && query.maxPrice === "300000" && query.available : query.categoryId === "bath" && query.minRating === "4.5"; }
export function togglePreset(query: DiscoveryQuery, preset: "nearby" | "rated"): DiscoveryQuery {
  const active = presetActive(query, preset);
  return changeCriteria(query, preset === "nearby" ? { area: active ? "" : "q3", maxPrice: active ? "" : "300000", available: !active } : { categoryId: active ? "" : "bath", minRating: active ? "" : "4.5" });
}
