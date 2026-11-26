"use client";

import { Circle, RefreshCw } from "lucide-react";
import { vi } from "@/lib/locale";
import { getProviderErrorMessage } from "@/features/provider-workspace/lifecycle";
import { formatRanges } from "../availabilityLogic";
import type {
  AvailabilityLoadStatus,
  ProviderApiErrorInfo,
  WeeklyDaySchedule,
} from "../types";
import styles from "../availability.module.css";

export default function WeeklySchedule({
  status,
  days,
  error,
  reloading,
  cooldownSeconds,
  canManageResources,
  onOpenDialog,
  onRetry,
}: {
  status: AvailabilityLoadStatus;
  days: readonly WeeklyDaySchedule[];
  error: ProviderApiErrorInfo | null;
  reloading: boolean;
  cooldownSeconds: number;
  canManageResources: boolean;
  onOpenDialog: () => void;
  onRetry: () => void;
}) {
  const weeklyLocale = vi.provider.availability.weekly;
  const hasAnyActiveShift = days.some((day) => day.active.length > 0);

  return (
    <section
      className={`${styles.card} ${styles.weeklyCard}`}
      aria-labelledby="weekly-hours-title"
    >
      <div className={styles.cardHeaderRow}>
        <div className={styles.sectionHeading}>
          <h2 id="weekly-hours-title">{weeklyLocale.title}</h2>
          <p>{weeklyLocale.description}</p>
        </div>
        {status === "ready" && (
          <button
            type="button"
            className={styles.textButton}
            onClick={onOpenDialog}
          >
            {canManageResources ? weeklyLocale.edit : weeklyLocale.view}
          </button>
        )}
      </div>

      {status === "idle" || status === "loading" ? (
        <div
          className={styles.skeletonList}
          role="status"
          aria-busy="true"
          aria-label={weeklyLocale.loading}
        >
          {Array.from({ length: 7 }).map((_, idx) => (
            <div key={idx} className={styles.skeletonRow} />
          ))}
          <p className={styles.srOnly}>{weeklyLocale.loading}</p>
        </div>
      ) : status === "error" ? (
        <div className={styles.stateBox}>
          <h3>{weeklyLocale.loadErrorTitle}</h3>
          <p role="alert">
            {error
              ? getProviderErrorMessage(error, cooldownSeconds)
              : vi.provider.workspace.errors.UNKNOWN_ERROR}
          </p>
          <button
            type="button"
            className={styles.outlineButton}
            disabled={reloading || cooldownSeconds > 0}
            onClick={onRetry}
          >
            <RefreshCw aria-hidden="true" focusable="false" size={14} />
            {reloading ? vi.provider.availability.page.reloading : weeklyLocale.retry}
          </button>
        </div>
      ) : (
        <>
          <ul className={styles.weeklyList}>
            {days.map((day) => {
              const isOpen = day.active.length > 0;
              return (
                <li key={day.dayOfWeek}>
                  <span className={styles.dayName}>{day.label}</span>
                  <span className={styles.hours}>
                    {formatRanges(day.active)}
                  </span>
                  <span
                    className={`${styles.badge} ${isOpen ? styles.open : styles.closed}`}
                  >
                    <Circle
                      aria-hidden="true"
                      focusable="false"
                      size={7}
                      strokeWidth={2}
                      fill="currentColor"
                    />
                    {isOpen ? weeklyLocale.open : weeklyLocale.closed}
                  </span>
                </li>
              );
            })}
          </ul>
          {!hasAnyActiveShift && (
            <p className={styles.hint}>{weeklyLocale.empty}</p>
          )}
        </>
      )}
    </section>
  );
}
