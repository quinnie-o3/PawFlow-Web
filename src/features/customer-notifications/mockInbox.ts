import { vi, formatMessage } from "../../lib/locale";
import { isRequestCancelled, throwIfCancelled } from "../../lib/api/errors";
import { markCapturedRead, type InboxNotification } from "../notifications/model";

const copy = vi.customerInbox;
const NOW = "2026-11-17T03:00:00.000Z";
export function inboxFixtures(): InboxNotification[] {
  return [
    { id: "104", type: "SYSTEM_ANNOUNCEMENT", title: copy.providerTitle, body: copy.providerBody, target: { type: "PROVIDER", id: "1" }, createdAt: NOW, readAt: null },
    { id: "103", type: "BOOKING_CONFIRMED", title: copy.missingTitle, body: copy.missingBody, target: { type: "BOOKING", id: "PF-MISSING" }, createdAt: "2026-11-16T08:00:00.000Z", readAt: null },
    { id: "102", type: "REVIEW_RECEIVED", title: copy.unsupportedTitle, body: copy.unsupportedBody, target: { type: "REVIEW", id: "1" }, createdAt: "2026-11-15T08:00:00.000Z", readAt: null },
    { id: "101", type: "SYSTEM_ANNOUNCEMENT", title: copy.systemTitle, body: copy.systemBody, target: null, createdAt: "2026-11-14T08:00:00.000Z", readAt: "2026-11-14T09:00:00.000Z" },
  ];
}

export function inboxDelay(signal: AbortSignal, milliseconds = 650): Promise<void> {
  return new Promise((resolve, reject) => {
    throwIfCancelled(signal);
    const abort = () => { clearTimeout(timer); reject(new DOMException("Cancelled", "AbortError")); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, milliseconds);
    signal.addEventListener("abort", abort, { once: true });
  });
}
type Pending = { kind: "load" } | { kind: "read"; id: string } | { kind: "readAll" };
export type InboxSnapshot = {
  items: InboxNotification[]; status: "idle" | "loading" | "ready" | "error"; pending: Pending | null;
  error: { kind: "load" | "read" | "readAll"; id?: string; message: string } | null;
  notice: string | null; failLoad: boolean; failUpdate: boolean;
};

/** One source for the mock list and all Customer badges. No global state or persistence. */
export class MockInbox {
  private snapshot: InboxSnapshot = { items: inboxFixtures(), status: "loading", pending: null, error: null, notice: null, failLoad: false, failUpdate: false };
  private listeners = new Set<() => void>();
  private controller: AbortController | null = null;
  private failedRead: { id?: string; ids: ReadonlySet<string> } | null = null;
  private nextId = 105;
  private now = Date.parse(NOW);
  setFailure = (kind: "load" | "update", enabled: boolean) => this.patch(kind === "load" ? { failLoad: enabled } : { failUpdate: enabled });
  constructor(private readonly wait = inboxDelay) {}
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private patch(patch: Partial<InboxSnapshot>) { this.snapshot = { ...this.snapshot, ...patch }; this.listeners.forEach(listener => listener()); }
  private begin(pending: Pending) {
    if (this.controller) return null;
    const controller = new AbortController(); this.controller = controller;
    this.patch({ pending, error: null, notice: null }); return controller;
  }
  private async perform(pending: Pending, fail: boolean, apply: () => void) {
    const controller = this.begin(pending);
    if (!controller) return false;
    if (pending.kind === "load") this.patch({ status: "loading" });
    try {
      await this.wait(controller.signal); throwIfCancelled(controller.signal);
      if (this.controller !== controller) return false;
      if (fail) throw new Error("Mock failure");
      apply(); return true;
    } catch (error) {
      if (this.controller === controller && !isRequestCancelled(error)) this.patch({
        ...(pending.kind === "load" ? { status: "error" as const } : {}),
        error: { ...pending, message: pending.kind === "load" ? copy.loadError : copy.updateError },
      });
      return false;
    } finally {
      if (this.controller === controller) { this.controller = null; this.patch({ pending: null }); }
    }
  }
  load = () => {
    if (this.controller) return Promise.resolve(false);
    const fail = this.snapshot.failLoad; this.patch({ failLoad: false });
    return this.perform({ kind: "load" }, fail, () => this.patch({ status: "ready" }));
  };
  read = (id?: string, captured?: ReadonlySet<string>) => {
    if (this.controller || this.snapshot.status !== "ready") return Promise.resolve(false);
    const ids = captured ?? new Set(this.snapshot.items.filter(item => item.readAt === null && (!id || item.id === id)).map(item => item.id));
    if (!ids.size) return Promise.resolve(true);
    const fail = this.snapshot.failUpdate; this.patch({ failUpdate: false });
    const attempt = { id, ids }; this.failedRead = attempt;
    return this.perform(id ? { kind: "read", id } : { kind: "readAll" }, fail, () => this.patch({
      items: markCapturedRead(this.snapshot.items, ids, new Date(this.now).toISOString()), notice: id ? copy.readSuccess : copy.allSuccess,
    })).then(ok => {
      if (this.failedRead === attempt && (ok || !this.snapshot.error)) this.failedRead = null;
      return ok;
    });
  };
  retry = () => {
    const error = this.snapshot.error;
    return error?.kind === "load" ? this.load() : error ? this.read(error.id, this.failedRead?.ids) : Promise.resolve(false);
  };
  cancel = (announce = true) => {
    if (!this.controller) return;
    const loading = this.snapshot.pending?.kind === "load";
    this.controller.abort(); this.controller = null;
    this.patch({ pending: null, ...(loading ? { status: "idle" as const } : {}), error: null, notice: announce ? copy.cancelled : null });
  };
  dispose = () => this.cancel(false);
  dismiss = () => this.patch({ notice: null });
  arrive = (bookingId?: string) => {
    const id = String(this.nextId++);
    const item: InboxNotification = { id, type: bookingId ? "BOOKING_CONFIRMED" : "SYSTEM_ANNOUNCEMENT",
      title: bookingId ? formatMessage(copy.bookingTitle, { id: bookingId }) : copy.arrivalTitle,
      body: bookingId ? copy.bookingBody : copy.arrivalBody, target: bookingId ? { type: "BOOKING", id: bookingId } : null,
      createdAt: new Date(this.now += 1000).toISOString(), readAt: null };
    this.patch({ items: [item, ...this.snapshot.items], notice: copy.newArrival });
  };
  reset = (empty = false) => {
    this.cancel(false); this.failedRead = null;
    this.patch({ items: empty ? [] : inboxFixtures(), status: "ready", pending: null, error: null, notice: null, failLoad: false, failUpdate: false });
  };
}
