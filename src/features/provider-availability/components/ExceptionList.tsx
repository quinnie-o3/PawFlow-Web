"use client";

import Link from "next/link";
import { Info } from "lucide-react";
import { vi } from "@/lib/locale";
import styles from "../availability.module.css";

export default function ExceptionList({
  canOpenDialogs,
  onOpenSlots,
  onOpenWeekly,
}: {
  canOpenDialogs: boolean;
  onOpenSlots: () => void;
  onOpenWeekly: () => void;
}) {
  const locale = vi.provider.availability.exceptions;

  return (
    <section
      className={`${styles.card} ${styles.exceptionsCard}`}
      aria-labelledby="exceptions-title"
    >
      <div className={styles.cardHeaderRow}>
        <div className={styles.sectionHeading}>
          <h2 id="exceptions-title">{locale.title}</h2>
          <p>{locale.description}</p>
        </div>
        <span className={`${styles.badge} ${styles.badgeNeutral}`}>
          {locale.badge}
        </span>
      </div>

      <div className={styles.unsupportedBox}>
        <div className={styles.unsupportedHeading}>
          <Info aria-hidden="true" focusable="false" size={16} />
          <h3>{locale.unsupportedTitle}</h3>
        </div>
        <p>{locale.unsupportedBody}</p>
      </div>

      <div className={styles.guidanceBlock}>
        <p className={styles.guidanceTitle}>{locale.guidanceTitle}</p>
        <ul className={styles.guidanceList}>
          <li>{locale.guidanceStepSlots}</li>
          <li>{locale.guidanceStepBookings}</li>
          <li>{locale.guidanceStepWeekly}</li>
        </ul>
      </div>

      <div className={styles.slotActions}>
        <button
          type="button"
          className={styles.outlineButton}
          disabled={!canOpenDialogs}
          onClick={onOpenSlots}
        >
          {locale.openSlots}
        </button>
        <button
          type="button"
          className={styles.softButton}
          disabled={!canOpenDialogs}
          onClick={onOpenWeekly}
        >
          {locale.openWeekly}
        </button>
      </div>

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
