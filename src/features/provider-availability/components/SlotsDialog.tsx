"use client";

import { useState } from "react";
import { formatMessage, vi } from "@/lib/locale";
import ProviderWorkspaceDialog from "@/features/provider-workspace/components/ProviderWorkspaceDialog";
import {
  formatAvailabilityDate,
  formatTimeHhMm,
  formatTimeInterval,
  hasSlotStarted,
  resolveSlotService,
  slotFitsWorkingHours,
  sortSlotsForDisplay,
} from "../availabilityLogic";
import type {
  ProviderAvailabilitySlot,
  ProviderService,
  ProviderWorkingHour,
  SlotStatusFilter,
} from "../types";
import styles from "../availability.module.css";

export default function SlotsDialog({
  slots,
  services,
  workingHours,
  canManageResources,
  busy,
  locked,
  now,
  onSelect,
  onCreate,
  onClose,
}: {
  slots: readonly ProviderAvailabilitySlot[];
  services: readonly ProviderService[];
  workingHours: readonly ProviderWorkingHour[];
  canManageResources: boolean;
  busy: boolean;
  locked: boolean;
  now: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onClose: () => void;
}) {
  const [filter, setFilter] = useState<SlotStatusFilter>("ALL");
  const locale = vi.provider.availability.slots;

  const counts = {
    ALL: slots.length,
    OPEN: slots.filter((item) => item.status === "OPEN").length,
    CLOSED: slots.filter((item) => item.status === "CLOSED").length,
    CANCELLED: slots.filter((item) => item.status === "CANCELLED").length,
  };

  const visibleSlots = sortSlotsForDisplay(
    filter === "ALL"
      ? slots
      : slots.filter((item) => item.status === filter),
    now,
  );

  const filterButtons: readonly Readonly<{
    key: SlotStatusFilter;
    label: string;
  }>[] = [
    { key: "ALL", label: formatMessage(locale.filterAll, { count: counts.ALL }) },
    {
      key: "OPEN",
      label: formatMessage(locale.filterOpen, { count: counts.OPEN }),
    },
    {
      key: "CLOSED",
      label: formatMessage(locale.filterClosed, { count: counts.CLOSED }),
    },
    {
      key: "CANCELLED",
      label: formatMessage(locale.filterCancelled, { count: counts.CANCELLED }),
    },
  ];

  return (
    <ProviderWorkspaceDialog
      title={locale.title}
      subtitle={locale.subtitle}
      disableClose={busy}
      restoreFocusFallbackId="availability-title"
      onClose={onClose}
    >
      <div className={styles.editorForm}>
        {canManageResources && (
          <div className={styles.formActions}>
            <button
              type="button"
              className={styles.primaryButton}
              disabled={busy || locked}
              onClick={onCreate}
            >
              {vi.provider.availability.slot.create}
            </button>
          </div>
        )}

        <div
          className={styles.filterRow}
          role="group"
          aria-label={locale.filterLabel}
        >
          {filterButtons.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={filter === item.key}
              className={`${styles.filterChip} ${
                filter === item.key ? styles.filterChipActive : ""
              }`}
              onClick={() => setFilter(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {slots.length === 0 ? (
          <p className={styles.empty}>{locale.empty}</p>
        ) : visibleSlots.length === 0 ? (
          <p className={styles.empty}>{locale.emptyFiltered}</p>
        ) : (
          <ul className={styles.slotList}>
            {visibleSlots.map((slot) => {
              const service = resolveSlotService(slot, services);
              const serviceName =
                service?.name ??
                formatMessage(locale.unknownService, {
                  serviceId: slot.serviceId,
                });
              const started = hasSlotStarted(slot, now);
              const remaining = Math.max(0, slot.capacity - slot.bookedCount);
              const fitsHours =
                workingHours.length === 0
                  ? true
                  : slotFitsWorkingHours(slot, workingHours);
              const serviceInactive = service?.status === "INACTIVE";

              const statusText =
                slot.status === "CANCELLED"
                  ? locale.statusCancelled
                  : slot.status === "CLOSED"
                    ? locale.statusClosed
                    : remaining > 0
                      ? formatMessage(locale.statusOpenAvailable, { remaining })
                      : locale.statusOpenFull;

              const statusClass =
                slot.status === "CANCELLED"
                  ? styles.slotBadgeCancelled
                  : slot.status === "CLOSED"
                    ? styles.slotBadgeClosed
                    : remaining > 0
                      ? styles.slotBadgeOpen
                      : styles.slotBadgeFull;

              return (
                <li key={slot.id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onSelect(slot.id)}
                    aria-label={formatMessage(locale.viewLabel, {
                      date: formatAvailabilityDate(slot.slotDate),
                      start: formatTimeHhMm(slot.startTime),
                      end: formatTimeHhMm(slot.endTime),
                    })}
                  >
                    <div className={styles.slotListHeader}>
                      <strong>
                        {formatAvailabilityDate(slot.slotDate)} ·{" "}
                        {formatTimeInterval(slot.startTime, slot.endTime)}
                      </strong>
                      <span className={`${styles.slotBadge} ${statusClass}`}>
                        {statusText}
                      </span>
                    </div>
                    <span>
                      {formatMessage(locale.summary, {
                        serviceName,
                        booked: slot.bookedCount,
                        capacity: slot.capacity,
                      })}
                    </span>
                    {(started ||
                      (slot.status === "OPEN" && !started && !fitsHours) ||
                      serviceInactive) && (
                      <div className={styles.tagRow}>
                        {started && (
                          <small className={styles.metaTag}>
                            {locale.tagStarted}
                          </small>
                        )}
                        {slot.status === "OPEN" && !started && !fitsHours && (
                          <small className={styles.warningTag}>
                            {locale.tagOutsideHours}
                          </small>
                        )}
                        {serviceInactive && (
                          <small className={styles.warningTag}>
                            {locale.tagInactiveService}
                          </small>
                        )}
                      </div>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </ProviderWorkspaceDialog>
  );
}
