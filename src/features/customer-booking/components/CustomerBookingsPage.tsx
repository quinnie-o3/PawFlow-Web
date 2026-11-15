"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { vi, formatMessage } from "@/lib/locale";
import { useCatalogWorkspace } from "../../discovery-shell/CatalogWorkspace";
import { useCustomerWorkspace } from "../../customer-workspace/CustomerWorkspaceProvider";
import { mockDelay } from "../../customer-catalog/mockRepository";
import { useMockResource } from "../../customer-catalog/hooks/useMockResource";
import CatalogImage from "../../customer-catalog/components/CatalogImage";
import { formatDuration, formatPrice, TIME_ZONE } from "../../customer-catalog/catalogLogic";
import CustomerDialog from "../../customer-shell/components/CustomerDialog";
import { actionEligibility, getOwnBooking, listOwnBookings } from "../bookingLogic";
import type { BookingStatus, ErrorCode } from "../model";
import styles from "../booking.module.css";

const statuses: BookingStatus[] = ["PENDING_CONFIRMATION", "CONFIRMED", "COMPLETED", "CANCELLED", "REJECTED", "NO_SHOW"];
function appointment(value: number): string {
  return new Intl.DateTimeFormat("vi-VN", { timeZone: TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(value);
}
export function StatusBadge({ status }: { status: BookingStatus }) {
  return <span className={styles.status} data-status={status}>{vi.booking.statuses[status]}</span>;
}
function useBookingsLoad(id: string) {
  const { delayMs, faults, clearFault } = useCatalogWorkspace();
  const [retry, setRetry] = useState(0);
  const fail = faults.bookings;
  const loader = useCallback(async (signal: AbortSignal) => {
    await mockDelay({ signal, delayMs, fail });
    return true;
  }, [delayMs, fail]);
  const resource = useMockResource(JSON.stringify([id, delayMs, fail, retry]), loader);
  useEffect(() => {
    if (resource.status !== "ready") return;
    // A successful dialog may navigate from far down Provider Detail.
    // Start the new booking page below its sticky Customer header.
    window.scrollTo(0, 0);
  }, [id, resource.status]);
  return { resource, retry: () => { clearFault("bookings"); setRetry(n => n + 1); } };
}
function LoadState({ status, retry }: { status: "loading" | "error"; retry: () => void }) {
  return <div className={styles.feedback} role={status === "error" ? "alert" : "status"}>
    <p>{status === "loading" ? vi.booking.loading : vi.booking.loadError}</p>
    {status === "error" && <button type="button" className={styles.secondary} onClick={retry}>{vi.booking.retry}</button>}
  </div>;
}

export default function CustomerBookingsPage() {
  const { state, actor } = useCatalogWorkspace();
  const { petState } = useCustomerWorkspace();
  const { resource, retry } = useBookingsLoad("list");
  const params = useSearchParams();
  const query = params.get("q") ?? "";
  const status = statuses.find(s => s === params.get("status")) ?? "";
  const all = listOwnBookings(state.booking, actor);
  const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
  const rows = all.filter(b => {
    const service = state.catalog.services.find(s => s.id === b.serviceId);
    const provider = state.catalog.providers.find(p => p.id === b.providerId);
    return (!status || b.status === status) && normalize([b.id, service?.name, provider?.name].join(" ")).includes(normalize(query.trim()));
  });
  const update = (key: string, value: string, method: "pushState" | "replaceState") => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value); else next.delete(key);
    window.history[method](null, "", "/bookings" + (next.size ? "?" + next : ""));
  };
  return <section className={styles.page} aria-labelledby="bookings-title">
    <h1 id="bookings-title">{vi.booking.listTitle}</h1>
    <label className={styles.search}><Search aria-hidden="true" size={20} /><input type="search" value={query} aria-label={vi.booking.searchLabel} placeholder={vi.booking.search} onChange={e => update("q", e.target.value, "replaceState")} /></label>
    <div className={styles.filters} aria-label={vi.booking.columns.status}>
      <button type="button" aria-pressed={!status} onClick={() => update("status", "", "pushState")}>{vi.booking.all}</button>
      {statuses.map(s => <button type="button" key={s} aria-pressed={status === s} onClick={() => update("status", s, "pushState")}>{vi.booking.statuses[s]}</button>)}
    </div>
    {resource.status !== "ready" ? <LoadState status={resource.status} retry={retry} /> : <>
      <p className={styles.count} role="status">{formatMessage(vi.booking.listCount, { count: rows.length })}</p>
      {rows.length === 0 ? <div className={styles.empty}><p>{all.length ? vi.booking.noResults : vi.booking.empty}</p>{all.length > 0 && <Link className={styles.secondary} href="/bookings">{vi.booking.resetFilters}</Link>}<Link className={styles.primary} href="/discover">{vi.booking.discover}</Link></div> :
        <div className={styles.tableWrap}><table className={styles.table}>
          <thead><tr>{Object.entries(vi.booking.columns).map(([key, label]) => <th key={key} scope="col">{label}</th>)}</tr></thead>
          <tbody>{rows.map(b => {
            const service = state.catalog.services.find(s => s.id === b.serviceId);
            const provider = state.catalog.providers.find(p => p.id === b.providerId);
            const pet = petState.pets.find(p => p.id === b.petId);
            return <tr key={b.id}><td>#{b.id}</td><td><div className={styles.serviceCell}><CatalogImage src={service?.image ?? null} alt="" className="" missingClassName={styles.serviceImageMissing} missingLabel={vi.discovery.detail.missingImage} /><div>{service?.name ?? vi.booking.unknownValue}<small>{provider?.name ?? vi.booking.unknownValue}</small></div></div></td><td>{appointment(b.appointmentStartAt)}</td><td>{pet?.name ?? vi.booking.unknownValue}</td><td><StatusBadge status={b.status} /></td><td><Link className={styles.link} href={"/bookings/" + encodeURIComponent(b.id)} aria-label={formatMessage(vi.booking.detail, { bookingId: b.id })}>{vi.booking.view}</Link></td></tr>;
          })}</tbody>
        </table></div>}
    </>}
  </section>;
}

