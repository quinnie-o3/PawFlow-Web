"use client";

import { formatMessage, vi } from "@/lib/locale";
import type { AvailabilitySummaryMetrics } from "../types";
import styles from "../availability.module.css";

export default function AvailabilitySummary({
  summary,
}: {
  summary: AvailabilitySummaryMetrics;
}) {
  const locale = vi.provider.availability.summary;
  const cards = [
    {
      key: "open",
      title: locale.openSlots,
      value: String(summary.openSlotsNext7Days).padStart(2, "0"),
      note: locale.openSlotsNote,
    },
    {
      key: "held",
      title: locale.heldBookings,
      value: String(summary.heldBookingsNext7Days).padStart(2, "0"),
      note: locale.heldBookingsNote,
    },
    {
      key: "days",
      title: locale.activeDays,
      value: formatMessage(locale.activeDaysValue, {
        active: summary.activeDaysCount,
      }),
      note: formatMessage(locale.activeDaysNote, {
        shifts: summary.activeShiftsCount,
      }),
    },
  ] as const;

  return (
    <section className={styles.summaries} aria-label={locale.region}>
      {cards.map((item) => (
        <article key={item.key}>
          <h2>{item.title}</h2>
          <p className={styles.summaryCount}>{item.value}</p>
          <p>{item.note}</p>
        </article>
      ))}
    </section>
  );
}
