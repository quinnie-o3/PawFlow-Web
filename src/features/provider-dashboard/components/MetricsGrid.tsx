import { RefreshCw } from "lucide-react";
import { vi } from "@/lib/locale";
import type { ProviderApiErrorInfo } from "../../provider-workspace/liveApi";
import { getProviderErrorMessage } from "../../provider-workspace/lifecycle";
import type { MetricCardData } from "../types";
import MetricCard from "./MetricCard";
import styles from "../dashboard.module.css";

type MetricsGridProps = {
  status: "idle" | "loading" | "ready" | "error";
  metrics: readonly MetricCardData[];
  error: ProviderApiErrorInfo | null;
  reloading: boolean;
  cooldownSeconds: number;
  onRetry: () => void;
};

export default function MetricsGrid({
  status,
  metrics,
  error,
  reloading,
  cooldownSeconds,
  onRetry,
}: MetricsGridProps) {
  if (status === "loading" || status === "idle") {
    return (
      <section
        className={styles.blockCard}
        role="status"
        aria-busy="true"
        aria-label={vi.provider.dashboard.metrics.region}
      >
        <p className="text-[13px] text-[var(--text-secondary)]">
          {vi.provider.dashboard.metrics.loading}
        </p>
      </section>
    );
  }

  if (status === "error") {
    return (
      <section
        className={styles.blockError}
        role="alert"
        aria-label={vi.provider.dashboard.metrics.region}
      >
        <h2>{vi.provider.dashboard.metrics.errorTitle}</h2>
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
          {vi.provider.dashboard.metrics.retry}
        </button>
      </section>
    );
  }

  return (
    <section
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
      aria-label={vi.provider.dashboard.metrics.region}
    >
      {metrics.map((metric) => (
        <MetricCard key={metric.id} metric={metric} />
      ))}
    </section>
  );
}
