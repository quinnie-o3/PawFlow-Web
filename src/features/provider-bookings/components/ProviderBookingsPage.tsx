"use client";

import { vi, formatMessage } from "@/lib/locale";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";
import { filterBookings, formatBookingDate, statusLabels, statusOrder, summarizeBookings } from "../bookingLogic";
import { mockBookings, mockNow } from "../data/providerBookingsMock";
import { useBookingsMock } from "../useBookingsMock";
import type { BookingFilters } from "../types";
import BookingDetailsDialog from "./BookingDetailsDialog";
import BookingStatusBadge from "./BookingStatusBadge";
import styles from "../bookings.module.css";

export default function ProviderBookingsPage() {
  const { state, dispatch } = useBookingsMock();
  const searchParams = useSearchParams();
  const filters: BookingFilters = {
    query: searchParams.get("q") ?? "",
    status: statusOrder.find((status) => status === searchParams.get("status")) ?? "all",
  };
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [feedbackOffset, setFeedbackOffset] = useState(0);
  const visible = filterBookings(state.bookings, filters);
  const selected = state.bookings.find((booking) => booking.id === selectedId);
  const summary = summarizeBookings(state.bookings);
  const feedback = state.logs.length > feedbackOffset ? state.feedback : null;

  function setFilters(next: BookingFilters, replace = false) {
    const url = new URL(window.location.href);
    if (next.status === "all") url.searchParams.delete("status");
    else url.searchParams.set("status", next.status);
    if (next.query) url.searchParams.set("q", next.query);
    else url.searchParams.delete("q");
    // Keep mock edits and scroll intact; Next.js syncs native history with useSearchParams.
    window.history[replace ? "replaceState" : "pushState"](null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function openBooking(id: string) {
    setFeedbackOffset(state.logs.length);
    setSelectedId(id);
  }

  return <div className={styles.page} lang="vi">
    <div className={styles.providerTab}>{vi.provider.bookings.page.providerTab}</div>
    <header className={styles.intro}>
      <div><h1>{vi.provider.bookings.page.title}</h1><p>{vi.provider.bookings.page.description}</p></div>
      <Link href="/dashboard/availability" prefetch={false} className={styles.availabilityLink}>{vi.provider.bookings.page.availability}</Link>
    </header>
    <div className={styles.summaries} aria-label={vi.provider.bookings.summary.region}>
      {summary.map((item) => <article key={item.status}>
        <h2>{item.title}</h2><p className={styles.summaryCount}>{String(item.count).padStart(2, "0")}</p>
        <p>{item.status === "pendingConfirmation" ? vi.provider.bookings.summary.priority : item.status === "confirmed" ? vi.provider.bookings.summary.confirmed : vi.provider.bookings.summary.excludesCancelled}</p>
      </article>)}
    </div>
    <div className={styles.filters} role="group" aria-label={vi.provider.bookings.filters.status}>
      <button type="button" aria-pressed={filters.status === "all"} onClick={() => setFilters({ ...filters, status: "all" })}>{vi.common.actions.all}</button>
      {statusOrder.map((status) => <button type="button" key={status} aria-pressed={filters.status === status} onClick={() => setFilters({ ...filters, status })}>{statusLabels[status]}</button>)}
    </div>
    <label className={styles.search}>
      <span className={styles.srOnly}>{vi.provider.bookings.filters.searchLabel}</span>
      <Search aria-hidden="true" focusable="false" size={14} strokeWidth={2} className={styles.searchIcon} />
      <input type="search" placeholder={vi.provider.bookings.filters.searchPlaceholder} value={filters.query} onChange={(event) => setFilters({ ...filters, query: event.target.value }, true)} />
    </label>
    <section className={styles.listCard} aria-labelledby="bookings-title">
      <div className={styles.listHeading}><h2 id="bookings-title" tabIndex={-1}>{vi.provider.bookings.list.title}</h2><p>{vi.provider.bookings.list.description}</p></div>
      {feedback && !selected && <p role={feedback.outcome === "error" ? "alert" : "status"} className={feedback.outcome === "error" ? styles.error : styles.success}>{feedback.message}</p>}
      <p className={styles.resultCount} role="status">{formatMessage(vi.provider.bookings.list.resultCount, { visible: visible.length, total: state.bookings.length })}</p>
      {visible.length > 0 ? <div className={styles.tableFrame} tabIndex={0} role="region" aria-label={vi.provider.bookings.list.region}>
        <table>
          <colgroup><col style={{ width: 85 }} /><col style={{ width: 170 }} /><col style={{ width: 190 }} /><col style={{ width: 140 }} /><col style={{ width: 130 }} /><col style={{ width: 140 }} /></colgroup>
          <thead><tr>{[vi.provider.bookings.list.bookingId, vi.provider.bookings.list.customerAndPet, vi.provider.bookings.labels.service, vi.provider.bookings.list.time, vi.provider.bookings.labels.status, vi.provider.bookings.list.actions].map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead>
          <tbody>{visible.map((booking) => <tr key={booking.id}>
            <th scope="row">{booking.id}</th><td>{booking.customerName} · {booking.petName}</td>
            <td>{booking.serviceName}</td><td>{formatBookingDate(booking.scheduledAt)}</td>
            <td><BookingStatusBadge status={booking.status} /></td>
            <td><button type="button" className={styles.detailButton} aria-label={formatMessage(vi.provider.bookings.list.detailsLabel, { bookingId: booking.id })} onClick={() => openBooking(booking.id)}>{vi.provider.bookings.list.viewDetails}</button></td>
          </tr>)}</tbody>
        </table>
      </div> : <div className={styles.empty}>
        <h3>{state.bookings.length === 0 ? vi.provider.bookings.empty.noBookings : filters.query.trim() ? vi.provider.bookings.empty.noResults : vi.provider.bookings.empty.noStatusResults}</h3>
        <p>{state.bookings.length === 0 ? vi.provider.bookings.empty.noBookingsDescription : vi.provider.bookings.empty.noResultsDescription}</p>
        {state.bookings.length > 0 && <button className={styles.softButton} type="button" onClick={() => setFilters({ query: "", status: "all" })}>{vi.provider.bookings.empty.clearFilters}</button>}
      </div>}
      <p className={styles.listNote}>{vi.provider.bookings.list.statusNote}</p>
    </section>
    <details className={styles.mockTools}>
      <summary>{formatMessage(vi.provider.bookings.mock.clock, { time: formatBookingDate(mockNow, true) })}</summary>
      <p>{vi.provider.bookings.mock.note}</p>
      <label className={styles.checkboxLabel}><input type="checkbox" checked={simulateFailure} onChange={(event) => setSimulateFailure(event.target.checked)} disabled={!!state.pending} />{vi.provider.bookings.mock.failOperation}</label>
      <div className={styles.scenarios}>
        <button type="button" className={styles.softButton} disabled={!!state.pending} onClick={() => { dispatch({ type: "scenario", bookings: [] }); setFeedbackOffset(0); }}>{vi.provider.bookings.mock.empty}</button>
        <button type="button" className={styles.softButton} disabled={!!state.pending} onClick={() => { dispatch({ type: "scenario", bookings: mockBookings }); setFilters({ query: "", status: "all" }); setFeedbackOffset(0); }}>{vi.provider.bookings.mock.restore}</button>
      </div>
    </details>
    {selected && <BookingDetailsDialog key={selected.id} booking={selected}
      logs={state.logs.filter((entry) => entry.bookingId === selected.id)} pending={!!state.pending}
      feedback={feedback?.bookingId === selected.id ? feedback : null} simulateFailure={simulateFailure}
      onSubmit={(command) => dispatch({ type: "submit", command })} onClose={() => setSelectedId(null)} />}
  </div>;
}
