"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { formatMessage, vi } from "@/lib/locale";
import { getProviderErrorMessage } from "@/features/provider-workspace/lifecycle";
import {
  formatAvailabilityDate,
  formatTimeHhMm,
  formatTimeInterval,
  resolveSlotService,
  slotFitsWorkingHours,
  upcomingSlots,
} from "../availabilityLogic";
import type {
  AvailabilityLoadStatus,
  ProviderApiErrorInfo,
  ProviderAvailabilitySlot,
  ProviderService,
  ProviderWorkingHour,
} from "../types";
import styles from "../availability.module.css";

export default function UpcomingSlots({
  status,
  slots,
  workingHours,
  services,
  error,
  reloading,
  cooldownSeconds,
  now,
  onSelect,
  onShowAll,
  onRetry,
}: {
  status: AvailabilityLoadStatus;
  slots: readonly ProviderAvailabilitySlot[];
  workingHours: readonly ProviderWorkingHour[];
  services: readonly ProviderService[];
  error: ProviderApiErrorInfo | null;
  reloading: boolean;
  cooldownSeconds: number;
  now: string;
  onSelect: (id: string) => void;
  onShowAll: () => void;
  onRetry: () => void;
}) {
  const locale = vi.provider.availability.upcoming;
  const slotsLocale = vi.provider.availability.slots;
  const openUpcoming = upcomingSlots(slots, now).filter(
    (slot) => slot.status === "OPEN",
  );

  return (
    <section className={styles.card} aria-labelledby="upcoming-slots-title">
      <h2>
        <button
          type="button"
          id="upcoming-slots-title"
          className={styles.headingButton}
          onClick={onShowAll}
        >
          {locale.title}
        </button>
      </h2>

      {status === "idle" || status === "loading" ? (
        <div
          className={styles.skeletonList}
          role="status"
          aria-busy="true"
          aria-label={locale.loading}
        >
          <div className={styles.skeletonRow} />
          <div className={styles.skeletonRow} />
          <p className={styles.srOnly}>{locale.loading}</p>
        </div>
      ) : status === "error" ? (
        <div className={styles.stateBox}>
          <p role="alert">
            {error
              ? getProviderErrorMessage(error, cooldownSeconds)
              : locale.loadError}
          </p>
          <button
            type="button"
            className={styles.outlineButton}
            disabled={reloading || cooldownSeconds > 0}
            onClick={onRetry}
          >
            <RefreshCw aria-hidden="true" focusable="false" size={14} />
            {reloading ? vi.provider.availability.page.reloading : locale.retry}
          </button>
        </div>
      ) : openUpcoming.length === 0 ? (
        <p className={styles.empty}>{locale.empty}</p>
      ) : (
        <ul className={styles.upcomingList}>
          {openUpcoming.slice(0, 4).map((slot) => {
            const service = resolveSlotService(slot, services);
            const serviceName =
              service?.name ??
              formatMessage(slotsLocale.unknownService, {
                serviceId: slot.serviceId,
              });
            const remaining = Math.max(0, slot.capacity - slot.bookedCount);
            const fitsHours =
              workingHours.length === 0
                ? true
                : slotFitsWorkingHours(slot, workingHours);
            const serviceInactive = service?.status === "INACTIVE";

            return (
              <li key={slot.id}>
                <button
                  type="button"
                  className={styles.slotPreview}
                  onClick={() => onSelect(slot.id)}
                  aria-label={formatMessage(locale.manageLabel, {
                    date: formatAvailabilityDate(slot.slotDate),
                    start: formatTimeHhMm(slot.startTime),
                    end: formatTimeHhMm(slot.endTime),
                  })}
                >
                  <strong>
                    {formatAvailabilityDate(slot.slotDate, false)} ·{" "}
                    {formatTimeInterval(slot.startTime, slot.endTime)}
                  </strong>
                  <span>{serviceName}</span>
                  <span>
                    {formatMessage(locale.heldCapacity, {
                      booked: slot.bookedCount,
                      capacity: slot.capacity,
                    })}
                    {remaining > 0
                      ? ` · ${formatMessage(locale.remainingSeats, { remaining })}`
                      : ` · ${locale.fullBadge}`}
                  </span>
                  {(!fitsHours || serviceInactive) && (
                    <span className={styles.inlineWarningTag}>
                      {serviceInactive
                        ? locale.inactiveServiceBadge
                        : locale.outsideHoursBadge}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Link
        href="/dashboard/bookings"
        prefetch={false}
        className={styles.textButton}
      >
        {locale.viewBookings}
      </Link>
    </section>
  );
}
