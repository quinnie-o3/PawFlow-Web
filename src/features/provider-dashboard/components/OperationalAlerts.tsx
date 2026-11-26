"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { vi } from "@/lib/locale";
import type { ProviderApiErrorInfo } from "../../provider-workspace/liveApi";
import { getProviderErrorMessage } from "../../provider-workspace/lifecycle";
import ProviderWorkspaceDialog from "../../provider-workspace/components/ProviderWorkspaceDialog";
import type { LocalizedDssAlert } from "../types";
import { LinkIcon, NotificationIcon } from "./icons";
import styles from "../dashboard.module.css";

export default function OperationalAlerts({
  status,
  alerts,
  hasData,
  allowDialog,
  error,
  reloading,
  cooldownSeconds,
  onRetry,
}: {
  status: "idle" | "loading" | "ready" | "error";
  alerts: readonly LocalizedDssAlert[];
  hasData: boolean;
  allowDialog: boolean;
  error: ProviderApiErrorInfo | null;
  reloading: boolean;
  cooldownSeconds: number;
  onRetry: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected =
    allowDialog && selectedId
      ? alerts.find((item) => item.id === selectedId) ?? null
      : null;

  return (
    <section className="min-w-0 rounded-[12px] bg-white p-6 shadow-[0_2px_8px_rgb(0_0_0_/_0.05)]">
      <h2 className="text-[16px] font-bold leading-5 text-[var(--text-primary)]">
        {vi.provider.dashboard.alerts.title}
      </h2>

      {status === "loading" || status === "idle" ? (
        <p
          role="status"
          aria-busy="true"
          className="mt-4 py-4 text-[13px] text-[var(--text-secondary)]"
        >
          {vi.provider.dashboard.alerts.loading}
        </p>
      ) : status === "error" ? (
        <div className={`${styles.blockError} mt-4`} role="alert">
          <h3>{vi.provider.dashboard.alerts.errorTitle}</h3>
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
            {vi.provider.dashboard.alerts.retry}
          </button>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {alerts.map((alert) => (
            <article
              key={alert.id}
              className="rounded-[8px] bg-[var(--surface-primary)] p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span
                    className={`${styles.severityBadge} ${
                      alert.severity === "WARNING"
                        ? styles.severityWarning
                        : styles.severityInfo
                    }`}
                  >
                    {alert.severityLabel}
                  </span>
                  <h3 className="mt-1.5 text-[14px] font-bold leading-[18px] text-[var(--accent-hover)]">
                    {alert.title}
                  </h3>
                </div>
                <NotificationIcon className="h-5 w-5 shrink-0" />
              </div>
              <p className="mt-2 text-[12px] leading-[17px] text-[var(--text-secondary)]">
                {alert.summary}
              </p>
              <button
                type="button"
                onClick={() => setSelectedId(alert.id)}
                className={`${styles.alertAction} mt-3 inline-flex cursor-pointer items-center gap-1 text-[var(--accent-hover)]`}
              >
                {vi.provider.dashboard.alerts.viewData}{" "}
                <LinkIcon small className="h-3.5 w-3.5" />
              </button>
            </article>
          ))}
          {alerts.length === 0 && (
            <p className="py-6 text-[14px] leading-5 text-[var(--text-secondary)]">
              {hasData
                ? vi.provider.dashboard.alerts.none
                : vi.provider.dashboard.alerts.noData}
            </p>
          )}
        </div>
      )}

      {selected && (
        <ProviderWorkspaceDialog
          title={selected.title}
          subtitle={`${selected.severityLabel} · ${selected.period}`}
          restoreFocusFallbackId="dashboard-overview-title"
          onClose={() => setSelectedId(null)}
        >
          <p className="text-[13px] leading-5 text-[var(--text-primary)]">
            {selected.summary}
          </p>
          <dl className="mt-4 grid grid-cols-[minmax(0,130px)_minmax(0,1fr)] gap-x-4 gap-y-3 text-[13px]">
            <dt className="text-[var(--text-muted)]">
              {vi.provider.dashboard.alerts.detailLabels.severity}
            </dt>
            <dd>{selected.severityLabel}</dd>

            <dt className="text-[var(--text-muted)]">
              {vi.provider.dashboard.alerts.detailLabels.period}
            </dt>
            <dd>{selected.period}</dd>

            <dt className="text-[var(--text-muted)]">
              {vi.provider.dashboard.alerts.detailLabels.scope}
            </dt>
            <dd>{selected.scope}</dd>

            <dt className="text-[var(--text-muted)]">
              {vi.provider.dashboard.alerts.detailLabels.metric}
            </dt>
            <dd>{selected.metric}</dd>

            <dt className="text-[var(--text-muted)]">
              {vi.provider.dashboard.alerts.detailLabels.threshold}
            </dt>
            <dd>{selected.threshold}</dd>

            <dt className="text-[var(--text-muted)]">
              {vi.provider.dashboard.alerts.detailLabels.recommendation}
            </dt>
            <dd className="font-semibold text-[var(--text-primary)]">
              {selected.recommendation}
            </dd>
          </dl>
          <p className="mt-4 text-[12px] leading-[18px] text-[var(--text-muted)]">
            {vi.provider.dashboard.alerts.periodNote}
          </p>
        </ProviderWorkspaceDialog>
      )}
    </section>
  );
}
