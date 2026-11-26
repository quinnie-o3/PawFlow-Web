"use client";

import { useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { formatMessage, vi } from "@/lib/locale";
import type {
  ProviderApiErrorInfo,
  ProviderBooking,
} from "../../provider-workspace/liveApi";
import { getProviderErrorMessage } from "../../provider-workspace/lifecycle";
import ProviderWorkspaceDialog from "../../provider-workspace/components/ProviderWorkspaceDialog";
import { formatVndAmount } from "../../provider-bookings/bookingLogic";
import { formatBookingPreviewSlot } from "../data/dashboardAnalytics";
import { LinkIcon } from "./icons";
import styles from "../dashboard.module.css";

export default function BookingRequestsPreview({
  status,
  requests,
  totalPending,
  facilityName,
  allowDialog,
  error,
  reloading,
  cooldownSeconds,
  onRetry,
}: {
  status: "idle" | "loading" | "ready" | "error";
  requests: readonly ProviderBooking[];
  totalPending: number;
  facilityName: string | null;
  allowDialog: boolean;
  error: ProviderApiErrorInfo | null;
  reloading: boolean;
  cooldownSeconds: number;
  onRetry: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected =
    allowDialog && selectedId
      ? requests.find((item) => item.id === selectedId) ?? null
      : null;

  return (
    <section
      id="booking-requests"
      className="scroll-mt-6 rounded-[12px] bg-white shadow-[0_2px_8px_rgb(0_0_0_/_0.05)]"
    >
      <div className="flex flex-col gap-3 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2
            id="booking-requests-title"
            tabIndex={-1}
            className="text-[16px] font-bold leading-5 text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--accent-hover)]"
          >
            {vi.provider.dashboard.requests.title}
          </h2>
          {status === "ready" && totalPending > 0 && (
            <p className="mt-1 text-[12px] text-[var(--text-muted)]">
              {formatMessage(vi.provider.dashboard.requests.showingCount, {
                shown: requests.length,
                total: totalPending,
              })}
            </p>
          )}
        </div>
        <div className="text-[12px] leading-4 text-[var(--text-muted)] sm:text-right">
          <Link
            href="/dashboard/bookings?status=PENDING_CONFIRMATION"
            prefetch={false}
            className={`${styles.secondaryAction} inline-flex items-center gap-1`}
          >
            {vi.provider.dashboard.requests.viewAll}{" "}
            <LinkIcon small className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <div className="px-6 pb-6">
        {status === "loading" || status === "idle" ? (
          <p
            role="status"
            aria-busy="true"
            className="py-6 text-[13px] text-[var(--text-secondary)]"
          >
            {vi.provider.dashboard.requests.loading}
          </p>
        ) : status === "error" ? (
          <div className={styles.blockError} role="alert">
            <h3>{vi.provider.dashboard.requests.errorTitle}</h3>
            <p>
              {error
                ? getProviderErrorMessage(error, cooldownSeconds)
                : vi.provider.workspace.errors.UNKNOWN_ERROR}
            </p>
            <button
              type="button"
              className={styles.retryButton}
              disabled={reloading || cooldownSeconds > 0}
              onClick={onRetry}
            >
              <RefreshCw aria-hidden="true" size={14} />
              {vi.provider.dashboard.requests.retry}
            </button>
          </div>
        ) : requests.length > 0 ? (
          <div
            id="booking-requests-table"
            tabIndex={0}
            role="region"
            aria-label={vi.provider.dashboard.requests.pendingRegion}
            className={`${styles.tableFrame} overflow-x-auto rounded-[8px] border`}
          >
            <table className="w-full min-w-[820px] table-fixed border-collapse text-left">
              <colgroup>
                <col style={{ width: 95 }} />
                <col style={{ width: 185 }} />
                <col style={{ width: 175 }} />
                <col style={{ width: 165 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 90 }} />
              </colgroup>
              <thead className="bg-[var(--surface-primary)] text-[13px] font-bold leading-4 text-[var(--text-secondary)]">
                <tr>
                  {[
                    vi.provider.dashboard.labels.bookingId,
                    vi.provider.dashboard.labels.customerAndPet,
                    vi.provider.dashboard.labels.service,
                    vi.provider.dashboard.labels.time,
                    vi.provider.dashboard.labels.status,
                    vi.provider.dashboard.labels.details,
                  ].map((label, index) => (
                    <th
                      key={label}
                      scope="col"
                      className={`border-b py-3 ${index === 0 ? "pl-4" : ""} ${
                        index === 5 ? "text-center" : ""
                      }`}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-[13px] leading-[18px] text-[var(--text-primary)]">
                {requests.map((request) => (
                  <tr key={request.id} className="h-14 border-b last:border-b-0">
                    <td className="py-3 pl-4 font-semibold">#{request.id}</td>
                    <td className="py-3">
                      {request.customer.fullName} · {request.pet.name}
                    </td>
                    <td className="py-3">{request.service.name}</td>
                    <td className="py-3">{formatBookingPreviewSlot(request)}</td>
                    <td className="py-3">
                      <span className="inline-flex min-h-6 items-center whitespace-nowrap rounded-full bg-[#3025a7] px-2.5 text-[12px] font-semibold leading-4 text-white">
                        {vi.provider.dashboard.labels.pendingConfirmation}
                      </span>
                    </td>
                    <td className="py-3 text-center">
                      <button
                        type="button"
                        aria-label={formatMessage(
                          vi.provider.dashboard.requests.detailsLabel,
                          { bookingId: request.id },
                        )}
                        onClick={() => setSelectedId(request.id)}
                        className={`${styles.detailAction} cursor-pointer text-[var(--accent-hover)]`}
                      >
                        {vi.provider.dashboard.labels.details}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-6 text-center">
            <h3 className="text-[15px] font-bold text-[var(--text-primary)]">
              {vi.provider.dashboard.requests.emptyTitle}
            </h3>
            <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
              {vi.provider.dashboard.requests.emptyDescription}
            </p>
          </div>
        )}
      </div>

      {selected && (
        <ProviderWorkspaceDialog
          title={formatMessage(vi.provider.dashboard.requests.detailsLabel, {
            bookingId: selected.id,
          })}
          subtitle={facilityName ?? undefined}
          restoreFocusFallbackId="booking-requests-title"
          onClose={() => setSelectedId(null)}
        >
          <dl className="grid grid-cols-[minmax(0,120px)_minmax(0,1fr)] gap-x-4 gap-y-3 text-[13px]">
            <dt className="text-[var(--text-muted)]">
              {vi.provider.dashboard.labels.bookingCode}
            </dt>
            <dd>#{selected.id}</dd>

            <dt className="text-[var(--text-muted)]">
              {vi.provider.dashboard.labels.customer}
            </dt>
            <dd>
              {selected.customer.fullName} (#{selected.customer.id})
            </dd>

            <dt className="text-[var(--text-muted)]">
              {vi.provider.dashboard.labels.pet}
            </dt>
            <dd>
              {selected.pet.name} ({selected.pet.petType.name})
            </dd>

            <dt className="text-[var(--text-muted)]">
              {vi.provider.dashboard.labels.service}
            </dt>
            <dd>{selected.service.name}</dd>

            <dt className="text-[var(--text-muted)]">
              {vi.provider.dashboard.labels.dateTime}
            </dt>
            <dd>{formatBookingPreviewSlot(selected)}</dd>

            <dt className="text-[var(--text-muted)]">
              {vi.provider.dashboard.labels.duration}
            </dt>
            <dd>
              {formatMessage(vi.provider.dashboard.requests.durationNote, {
                count: selected.service.durationMinutes,
              })}
            </dd>

            <dt className="text-[var(--text-muted)]">
              {vi.provider.dashboard.labels.price}
            </dt>
            <dd>
              <strong>{formatVndAmount(selected.bookedPrice)}</strong>
              <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                {vi.provider.dashboard.requests.bookedPriceNote}
              </p>
            </dd>

            <dt className="text-[var(--text-muted)]">
              {vi.provider.dashboard.labels.notes}
            </dt>
            <dd>
              {selected.customerNote || vi.provider.dashboard.requests.noNotes}
            </dd>

            <dt className="text-[var(--text-muted)]">
              {vi.provider.dashboard.labels.status}
            </dt>
            <dd>{vi.provider.dashboard.labels.pendingConfirmation}</dd>
          </dl>

          <p className="mt-4 text-[12px] text-[var(--text-muted)]">
            {vi.provider.dashboard.requests.piiNote}
          </p>

          <div className="mt-4">
            <Link
              href={`/dashboard/bookings?status=PENDING_CONFIRMATION&q=${encodeURIComponent(selected.id)}`}
              prefetch={false}
              className="inline-flex min-h-10 items-center justify-center rounded-[8px] bg-[var(--accent-hover)] px-4 py-2 text-[13px] font-semibold text-white"
            >
              {vi.provider.dashboard.requests.openInBookings}
            </Link>
          </div>
        </ProviderWorkspaceDialog>
      )}
    </section>
  );
}
