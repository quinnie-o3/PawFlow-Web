import type { MockCatalog } from "../customer-catalog/types";
import type { PetState } from "../customer-pets/types";
import { slotInstant } from "../customer-catalog/catalogLogic";
import {
  addComplaint, addReview, cancelBooking, changeSelection, createBooking,
  lookupAttempt, payloadFingerprint, reviewDraft,
} from "./bookingLogic";
import { emptyBookingState, type Actor, type BookingDraft, type BookingFacts, type BookingState, type ErrorCode, type Mutation } from "./model";
import { beginReconciliation, beginSubmission, finishReconciliation, settleSubmission, type SubmissionState } from "./submissionLogic";

export type SubmitFault = "none" | "before-create" | "timeout-before" | "timeout-after" | "slow-timeout";
export type BookingFlow = Readonly<{ draft: BookingDraft; submission: SubmissionState; error: ErrorCode | null }>;
export type WorkspaceSnapshot = Readonly<{
  catalog: MockCatalog; booking: BookingState;
  flows: Readonly<Record<string, BookingFlow>>; revision: number; now: number;
}>;
export type SubmitContext = {
  actor: Actor; pets: () => PetState; now: () => number; delayMs: number; fault: SubmitFault;
};

export function bookingFacts(catalog: MockCatalog, pets: PetState, draft: BookingDraft): BookingFacts {
  const pet = pets.pets.find(p => p.id === draft.petId);
  const provider = catalog.providers.find(p => p.id === draft.providerId);
  const service = catalog.services.find(s => s.id === draft.serviceId);
  const slot = catalog.slots.find(s => s.id === draft.slotId);
  return {
    pet: pet ? { id: pet.id, ownerId: pet.ownerId, active: pet.status === "ACTIVE" } : null,
    provider: provider ? { id: provider.id, approved: provider.approval === "APPROVED" } : null,
    service: service ? { ...service, categoryActive: service.categoryActive } : null,
    slot: slot ? {
      id: slot.id, providerId: slot.providerId, serviceId: slot.serviceId,
      status: slot.status, capacity: slot.capacity, booked: slot.booked,
      startAt: slotInstant(slot) ?? NaN, endAt: slotInstant({ ...slot, start: slot.end }) ?? NaN,
    } : null,
  };
}

export function initialFlow(providerId: string, serviceId: string | null, petId: string | null): BookingFlow {
  return { draft: { providerId, serviceId, petId, slotId: null, customerNote: "", reviewedQuote: null }, submission: { phase: "editing" }, error: null };
}

/** Per mounted Customer workspace. No module singleton, storage or real requests. */
export class BookingMockWorkspace {
  private snapshot: WorkspaceSnapshot;
  private listeners = new Set<() => void>();
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private running = new Set<string>();
  private sequence = 0;
  private disposed = false;

