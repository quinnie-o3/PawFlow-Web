"use client";

import { vi, formatMessage } from "@/lib/locale";

import { useState } from "react";
import Link from "next/link";
import type { BookingRequest } from "../types";
import { formatBookingDate, formatDate } from "../data/dashboardAnalytics";
import { LinkIcon } from "./icons";
import DashboardDialog from "./DashboardDialog";
import styles from "../dashboard.module.css";

export default function BookingRequestsPreview({ requests }: { requests: BookingRequest[] }) {
  const [selected, setSelected] = useState<BookingRequest | null>(null);
  return (
    <section id="booking-requests" className="scroll-mt-6 rounded-[12px] bg-white shadow-[0_2px_8px_rgb(0_0_0_/_0.05)]">
      <div className="flex flex-col gap-3 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="booking-requests-title" tabIndex={-1} className="text-[16px] font-bold leading-5 text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--accent-hover)]">{vi.provider.dashboard.requests.title}</h2>
        <div className="text-[12px] leading-4 text-[var(--text-muted)] sm:text-right">
          <Link href="/dashboard/bookings?status=pendingConfirmation" prefetch={false} className={`${styles.secondaryAction} inline-flex items-center gap-1`}>
            {vi.provider.dashboard.requests.viewAll}{" "}<LinkIcon small className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
      <div className="px-6 pb-6">
        <div id="booking-requests-table" tabIndex={0} role="region" aria-label={vi.provider.dashboard.requests.pendingRegion} className={`${styles.tableFrame} overflow-x-auto rounded-[8px] border`}>
          <table className="w-full min-w-[847px] table-fixed border-collapse text-left">
            <colgroup><col style={{ width: 90 }} /><col style={{ width: 190 }} /><col style={{ width: 165 }} /><col style={{ width: 135 }} /><col style={{ width: 140 }} /><col style={{ width: 95 }} /></colgroup>
            <thead className="bg-[var(--surface-primary)] text-[13px] font-bold leading-4 text-[var(--text-secondary)]">
              <tr>{[vi.provider.dashboard.labels.bookingId, vi.provider.dashboard.labels.customerAndPet, vi.provider.dashboard.labels.service, vi.provider.dashboard.labels.time, vi.provider.dashboard.labels.status, vi.provider.dashboard.labels.details].map((label, index) => (
                <th key={label} scope="col" className={`border-b py-3 ${index === 0 ? "pl-4" : ""} ${index === 5 ? "text-center" : ""}`}>{label}</th>
              ))}</tr>
            </thead>
            <tbody className="text-[14px] leading-[18px] text-[var(--text-primary)]">
              {requests.map((request) => (
                <tr key={request.id} className="h-14 border-b last:border-b-0">
                  <td className="py-4 pl-4 font-semibold">{request.id}</td>
                  <td className="py-4">{request.customerName} · {request.petName}</td>
                  <td className="py-4">{request.serviceName}</td>
                  <td className="py-4">{formatBookingDate(request.scheduledAt)}</td>
                  <td className="py-4"><span className="inline-flex min-h-6 items-center whitespace-nowrap rounded-full bg-[#001aff] px-2.5 text-[12px] font-semibold leading-4 text-white">{vi.provider.dashboard.labels.pendingConfirmation}</span></td>
                  <td className="py-4 text-center"><button type="button" aria-label={formatMessage(vi.provider.dashboard.requests.detailsLabel, { bookingId: request.id })} onClick={() => setSelected(request)} className={`${styles.detailAction} cursor-pointer text-[var(--accent-hover)]`}>{vi.provider.dashboard.labels.details}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {selected && <DashboardDialog title={formatMessage(vi.provider.dashboard.requests.detailsLabel, { bookingId: selected.id })} onClose={() => setSelected(null)}>
        <dl className="grid grid-cols-[minmax(0,100px)_minmax(0,1fr)] gap-x-4 gap-y-3">
          <dt className="text-[var(--text-muted)]">{vi.provider.dashboard.labels.bookingCode}</dt><dd>{selected.id}</dd>
          <dt className="text-[var(--text-muted)]">{vi.provider.dashboard.labels.customer}</dt><dd>{selected.customerName}</dd>
          <dt className="text-[var(--text-muted)]">{vi.provider.dashboard.labels.pet}</dt><dd>{selected.petName}</dd>
          <dt className="text-[var(--text-muted)]">{vi.provider.dashboard.labels.service}</dt><dd>{selected.serviceName}</dd>
          <dt className="text-[var(--text-muted)]">{vi.provider.dashboard.labels.dateTime}</dt><dd>{formatDate(selected.scheduledAt.slice(0, 10))} · {selected.scheduledAt.slice(11, 16)}</dd>
          <dt className="text-[var(--text-muted)]">{vi.provider.dashboard.labels.duration}</dt><dd>{formatMessage(vi.provider.dashboard.requests.duration, { count: selected.durationMinutes })}</dd>
          <dt className="text-[var(--text-muted)]">{vi.provider.dashboard.labels.price}</dt><dd>{selected.price.toLocaleString("vi-VN")} ₫</dd>
          <dt className="text-[var(--text-muted)]">{vi.provider.dashboard.labels.notes}</dt><dd>{selected.notes}</dd>
          <dt className="text-[var(--text-muted)]">{vi.provider.dashboard.labels.status}</dt><dd>{vi.provider.dashboard.labels.pendingConfirmation}</dd>
        </dl>
      </DashboardDialog>}
    </section>
  );
}
