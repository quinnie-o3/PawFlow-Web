"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { vi, formatMessage } from "@/lib/locale";
import { useCatalogWorkspace } from "../../discovery-shell/CatalogWorkspace";
import { useCustomerWorkspace } from "../../customer-workspace/CustomerWorkspaceProvider";
import { formatDateOnly, formatDuration, formatPrice, remaining, serviceSlots, slotState } from "../../customer-catalog/catalogLogic";
import CustomerDialog from "../../customer-shell/components/CustomerDialog";
import { getOwnBooking } from "../bookingLogic";
import { initialFlow } from "../mockWorkspace";
import styles from "../booking.module.css";

export default function BookingPanel({ providerId, serviceId, availabilityStatus }: {
  providerId: string; serviceId: string; availabilityStatus: "loading" | "ready" | "error";
}) {
  const { store, state, actor, selectedPetId, selectPet, now, delayMs, submitFault, faults, clearFault } = useCatalogWorkspace();
  const { petState, getPetState } = useCustomerWorkspace();
  const [dateInput, setDateInput] = useState<string | null>(null);
  const [dismissedSuccess, setDismissedSuccess] = useState<string | null>(null);
  useEffect(() => { store.ensureFlow(providerId, serviceId, selectedPetId); }, [store, providerId, serviceId, selectedPetId]);
  const flow = state.flows[providerId] ?? initialFlow(providerId, serviceId, selectedPetId);
  const { draft, submission } = flow;
  const locked = ["pending", "unknown", "reconciling"].includes(submission.phase);
  const completed = submission.phase === "succeeded";
  // Query navigation must not change the context of an unresolved attempt/receipt.
  const displayedServiceId = locked || completed ? draft.serviceId : serviceId;
  const service = state.catalog.services.find(s => s.id === displayedServiceId && s.providerId === providerId);
  const provider = state.catalog.providers.find(p => p.id === providerId);
  const pets = petState.pets.filter(p => p.ownerId === actor.id && p.status === "ACTIVE");
  const pet = pets.find(p => p.id === draft.petId);
  const slots = service ? serviceSlots(state.catalog, service) : [];
  const selectedSlot = slots.find(s => s.id === draft.slotId);
  // Keep the selected date visible if capacity/time changed since selection.
  // Otherwise the native select silently displays another date than the draft.
  const dates = [...new Set([
    ...slots.filter(s => slotState(s, now) === "available").map(s => s.date),
    ...(selectedSlot ? [selectedSlot.date] : []),
  ])].sort();
  const date = selectedSlot?.date ?? (dateInput && dates.includes(dateInput) ? dateInput : dates[0] ?? "");
  const receipt = completed ? getOwnBooking(state.booking, actor, submission.bookingId) : null;
  const error = flow.error ?? (submission.phase === "failed" && submission.code !== "NOT_CREATED" ? submission.code : null);
  return <section id="booking" className={styles.booking} aria-labelledby="booking-title">
    <h2 id="booking-title">{vi.booking.title}</h2><p>{vi.booking.subtitle}</p>
    <form className={styles.bookingGrid} onSubmit={event => {
      event.preventDefault();
      store.submit(providerId, { actor, pets: getPetState, now: () => store.getSnapshot().now, delayMs, fault: submitFault });
    }} aria-busy={submission.phase === "pending"}>
      <div className={styles.steps}>
        <section className={styles.card}><h3>{vi.booking.pet}</h3>
          {pets.length ? <label className={styles.field}>{vi.booking.choosePet}<select value={pet?.id ?? ""} disabled={locked || completed} onChange={e => { store.select(providerId, "petId", e.target.value || null); selectPet(e.target.value || null); }}>
            <option value="">{vi.booking.selectPlaceholder}</option>{pets.map(p => <option key={p.id} value={p.id}>{p.name}{p.breed ? " · " + p.breed : ""}</option>)}
          </select></label> : <p role="status">{vi.booking.noPet}</p>}
          <p>{vi.booking.petSharing}</p><Link href="/account/pets" prefetch={false} className={styles.secondary}>{vi.booking.managePets}</Link>
        </section>
        <section className={styles.card}><h3>{vi.booking.service}</h3><p>{vi.booking.selectedService}</p>
          <div className={styles.selectedService}>{service?.name} · {formatDuration(service?.durationMinutes ?? null)} · {formatPrice(service?.price ?? null)}</div>
          <a href="#services" className={styles.secondary}>{vi.booking.otherServices}</a>
        </section>
        <section className={styles.card}><h3>{vi.booking.time}</h3><p>{vi.booking.slotNotice}</p>
          {availabilityStatus === "loading" ? <p role="status">{vi.discovery.availability.loading}</p> :
            availabilityStatus === "error" ? <p role="alert">{vi.discovery.catalog.errors.retry}</p> :
              dates.length === 0 ? <p role="status">{vi.booking.noSlots}</p> : <>
                <label className={styles.field}>{vi.booking.chooseDate}<select value={date} disabled={locked || completed} onChange={e => { setDateInput(e.target.value); store.select(providerId, "slotId", null); }}>
                  {dates.map(d => <option key={d} value={d}>{formatDateOnly(d)}</option>)}
                </select></label>
                <label className={styles.field}>{vi.booking.chooseSlot}<select value={selectedSlot?.date === date ? selectedSlot.id : ""} disabled={locked || completed} onChange={e => store.select(providerId, "slotId", e.target.value || null)}>
                  <option value="">{vi.booking.selectPlaceholder}</option>
                  {slots.filter(s => s.date === date).map(s => <option key={s.id} value={s.id} disabled={slotState(s, now) !== "available"}>{s.start}–{s.end} · {slotState(s, now) === "available" ? vi.discovery.availability.available + " · " + remaining(s) : vi.discovery.availability[slotState(s, now)]}</option>)}
                </select></label>
              </>}
        </section>
      </div>
      <aside className={styles.card + " " + styles.review}><h3>{vi.booking.reviewTitle}</h3><p>{vi.booking.reviewDescription}</p>
        <dl className={styles.facts}>
          <dt>{vi.booking.providerLabel}</dt><dd>{provider?.name}</dd>
          <dt>{vi.booking.petLabel}</dt><dd>{pet?.name ?? vi.booking.selectPlaceholder}</dd>
          <dt>{vi.booking.serviceLabel}</dt><dd>{service?.name}</dd>
          <dt>{vi.booking.appointmentLabel}</dt><dd>{selectedSlot ? formatDateOnly(selectedSlot.date) + " · " + selectedSlot.start : vi.booking.selectPlaceholder}</dd>
          <dt>{vi.booking.priceLabel}</dt><dd>{formatPrice(draft.reviewedQuote?.price ?? service?.price ?? null)}</dd>
        </dl>
        <label className={styles.field}>{vi.booking.note}<textarea value={draft.customerNote} disabled={locked || completed} placeholder={vi.booking.notePlaceholder} onChange={e => store.note(providerId, e.target.value)} /></label>
        <p>{vi.booking.pendingNotice}</p>
        {error && <p role="alert" className={styles.error}>{vi.booking.errors[error]}</p>}
        {submission.phase === "failed" && submission.code === "NOT_CREATED" && <p role="status">{vi.booking.notCreated}</p>}
        {(submission.phase === "unknown" || submission.phase === "reconciling") && <div role="status" className={styles.notice}><p>{vi.booking.unknown}</p><button className={styles.primary} type="button" disabled={submission.phase === "reconciling"} onClick={() => { store.reconcile(providerId, actor, delayMs, faults.lookup); clearFault("lookup"); }}>{submission.phase === "reconciling" ? vi.booking.reconciling : vi.booking.reconcile}</button></div>}
        {receipt ? <div role="status"><p>{formatMessage(vi.booking.success, { bookingId: receipt.id })}</p><Link id={"booking-receipt-" + providerId} className={styles.primary} href={"/bookings/" + encodeURIComponent(receipt.id)}>{vi.booking.viewBooking}</Link><button type="button" className={styles.secondary} onClick={() => { store.resetFlow(providerId); store.ensureFlow(providerId, serviceId, selectedPetId); }}>{vi.booking.newBooking}</button></div> :
          <><button type="button" className={styles.secondary} disabled={locked || availabilityStatus !== "ready"} onClick={() => store.review(providerId, actor, getPetState(), store.getSnapshot().now)}>{vi.booking.review}</button>
            <button type="submit" className={styles.primary} disabled={locked || !draft.reviewedQuote || availabilityStatus !== "ready"}>{submission.phase === "pending" ? vi.booking.submitting : vi.booking.submit}</button></>}
        <Link href="/discover" className={styles.secondary}>{vi.booking.changeProvider}</Link>
      </aside>
    </form>
    {receipt && dismissedSuccess !== receipt.id && <CustomerDialog title={formatMessage(vi.booking.success, { bookingId: receipt.id })} description={vi.booking.successDescription} busy={false} onClose={() => setDismissedSuccess(receipt.id)} returnFocusId={"booking-receipt-" + providerId}>
      <div className={styles.dialogActions}><Link className={styles.primary} href={"/bookings/" + encodeURIComponent(receipt.id)}>{vi.booking.viewBooking}</Link><Link className={styles.secondary} href="/bookings">{vi.booking.viewList}</Link><button className={styles.secondary} type="button" onClick={() => setDismissedSuccess(receipt.id)}>{vi.booking.close}</button></div>
    </CustomerDialog>}
  </section>;
}
