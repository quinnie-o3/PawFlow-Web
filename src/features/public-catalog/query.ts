export const PUBLIC_PAGE_SIZE = 4;
export const PUBLIC_SORTS = ["newest", "rating_desc", "price_asc", "price_desc"] as const;
export type PublicSort = (typeof PUBLIC_SORTS)[number];
export type SearchQuery = { q: string; categoryId: string; location: string; maxPrice: string; minRating: string; sort: string; page: number };
export const initialQuery: SearchQuery = { q: "", categoryId: "", location: "", maxPrice: "", minRating: "", sort: "newest", page: 1 };
export const validId = (value: unknown): value is string => typeof value === "string" && /^[1-9]\d{0,18}$/.test(value) && BigInt(value) <= BigInt("9223372036854775807");
export function keywordValid(value: string) {
  return [...value.trim()].length <= 100 && !/[\u0000-\u001f\u007f]/.test(value) && new Set(value.trim().toLowerCase().split(/\s+/).filter(Boolean)).size <= 8;
}
export function priceMinor(value: string): number | null {
  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return minor <= 999999999999 ? minor : null;
}
export function exclusivePrice(value: string) {
  const minor = priceMinor(value);
  return minor === null || minor === 0 ? null : ((minor - 1) / 100).toFixed(2);
}
export function serializeSearch(query: SearchQuery) {
  const p = new URLSearchParams();
  for (const key of ["q", "categoryId", "location", "maxPrice", "minRating"] as const) if (query[key]) p.set(key, query[key].trim());
  if (query.sort !== "newest") p.set("sort", query.sort);
  if (query.page !== 1) p.set("page", String(query.page));
  return p.toString();
}
export function parseSearch(params: URLSearchParams) {
  const q: SearchQuery = { ...initialQuery };
  for (const key of ["q", "categoryId", "location", "maxPrice", "minRating", "sort"] as const) if (params.has(key)) q[key] = params.get(key)!.trim();
  const issues: string[] = [], notices: string[] = [];
  const known = new Set(["q", "categoryId", "location", "maxPrice", "minRating", "sort", "page", "available", "area", "catalog"]);
  if ([...params.keys()].some(key => !known.has(key))) notices.push("unknown");
  if ([...known].some(key => params.getAll(key).length > 1)) issues.push("duplicate");
  if (params.has("catalog") && params.get("catalog") !== "live") issues.push("source");
  if (params.has("available")) issues.push("available");
  if (params.has("area")) {
    const areas: Record<string, string> = { q3: "Quận 3", q1: "Quận 1", phunhuan: "Phú Nhuận", q7: "Quận 7" };
    if (!q.location && Object.hasOwn(areas, params.get("area")!)) { q.location = areas[params.get("area")!]; notices.push("area"); }
    else issues.push("area");
  }
  const legacySort: Record<string, string> = { fixture: "newest", "rating-desc": "rating_desc", "price-asc": "price_asc", "price-desc": "price_desc" };
  if (Object.hasOwn(legacySort, q.sort)) { q.sort = legacySort[q.sort]; notices.push("sort"); }
  if (!keywordValid(q.q)) issues.push("keyword");
  if (q.categoryId && !validId(q.categoryId)) issues.push("category");
  if ([...q.location].length > 100 || /[\u0000-\u001f\u007f]/.test(q.location)) issues.push("location");
  if (q.maxPrice && priceMinor(q.maxPrice) === null) issues.push("price");
  if (q.minRating && (!/^\d(?:\.\d{1,2})?$/.test(q.minRating) || Number(q.minRating) > 5)) issues.push("rating");
  if (!PUBLIC_SORTS.includes(q.sort as PublicSort)) issues.push("sort");
  const page = params.get("page");
  if (page !== null) {
    if (!/^[1-9]\d{0,3}$/.test(page) || Number(page) > 1000) issues.push("page");
    else q.page = Number(page);
  }
  // Invalid conditions stay in the URL until the user explicitly changes/removes them.
  const canonical = issues.length ? new URLSearchParams([...params].filter(([key]) => known.has(key))).toString() : serializeSearch(q);
  return { query: q, issues, notices, canonical, emptyPrice: q.maxPrice !== "" && priceMinor(q.maxPrice) === 0 };
}
export function searchWire(query: SearchQuery, limit = PUBLIC_PAGE_SIZE) {
  const p = new URLSearchParams(serializeSearch(query));
  if (query.maxPrice) {
    const price = exclusivePrice(query.maxPrice);
    if (price === null) throw new Error("Invalid exclusive price");
    p.set("maxPrice", price);
  }
  p.set("sort", query.sort); p.set("page", String(query.page)); p.set("limit", String(limit));
  return p.toString();
}
export const searchHref = (query: SearchQuery) => "/discover" + (serializeSearch(query) ? "?" + serializeSearch(query) : "");
export function publicReturnTo(value: string | null) {
  if (!value || value.length > 2000 || /[\\\u0000-\u0020\u007f]/.test(value) || !/^\/discover(?:\?|#|$)/.test(value)) return "/discover";
  try { const url = new URL(value, "https://pawflow.invalid"); if (url.pathname !== "/discover" || url.origin !== "https://pawflow.invalid" || (url.searchParams.has("catalog") && url.searchParams.get("catalog") !== "live")) return "/discover"; const s = parseSearch(url.searchParams).canonical; return "/discover" + (s ? "?" + s : ""); } catch { return "/discover"; }
}
export function publicDetailHref(providerId: string, returnTo: string, serviceId?: string) {
  const p = new URLSearchParams({ returnTo: publicReturnTo(returnTo) });
  if (serviceId) p.set("serviceId", serviceId);
  return `/providers/${encodeURIComponent(providerId)}?${p}`;
}
export function pageWindow(page: number, pages: number) {
  const last = Math.min(pages, 1000), start = Math.max(1, Math.min(page - 2, last - 4));
  return Array.from({ length: Math.max(0, Math.min(5, last - start + 1)) }, (_, i) => start + i);
}
