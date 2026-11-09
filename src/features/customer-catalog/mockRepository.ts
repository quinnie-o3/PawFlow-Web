import { vi } from "../../lib/locale";
import { createCatalogMock } from "./data/catalogMock";
import { searchCatalog } from "../customer-discovery/searchLogic";
import type { DiscoveryQuery, MockCatalog, MockRequestOptions, ProviderDetail } from "./types";

export function mockDelay({ signal, delayMs = 300, fail = false }: MockRequestOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException("Aborted", "AbortError")); return; }
    const abort = () => { clearTimeout(timer); signal.removeEventListener("abort", abort); reject(new DOMException("Aborted", "AbortError")); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); if (fail) reject(new Error(vi.discovery.catalog.errors.retry)); else resolve(); }, Math.min(5000, Math.max(0, delayMs)));
    signal.addEventListener("abort", abort, { once: true });
  });
}
/** Protects against even a non-cooperative loader resolving after cancellation. */
export class LatestRequest {
  private version = 0;
  start(): number { return ++this.version; }
  isCurrent(ticket: number): boolean { return this.version === ticket; }
  cancel(ticket: number): void { if (this.isCurrent(ticket)) this.version++; }
}
export function createMockRepository(catalog: MockCatalog = createCatalogMock()) {
  return {
    async search(query: DiscoveryQuery, now: string, options: MockRequestOptions) { await mockDelay(options); return structuredClone(searchCatalog(catalog, query, now)); },
    async detail(providerId: string, options: MockRequestOptions): Promise<ProviderDetail | null> {
      await mockDelay(options);
      const provider = catalog.providers.find(p => p.id === providerId && p.approval === "APPROVED");
      return provider ? structuredClone({ provider, services: catalog.services.filter(s => s.providerId === providerId) }) : null;
    },
    async availability(providerId: string, options: MockRequestOptions) { await mockDelay(options); return catalog.providers.some(p => p.id === providerId && p.approval === "APPROVED") ? structuredClone(catalog.slots.filter(s => s.providerId === providerId)) : []; },
  };
}
export const mockRepository = createMockRepository();
