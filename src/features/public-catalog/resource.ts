import { ApiError, throwIfCancelled } from "../../lib/api/errors";
import { QueryCache, type QueryKey } from "../../lib/api/queryCache";

export class PublicTimeout extends ApiError { constructor() { super("network"); } }
export function publicCache() { const cache = new QueryCache(100); cache.changeSession("public-catalog:live"); return cache; }
export const publicKey = (resource: string, query: string): QueryKey => ["v1", "public-catalog", "live", resource, query];

/** One owner per hook: changing intent cancels both rendering and cache writes. */
export class PublicRequest {
  private version = 0;
  private controller?: AbortController;
  cancel() { this.version++; this.controller?.abort(); }
  async run<T>(cache: QueryCache, key: QueryKey, loader: (signal: AbortSignal) => Promise<T>, current: () => boolean, freshness = 30_000, timeoutMs = 8000): Promise<T> {
    this.cancel();
    const version = this.version, controller = new AbortController(); this.controller = controller;
    const check = () => { throwIfCancelled(controller.signal); if (version !== this.version || !current()) throw new DOMException("Superseded", "AbortError"); };
    const cached = cache.read<T>(key); if (cached !== undefined) { check(); return cached; }
    const ticket = cache.ticket(key); let timedOut = false;
    let rejectAbort!: (error: unknown) => void;
    const aborted = new Promise<never>((_, reject) => { rejectAbort = reject; });
    const abort = () => rejectAbort(timedOut ? new PublicTimeout() : new DOMException("Cancelled", "AbortError"));
    controller.signal.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
    try {
      const data = await Promise.race([loader(controller.signal), aborted]);
      check();
      if (freshness > 0) cache.write(ticket, data, freshness);
      return data;
    } finally { clearTimeout(timer); controller.signal.removeEventListener("abort", abort); }
  }
}
