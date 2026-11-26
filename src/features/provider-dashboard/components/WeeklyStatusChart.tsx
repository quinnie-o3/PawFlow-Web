import { RefreshCw } from "lucide-react";
import { formatMessage, vi } from "@/lib/locale";
import type { ProviderApiErrorInfo } from "../../provider-workspace/liveApi";
import { getProviderErrorMessage } from "../../provider-workspace/lifecycle";
import type { WeeklyStatusPoint } from "../types";
import styles from "../dashboard.module.css";

type WeeklyStatusChartProps = {
  status: "idle" | "loading" | "ready" | "error";
  data: readonly WeeklyStatusPoint[];
  period: string;
  facilityName: string | null;
  error: ProviderApiErrorInfo | null;
  reloading: boolean;
  cooldownSeconds: number;
  onRetry: () => void;
};

export default function WeeklyStatusChart({
  status,
  data,
  period,
  facilityName,
  error,
  reloading,
  cooldownSeconds,
  onRetry,
}: WeeklyStatusChartProps) {
  const maxValue = Math.max(
    1,
    ...data.flatMap((point) => [point.completed, point.other]),
  );

  return (
    <section className="min-w-0 rounded-[12px] bg-white p-6 shadow-[0_2px_8px_rgb(0_0_0_/_0.05)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[16px] font-bold leading-5 text-[var(--text-primary)]">
          {vi.provider.dashboard.chart.title}
        </h2>
        <span className="flex min-h-6 items-center justify-center rounded-full bg-[#3025a7] px-2.5 py-1 text-[11px] font-semibold leading-4 text-white">
          {period}
        </span>
      </div>

      {status === "loading" || status === "idle" ? (
        <p
          role="status"
          aria-busy="true"
          className="py-10 text-[13px] text-[var(--text-secondary)]"
        >
          {vi.provider.dashboard.chart.loading}
        </p>
      ) : status === "error" ? (
        <div className={`${styles.blockError} mt-4`} role="alert">
          <h3>{vi.provider.dashboard.chart.errorTitle}</h3>
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
            {vi.provider.dashboard.chart.retry}
          </button>
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-4 text-[12px] leading-[15px] text-[var(--text-secondary)]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-[4px] bg-[var(--accent-hover)]" />
              {vi.provider.dashboard.chart.completedLabel}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-[4px] bg-[var(--color-neutral-200)]" />
              {vi.provider.dashboard.chart.other}
            </span>
          </div>

          {data.length > 0 ? (
            <div
              className="mt-4 min-w-0"
              role="img"
              aria-label={formatMessage(vi.provider.dashboard.chart.weeklyLabel, {
                points: data
                  .map((point) =>
                    formatMessage(vi.provider.dashboard.chart.pointSummary, {
                      label: point.label,
                      completed: point.completed,
                      other: point.other,
                    }),
                  )
                  .join("; "),
              })}
            >
              <div
                className={styles.chartGrid}
                style={{
                  gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))`,
                }}
              >
                {data.map((point) => (
                  <div key={point.key} className={styles.chartColumn}>
                    <div className={styles.chartBars}>
                      <span
                        className={`${styles.chartBar} bg-[var(--accent-hover)]`}
                        style={{
                          height: `${Math.max(
                            point.completed > 0 ? 6 : 0,
                            (point.completed / maxValue) * 140,
                          )}px`,
                        }}
                        title={formatMessage(
                          vi.provider.dashboard.chart.completedCount,
                          { label: point.label, count: point.completed },
                        )}
                      />
                      <span
                        className={`${styles.chartBar} bg-[var(--color-neutral-200)]`}
                        style={{
                          height: `${Math.max(
                            point.other > 0 ? 6 : 0,
                            (point.other / maxValue) * 140,
                          )}px`,
                        }}
                        title={formatMessage(
                          vi.provider.dashboard.chart.otherCount,
                          { label: point.label, count: point.other },
                        )}
                      />
                    </div>
                    <span className={styles.chartLabel}>{point.label}</span>
                    {point.rangeLabel !== point.label && (
                      <span className={styles.chartSubLabel}>
                        {point.rangeLabel}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="py-10 text-[14px] leading-5 text-[var(--text-secondary)]">
              {vi.provider.dashboard.chart.empty}
            </p>
          )}

          <p className="mt-3 text-[12px] leading-[15px] text-[var(--text-secondary)]">
            {facilityName
              ? formatMessage(vi.provider.dashboard.chart.note, {
                  facilityName,
                })
              : vi.provider.dashboard.chart.noteFallback}
          </p>
        </>
      )}
    </section>
  );
}
