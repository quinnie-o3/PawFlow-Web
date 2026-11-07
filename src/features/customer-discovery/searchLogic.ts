import { categories } from "../customer-catalog/data/catalogMock";
import { hasAvailability, moneyMinor, providerRating, publicService } from "../customer-catalog/catalogLogic";
import type { DiscoveryCard, DiscoveryQuery, DiscoveryResult, MockCatalog, MockService } from "../customer-catalog/types";

export const PAGE_SIZE = 4;
export function normalizeSearch(text: string): string { return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLocaleLowerCase("vi-VN"); }
function compareNullable(a: number | null, b: number | null, direction: 1 | -1): number { return a === null ? b === null ? 0 : 1 : b === null ? -1 : (a - b) * direction; }
export function searchCatalog(catalog: MockCatalog, query: DiscoveryQuery, now: string): DiscoveryResult {
  const cards: DiscoveryCard[] = [];
  const needle = normalizeSearch(query.q);
  for (const provider of catalog.providers) {
    if (provider.approval !== "APPROVED" || query.area && provider.area !== query.area) continue;
    const rating = providerRating(provider);
    if (query.minRating && (rating === null || rating < Number(query.minRating))) continue;
    const matching = catalog.services.filter(service => {
      if (!publicService(provider, service) || query.categoryId && service.categoryId !== query.categoryId) return false;
      const price = moneyMinor(service.price);
      if (query.maxPrice && (price === null || price >= moneyMinor(query.maxPrice)!)) return false;
      if (query.available && !hasAvailability(catalog, service, now)) return false;
      return !needle || [provider.name, provider.address, service.name, categories.find(c => c.id === service.categoryId)?.name ?? ""].some(field => normalizeSearch(field).includes(needle));
    });
    if (!matching.length) continue;
    // Representative service is also the source of the displayed/sorted price and detail link.
    if (query.sort.startsWith("price-")) matching.sort((a: MockService, b: MockService) => compareNullable(moneyMinor(a.price), moneyMinor(b.price), query.sort === "price-asc" ? 1 : -1) || a.id.localeCompare(b.id));
    cards.push({ provider, service: matching[0] });
  }
  cards.sort((a, b) => {
    const comparison = query.sort === "rating-desc" ? compareNullable(providerRating(a.provider), providerRating(b.provider), -1)
      : query.sort.startsWith("price-") ? compareNullable(moneyMinor(a.service.price), moneyMinor(b.service.price), query.sort === "price-asc" ? 1 : -1) : 0;
    return comparison || a.provider.fixtureOrder - b.provider.fixtureOrder || a.provider.id.localeCompare(b.provider.id);
  });
  const total = cards.length; const pages = Math.max(1, Math.ceil(total / PAGE_SIZE)); const page = Math.min(query.page, pages);
  return { cards: cards.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), total, pages, page };
}
