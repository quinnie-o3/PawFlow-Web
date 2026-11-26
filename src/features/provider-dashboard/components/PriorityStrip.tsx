import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { formatMessage, vi } from "@/lib/locale";
import type { ProviderApiErrorInfo } from "../../provider-workspace/liveApi";
import { getProviderErrorMessage } from "../../provider-workspace/lifecycle";
import { formatDate } from "../data/dashboardAnalytics";
import type { PrioritySummary } from "../types";
import { LinkIcon } from "./icons";
import styles from "../dashboard.module.css";

type PriorityStripProps = {
  status: "idle" | "loading" | "ready" | "error";
  priority: PrioritySummary;
  error: ProviderApiErrorInfo | null;
  reloading: boolean;
  cooldownSeconds: number;
  onRetry: () => void;
};

export default function PriorityStrip({
  status,
  priority,
  error,
  reloading,
  cooldownSeconds,
  onRetry,
}: PriorityStripProps) {
  if (status === "loading" || status === "idle") {
    return (
      <section
        className={`${styles.priorityStrip} rounded-[12px] p-5 text-white`}
        role="status"
        aria-busy="true"
      >
        <h2 className="text-[16px] font-bold leading-5">
          {vi.provider.dashboard.priority.title}
        </h2>
        <p className="mt-2 text-[13px] text-white/85">
          {vi.provider.dashboard.priority.loading}
        </p>
      </section>
    );
  }

  if (status === "error") {
    return (
      <section className={styles.blockError} role="alert">
        <h2>{vi.provider.dashboard.priority.errorTitle}</h2>
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
          {vi.provider.dashboard.priority.retry}
        </button>
      </section>
    );
  }

  return (
    <section
      className={`${styles.priorityStrip} flex flex-col gap-4 rounded-[12px] p-5 text-white sm:flex-row sm:items-center sm:justify-between`}
    >
      <div className="min-w-0">
        <h2 className="text-[16px] font-bold leading-5">{priority.title}</h2>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[14px] leading-[18px] text-white/90">
          <span>{priority.waitingRequests}</span>
          <span>{priority.todayAppointments}</span>
        </div>
        <p className="mt-1 text-[11px] leading-4 text-white/80">
          {formatMessage(vi.provider.dashboard.priority.today, {
            date: formatDate(priority.todayDate),
          })}
        </p>
        {(priority.missingActiveServices ||
          priority.missingUpcomingOpenSlots) && (
          <div className={styles.setupHints}>
            {priority.missingActiveServices && (
              <Link
                href="/dashboard/services"
                prefetch={false}
                className={styles.setupHintPill}
              >
                {vi.provider.dashboard.priority.setupNoServices} ·{" "}
                {vi.provider.dashboard.priority.setupServicesLink}
              </Link>
            )}
            {priority.missingUpcomingOpenSlots && (
              <Link
                href="/dashboard/availability"
                prefetch={false}
                className={styles.setupHintPill}
              >
                {vi.provider.dashboard.priority.setupNoSlots} ·{" "}
                {vi.provider.dashboard.priority.setupAvailabilityLink}
              </Link>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => {
          const heading = document.getElementById("booking-requests-title");
          heading?.scrollIntoView({
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
              .matches
              ? "instant"
              : "smooth",
            block: "start",
          });
          heading?.focus({ preventScroll: true });
        }}
        className={`${styles.primaryAction} inline-flex h-[38px] w-fit shrink-0 items-center gap-2 rounded-[6px] bg-white px-4 text-[14px] font-bold leading-[18px] transition-colors hover:bg-[var(--surface-primary)]`}
      >
        {vi.provider.dashboard.priority.viewRequests}
        <LinkIcon className="h-4 w-4" />
      </button>
    </section>
  );
}
