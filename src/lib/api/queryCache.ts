export type QueryKey = readonly (string | number | null)[];
const serialize = (key: QueryKey) => JSON.stringify(key);
const prefixOf = (prefix: QueryKey, key: QueryKey) => prefix.every((part, index) => key[index] === part);

export const queryKeys = {
  identity: () => ["v1", "identity"] as const,
  notifications: {
    all: () => ["v1", "notifications"] as const,
    list: (status: "all" | "unread" | "read", page: number, limit: number, maxId: string | null) => ["v1", "notifications", "list", status, page, limit, maxId] as const,
    unread: () => ["v1", "notifications", "unread"] as const,
    detail: (id: string) => ["v1", "notifications", "detail", id] as const,
  },
  // Pass canonical wire query strings, never draft input or credentials.
  search: (resource: "providers" | "services" | "availability", canonicalQuery: string) => ["v1", "search", resource, canonicalQuery] as const,
};
export const queryFreshness = { identity: 0, notifications: 0, availability: 0, publicSearch: 30_000 } as const;

/** Per app/session instance, never a server singleton. No automatic fetch or persistence. */
export class QueryCache {
  private epoch = 0;
  private scope: string | null = null;
  private entries = new Map<string, { key: QueryKey; value: unknown; expiresAt: number }>();
  constructor(private readonly capacity = 100) {
    if (!Number.isSafeInteger(capacity) || capacity < 1) throw new RangeError("Invalid cache capacity");
  }
  /** Call on every confirmed login/account switch/logout, even when the user id repeats. */
  changeSession(scope: string | null) { this.scope = scope; this.epoch++; this.entries.clear(); }
  ticket(key: QueryKey) { return { key, epoch: this.epoch, scope: this.scope }; }
  write<T>(ticket: ReturnType<QueryCache["ticket"]>, value: T, staleTime: number, now = Date.now()): boolean {
    if (ticket.epoch !== this.epoch || ticket.scope !== this.scope || !this.scope) return false;
    const id = serialize(ticket.key);
    this.entries.delete(id);
    this.entries.set(id, { key: [...ticket.key], value, expiresAt: now + Math.max(0, staleTime) });
    while (this.entries.size > this.capacity) this.entries.delete(this.entries.keys().next().value!);
    return true;
  }
  read<T>(key: QueryKey, now = Date.now()): T | undefined {
    const id = serialize(key); const entry = this.entries.get(id);
    if (!entry || entry.expiresAt <= now) { this.entries.delete(id); return undefined; }
    return entry.value as T;
  }
  invalidate(prefix: QueryKey) {
    this.epoch++; // A response started before a mutation cannot repopulate stale data.
    for (const [id, entry] of this.entries) if (prefixOf(prefix, entry.key)) this.entries.delete(id);
  }
}