type Action = "cancel" | "review" | "complaint";
function ActionDialog({ bookingId, action, onClose, onSaved }: { bookingId: string; action: Action; onClose: () => void; onSaved: () => void }) {
  const { store, actor, delayMs, faults, clearFault } = useCatalogWorkspace();
  const [text, setText] = useState("");
  const [rating, setRating] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrorCode | null>(null);
  const locked = useRef(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const title = action === "cancel" ? vi.booking.cancelTitle : action === "review" ? vi.booking.reviewDialog : vi.booking.complaintDialog;
  const description = action === "cancel" ? vi.booking.cancelDescription : action === "review" ? vi.booking.reviewHelp : vi.booking.complaintHelp;
  return <CustomerDialog title={formatMessage(title, { bookingId })} description={description} busy={busy} onClose={onClose} returnFocusId="booking-detail-title">
    <form onSubmit={async event => {
      event.preventDefault();
      if (locked.current) return;
      locked.current = true; setBusy(true); setError(null);
      const current = new AbortController(); controller.current = current;
      try {
        await mockDelay({ signal: current.signal, delayMs });
        if (current.signal.aborted) return;
        const command = action === "cancel" ? { type: "cancel" as const, reason: text } : action === "review" ? { type: "review" as const, rating, comment: text } : { type: "complaint" as const, reason: text };
        const result = store.act(actor, bookingId, store.getSnapshot().now, command, faults.action);
        clearFault("action");
        if (result.ok) { onSaved(); onClose(); } else setError(result.code);
      } catch {
        if (!current.signal.aborted) setError("NETWORK_BEFORE_CREATE");
      } finally {
        if (!current.signal.aborted) { locked.current = false; setBusy(false); }
      }
    }}>
      {action === "review" && <label className={styles.field}>{vi.booking.rating}<select value={rating} onChange={e => setRating(Number(e.target.value))} disabled={busy} required><option value={0}>{vi.booking.selectPlaceholder}</option>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} / 5</option>)}</select></label>}
      <label className={styles.field}>{action === "cancel" ? vi.booking.reasonOptional : action === "review" ? vi.booking.comment : vi.booking.reason}<textarea value={text} onChange={e => setText(e.target.value)} disabled={busy} required={action === "complaint"} /></label>
      {error && <p className={styles.error} role="alert">{vi.booking.errors[error]}</p>}
      <div className={styles.dialogActions}><button type="submit" className={styles.primary} disabled={busy}>{busy ? vi.booking.working : action === "cancel" ? vi.booking.confirmCancel : action === "review" ? vi.booking.sendReview : vi.booking.sendComplaint}</button><button type="button" className={styles.secondary} disabled={busy} onClick={onClose}>{action === "cancel" ? vi.booking.keep : vi.booking.close}</button></div>
    </form>
  </CustomerDialog>;
}