  constructor(catalog: MockCatalog, now = 0) {
    this.snapshot = { catalog, booking: emptyBookingState(), flows: {}, revision: 0, now };
  }
  getSnapshot = (): WorkspaceSnapshot => this.snapshot;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  activate() { this.disposed = false; }
  setNow(now: number) { if (Number.isFinite(now)) this.publish({ now }); }
  dispose() {
    this.disposed = true;
    this.timers.forEach(clearTimeout);
    this.timers.clear();
    this.running.clear();
  }
  private publish(patch: Partial<WorkspaceSnapshot>) {
    if (this.disposed) return;
    this.snapshot = { ...this.snapshot, ...patch, revision: this.snapshot.revision + 1 };
    this.listeners.forEach(listener => listener());
  }
  private flow(providerId: string, next: BookingFlow) {
    this.publish({ flows: { ...this.snapshot.flows, [providerId]: next } });
  }
  private schedule(callback: () => void, delay: number) {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      if (!this.disposed) callback();
    }, Math.max(0, Math.min(delay, 10_000)));
    this.timers.add(timer);
  }
  ensureFlow(providerId: string, serviceId: string | null, petId: string | null) {
    const current = this.snapshot.flows[providerId];
    if (!current) this.flow(providerId, initialFlow(providerId, serviceId, petId));
    else if (current.draft.serviceId !== serviceId && !this.locked(current)) {
      this.flow(providerId, { draft: changeSelection(current.draft, "serviceId", serviceId), submission: { phase: "editing" }, error: null });
    } else if (current.draft.petId !== petId && !this.locked(current)) {
      this.flow(providerId, { draft: changeSelection(current.draft, "petId", petId), submission: { phase: "editing" }, error: null });
    }
  }
  resetFlow(providerId: string) {
    const flow = this.snapshot.flows[providerId];
    if (flow && !this.locked(flow)) this.flow(providerId, initialFlow(providerId, flow.draft.serviceId, flow.draft.petId));
  }
  private locked(flow: BookingFlow): boolean {
    return ["pending", "unknown", "reconciling"].includes(flow.submission.phase);
  }
  select(providerId: string, field: "petId" | "slotId", id: string | null) {
    const flow = this.snapshot.flows[providerId];
    if (!flow || this.locked(flow)) return;
    this.flow(providerId, { draft: changeSelection(flow.draft, field, id), submission: { phase: "editing" }, error: null });
  }
  note(providerId: string, customerNote: string) {
    const flow = this.snapshot.flows[providerId];
    if (!flow || this.locked(flow)) return;
    this.flow(providerId, { ...flow, draft: { ...flow.draft, customerNote }, submission: { phase: "editing" }, error: null });
  }
  review(providerId: string, actor: Actor, pets: PetState, now: number) {
    const flow = this.snapshot.flows[providerId];
    if (!flow || this.locked(flow)) return;
    const result = reviewDraft(actor, flow.draft, bookingFacts(this.snapshot.catalog, pets, flow.draft), now);
    this.flow(providerId, result.ok
      ? { draft: result.value, submission: { phase: "editing" }, error: null }
      : { ...flow, error: result.code });
  }
  private apply(result: Mutation): void {
    if (!result.ok) return;
    // One synchronous publication commits booking, receipt, log AND catalog capacity.
    const catalog = result.capacityChange ? {
      ...this.snapshot.catalog,
      slots: this.snapshot.catalog.slots.map(s => s.id === result.capacityChange?.slotId
        ? { ...s, booked: (s.booked ?? 0) + result.capacityChange.delta } : s),
    } : this.snapshot.catalog;
    this.publish({ catalog, booking: result.state });
  }
  submit(providerId: string, context: SubmitContext) {
    const current = this.snapshot.flows[providerId];
    if (!current || this.disposed) return;
    const begin = beginSubmission(current.submission, context.actor, current.draft, "attempt-" + (++this.sequence));
    if (!begin.ok) return;
    const attempt = begin.attempt;
    const bookingId = "PF-M" + String(this.sequence).padStart(4, "0");
    const runningKey = context.actor.id + ":" + attempt.id;
    this.running.add(runningKey);
    this.flow(providerId, { ...current, submission: begin.state, error: null });
    const complete = () => {
      if (context.fault === "timeout-before") {
        this.running.delete(runningKey);
        const flow = this.snapshot.flows[providerId];
        if (flow) this.flow(providerId, { ...flow, submission: settleSubmission(flow.submission, attempt.id, { kind: "unknown" }) });
        return;
      }
      const latest = this.snapshot.flows[providerId];
      if (!latest) return;
      const result = createBooking(
        this.snapshot.booking, context.actor, current.draft,
        bookingFacts(this.snapshot.catalog, context.pets(), current.draft),
        context.now(), attempt.id, bookingId,
        context.fault === "before-create" ? "before-create" : "none",
      );
      this.apply(result);
      this.running.delete(runningKey);
      const flow = this.snapshot.flows[providerId];
      if (!flow) return;
      // A lost response never claims that no booking was created.
      const lost = context.fault === "timeout-after" || context.fault === "slow-timeout";
      const submission = settleSubmission(flow.submission, attempt.id, lost ? { kind: "unknown" } :
        result.ok ? { kind: "success", bookingId: result.bookingId } : { kind: "known-failure", code: result.code });
      this.flow(providerId, { ...flow, submission, error: !result.ok && !lost ? result.code : null });
    };
    if (context.fault === "slow-timeout") {
      this.schedule(() => {
        const flow = this.snapshot.flows[providerId];
        if (flow) this.flow(providerId, { ...flow, submission: settleSubmission(flow.submission, attempt.id, { kind: "unknown" }) });
      }, context.delayMs);
      this.schedule(complete, Math.max(1500, context.delayMs * 3));
    } else this.schedule(complete, context.delayMs);
  }
  reconcile(providerId: string, actor: Actor, delay: number, fail = false) {
    const flow = this.snapshot.flows[providerId];
    if (!flow || flow.submission.phase !== "unknown") return;
    const attempt = flow.submission.attempt;
    if (attempt.customerId !== actor.id) return;
    this.flow(providerId, { ...flow, submission: beginReconciliation(flow.submission) });
    this.schedule(() => {
      const current = this.snapshot.flows[providerId];
      if (!current) return;
      const lookup = fail ? { kind: "unavailable" as const } :
        this.running.has(actor.id + ":" + attempt.id) ? { kind: "in-flight" as const } :
        lookupAttempt(this.snapshot.booking, actor.id, attempt.id, payloadFingerprint(current.draft));
      this.flow(providerId, { ...current, submission: finishReconciliation(current.submission, attempt.id, lookup) });
    }, delay);
  }
  act(actor: Actor, bookingId: string, now: number, command:
    { type: "cancel"; reason: string } | { type: "review"; rating: number; comment: string } |
    { type: "complaint"; reason: string }, fail = false): Mutation {
    if (fail) return { ok: false, state: this.snapshot.booking, code: "NETWORK_BEFORE_CREATE" };
    const state = this.snapshot.booking;
    const booking = state.bookings.find(b => b.id === bookingId);
    const slot = this.snapshot.catalog.slots.find(s => s.id === booking?.slotId);
    const result = command.type === "cancel"
      ? cancelBooking(state, actor, bookingId, now, slot?.booked ?? null, command.reason)
      : command.type === "review"
        ? addReview(state, actor, bookingId, now, command.rating, command.comment)
        : addComplaint(state, actor, bookingId, now, "complaint-" + (++this.sequence), command.reason);
    this.apply(result);
    return result;
  }
  /** Explicit QA scenarios operate on this same catalog, never a duplicate fixture. */
  simulate(providerId: string, scenario: "full" | "price") {
    const flow = this.snapshot.flows[providerId];
    if (!flow || this.locked(flow)) return;
    const catalog = this.snapshot.catalog;
    this.publish({ catalog: scenario === "full" ? {
      ...catalog, slots: catalog.slots.map(s => s.id === flow.draft.slotId ? { ...s, booked: s.capacity } : s),
    } : {
      ...catalog, services: catalog.services.map(s => s.id === flow.draft.serviceId ? { ...s, price: "260000.00" } : s),
    } });
  }
  seedHistory(actor: Actor, pets: PetState) {
    const pet = pets.pets.find(p => p.ownerId === actor.id && p.status === "ACTIVE");
    const catalog = this.snapshot.catalog;
    const service = catalog.services.find(s => s.active && s.categoryActive && s.price !== null);
    const slot = catalog.slots.find(s => s.serviceId === service?.id);
    if (!pet || !service || !slot || actor.role !== "CUSTOMER") return;
    const statuses = ["COMPLETED", "CANCELLED", "REJECTED", "NO_SHOW"] as const;
    const samples = statuses.map((status, index) => ({
      id: "PF-DEMO-" + (index + 1), customerId: actor.id, petId: pet.id,
      providerId: service.providerId, serviceId: service.id, slotId: slot.id,
      bookedPrice: service.price!, customerNote: null, status,
      appointmentStartAt: this.snapshot.now - (index + 1) * 86_400_000,
      appointmentEndAt: this.snapshot.now - (index + 1) * 86_400_000 + 3_600_000,
      createdAt: this.snapshot.now - (index + 2) * 86_400_000,
      statusLogs: [{
        oldStatus: null, newStatus: status, changedBy: actor.id,
        changedAt: this.snapshot.now - (index + 1) * 86_400_000, reason: null,
      }],
    })).filter(b => !this.snapshot.booking.bookings.some(existing => existing.id === b.id));
    this.publish({ booking: { ...this.snapshot.booking, bookings: [...this.snapshot.booking.bookings, ...samples] } });
  }
}
