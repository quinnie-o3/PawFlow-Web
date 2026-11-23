"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell, Check, CheckCheck } from "lucide-react";
import { vi, formatMessage } from "@/lib/locale";
import { FormFeedback } from "@/components/ui/Feedback";
import Skeleton from "@/components/ui/Skeleton";
import Toast from "@/components/ui/Toast";
import { formatNotificationDateTime } from "@/features/provider-notifications/notificationLogic";
import { NotificationIcon } from "@/features/provider-notifications/components/NotificationsList";
import { useCatalogWorkspace } from "@/features/discovery-shell/CatalogWorkspace";
import { listOwnBookings } from "@/features/customer-booking/bookingLogic";
import { notificationDestination, selectInbox, unreadCount, type ReadFilter } from "../notifications/model";
import { useCustomerInbox } from "./CustomerInboxProvider";
import styles from "./inbox.module.css";

const text = vi.customerInbox;
export default function CustomerInboxPage({ notificationId }: { notificationId?: string }) {
  const { store, state } = useCustomerInbox();
  const catalog = useCatalogWorkspace();
  const bookings = listOwnBookings(catalog.state.booking, catalog.actor);
  const [filter, setFilter] = useState<ReadFilter>("all");
  const attempted = useRef<string | null>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const count = unreadCount(state.items);
  const item = state.items.find(row => row.id === notificationId);
  const ready = state.status === "ready";
  const busy = !!state.pending;
  useEffect(() => { title.current?.focus({ preventScroll: true }); }, [notificationId]);
  useEffect(() => {
    if (notificationId && item && ready && !busy && attempted.current !== notificationId) {
      attempted.current = notificationId; void store.read(notificationId);
    }
  }, [notificationId, item, ready, busy, store]);
  useEffect(() => {
    if (ready && !busy && document.activeElement === document.body) title.current?.focus({ preventScroll: true });
  }, [ready, busy, filter]);
  const destination = notificationDestination(item?.target ?? null, {
    providerIds: new Set(catalog.state.catalog.providers.filter(provider => provider.approval === "APPROVED").map(provider => provider.id)),
    bookingIds: new Set(bookings.map(booking => booking.id)),
  });
  function load() { void store.load(); }
  function read(id?: string) { void store.read(id); }
  return <section className={styles.page} aria-labelledby="inbox-title">
    {notificationId && <Link className={styles.back} href="/notifications">← {text.back}</Link>}
    <header className={styles.heading}>
      <div><p className={styles.eyebrow}>PawFlow</p><h1 id="inbox-title" ref={title} tabIndex={-1}>{notificationId ? text.detailTitle : text.title}</h1><p>{text.subtitle}</p></div>
      <span className={styles.unread} role="status">{ready ? formatMessage(text.unreadCount, { count }) : text.loading}</span>
    </header>
    <p className={styles.mockNote}>{text.mockNote}</p>
    <div className={styles.card} aria-busy={busy}>
      {!notificationId && <div className={styles.toolbar}>
        <div className={styles.filters} aria-label={text.listLabel}>
          {(["all", "unread", "read"] as const).map(value => <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{text[value]}</button>)}
        </div>
        <button type="button" className={styles.secondary} disabled={!ready || busy || count === 0} onClick={() => read()}><CheckCheck size={18} aria-hidden="true" />{text.readAll}</button>
      </div>}
      <FormFeedback message={state.error?.message ?? null} className={styles.error}>
        <button type="button" className={styles.secondary} disabled={busy} onClick={() => { void store.retry(); }}>{vi.sharedUi.retry}</button>
      </FormFeedback>
      {state.status === "loading" && <Skeleton label={text.loading} />}
      {state.status === "idle" && <div className={styles.empty}><p>{text.cancelled}</p><button type="button" className={styles.primary} onClick={load}>{text.reload}</button></div>}
      {busy && state.pending?.kind !== "load" && <p role="status" className={styles.pending}>{text.pending}</p>}
      {ready && (notificationId ? !item ? <div className={styles.empty}><Bell aria-hidden="true" /><h2>{text.missing}</h2><p>{text.missingHelp}</p><Link href="/notifications" className={styles.primary}>{text.back}</Link></div> :
        <article className={styles.detail}>
          <div className={styles.detailHeading}><NotificationIcon kind={item.type === "BOOKING_COMPLETED" ? "bookingCompleted" : "newBooking"} /><h2>{item.title}</h2></div>
          <span className={styles.readState}>{item.readAt ? <><Check size={16} aria-hidden="true" />{text.read}</> : text.unread}</span>
          <time dateTime={item.createdAt}>{formatNotificationDateTime(item.createdAt)} · {text.timeZone}</time><p>{item.body}</p>
          {destination.kind === "available" ? <Link className={styles.primary} href={destination.href + "?fromInbox=" + encodeURIComponent(item.id)}>{text.visit} →</Link> :
            <FormFeedback tone="status" className={styles.notice} message={destination.kind === "none" ? text.noTarget : destination.kind === "missing" ? text.unavailableTarget : text.unsupportedTarget} />}
          {destination.kind === "available" && <Link className={styles.back} href="/notifications">{text.back}</Link>}
        </article> : selectInbox(state.items, filter).length === 0 ? <div className={styles.empty}><Bell size={36} aria-hidden="true" /><h2>{state.items.length ? text.noResults : text.empty}</h2>{state.items.length > 0 && <button type="button" className={styles.secondary} onClick={() => setFilter("all")}>{text.clearFilter}</button>}</div> :
        <ul className={styles.list} aria-label={text.listLabel}>{selectInbox(state.items, filter).map(row => <li key={row.id} className={row.readAt ? styles.read : styles.unreadRow}>
          <NotificationIcon kind={row.type === "BOOKING_CONFIRMED" ? "newBooking" : "bookingCompleted"} />
          <div className={styles.message}><Link className={styles.titleLink} href={"/notifications/" + encodeURIComponent(row.id)}>{row.title}</Link><p>{row.body}</p><time dateTime={row.createdAt}>{formatNotificationDateTime(row.createdAt)}</time><span className={styles.readState}>{row.readAt ? text.read : text.unread}</span></div>
          {!row.readAt && <button type="button" className={styles.readButton} disabled={busy} onClick={() => read(row.id)} aria-label={text.markRead + ": " + row.title}><Check size={18} aria-hidden="true" /><span>{text.markRead}</span></button>}
        </li>)}</ul>)}
    </div>
    <details className={styles.tools}><summary>{text.tools}</summary><p>{text.toolsHelp}</p>
      <div className={styles.toolRow}>
        <label><input type="checkbox" checked={state.failLoad} disabled={busy} onChange={event => store.setFailure("load", event.target.checked)} />{text.failLoad}</label>
        <label><input type="checkbox" checked={state.failUpdate} disabled={busy} onChange={event => store.setFailure("update", event.target.checked)} />{text.failUpdate}</label>
      </div><div className={styles.toolRow}>
        <button type="button" className={styles.secondary} disabled={busy} onClick={load}>{text.reload}</button>
        <button type="button" className={styles.secondary} onClick={() => store.arrive()}>{text.add}</button>
        <button type="button" className={styles.secondary} disabled={!bookings.length} onClick={() => store.arrive(bookings[0]?.id)}>{text.addBooking}</button>
        <button type="button" className={styles.secondary} disabled={!busy} onClick={() => store.cancel()}>{text.cancel}</button>
        <button type="button" className={styles.secondary} disabled={busy} onClick={() => { store.reset(true); }}>{text.emptyAction}</button>
        <button type="button" className={styles.secondary} disabled={busy} onClick={() => { store.reset(); setFilter("all"); attempted.current = null; }}>{text.reset}</button>
      </div>{!bookings.length && <p>{text.noBooking}</p>}
    </details>
    <Toast message={state.notice} onDismiss={() => { store.dismiss(); title.current?.focus({ preventScroll: true }); }} />
  </section>;
}