export function CustomerBookingDetail({ bookingId }: { bookingId: string }) {
  const { state, actor } = useCatalogWorkspace();
  const { petState } = useCustomerWorkspace();
  const { resource, retry } = useBookingsLoad(bookingId);
  const [action, setAction] = useState<Action | null>(null);
  const [saved, setSaved] = useState(false);
  const booking = getOwnBooking(state.booking, actor, bookingId);
  const service = state.catalog.services.find(s => s.id === booking?.serviceId);
  const provider = state.catalog.providers.find(p => p.id === booking?.providerId);
  const pet = petState.pets.find(p => p.id === booking?.petId);
  const eligibility = actionEligibility(state.booking, actor, bookingId, state.now);
  const review = state.booking.reviews.find(r => r.bookingId === bookingId && r.customerId === actor.id);
  const complaints = state.booking.complaints.filter(c => c.bookingId === bookingId && c.customerId === actor.id);
  return <section className={styles.page}>
    <Link className={styles.link} href="/bookings">{vi.booking.back}</Link>
    {resource.status !== "ready" ? <LoadState status={resource.status} retry={retry} /> : !booking ? <div className={styles.empty}><h1>{vi.booking.notFound}</h1><p>{vi.booking.resetNotice}</p></div> :
      <article className={styles.detailCard}>
        <div className={styles.detailHeading}><h1 id="booking-detail-title" tabIndex={-1}>{formatMessage(vi.booking.detail, { bookingId: booking.id })}</h1><StatusBadge status={booking.status} /></div>
        <dl className={styles.facts}>
          <dt>{vi.booking.providerLabel}</dt><dd>{provider?.name ?? vi.booking.unknownValue}</dd>
          <dt>{vi.booking.serviceLabel}</dt><dd>{service?.name ?? vi.booking.unknownValue}</dd>
          <dt>{vi.booking.petLabel}</dt><dd>{pet?.name ?? vi.booking.unknownValue}</dd>
          <dt>{vi.booking.appointmentLabel}</dt><dd>{appointment(booking.appointmentStartAt)} · {TIME_ZONE}</dd>
          <dt>{vi.booking.priceLabel}</dt><dd>{formatPrice(booking.bookedPrice)}</dd>
          <dt>{vi.booking.durationLabel}</dt><dd>{formatDuration(service?.durationMinutes ?? null)}</dd>
          <dt>{vi.booking.note}</dt><dd>{booking.customerNote ?? "—"}</dd>
        </dl>
        {saved && <p role="status">{vi.booking.saved}</p>}
        <div className={styles.actions}>
          {!eligibility.cancel && <button className={styles.primary} type="button" onClick={() => setAction("cancel")}>{vi.booking.cancel}</button>}
          {!eligibility.review && <button className={styles.secondary} type="button" onClick={() => setAction("review")}>{vi.booking.reviewAction}</button>}
          {!eligibility.complaint && <button className={styles.secondary} type="button" onClick={() => setAction("complaint")}>{vi.booking.complaint}</button>}
        </div>
        {eligibility.cancel === "CANCEL_TIME" && <p>{vi.booking.errors.CANCEL_TIME}</p>}
        {review && <p>{vi.booking.alreadyReviewed} {review.rating} / 5 · {review.comment}</p>}
        {eligibility.complaint === "ACTIVE_COMPLAINT" && <p>{vi.booking.activeComplaint}</p>}
        {complaints.map(c => <p key={c.id}>{formatMessage(vi.booking.complaintStatus, { status: vi.booking.complaintStatuses[c.status] })} · {c.reason}</p>)}
        <h2>{vi.booking.timeline}</h2><ol className={styles.timeline}>{booking.statusLogs.map((log, i) => <li key={i}>{vi.booking.statuses[log.newStatus]}<time dateTime={new Date(log.changedAt).toISOString()}>{appointment(log.changedAt)}</time>{log.reason && <p>{log.reason}</p>}</li>)}</ol>
        <p>{vi.booking.resetNotice}</p>
      </article>}
    {booking && action && <ActionDialog bookingId={bookingId} action={action} onClose={() => setAction(null)} onSaved={() => setSaved(true)} />}
  </section>;
}
