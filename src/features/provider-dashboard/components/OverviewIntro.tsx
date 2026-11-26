"use client";

import { useId, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { formatMessageParts, vi } from "@/lib/locale";
import { validateDashboardDateRange } from "../data/dashboardAnalytics";
import type {
  DashboardRangePreset,
  DateRange,
  ProviderSummary,
} from "../types";
import { CalendarIcon } from "./icons";
import styles from "../dashboard.module.css";

const PRESETS: readonly {
  value: Exclude<DashboardRangePreset, "custom">;
  label: string;
}[] = [
  { value: "7d", label: vi.provider.dashboard.intro.presets["7d"] },
  { value: "30d", label: vi.provider.dashboard.intro.presets["30d"] },
  { value: "90d", label: vi.provider.dashboard.intro.presets["90d"] },
];

export default function OverviewIntro({
  summary,
  preset,
  range,
  showControls,
  refreshing,
  refreshDisabled,
  onSelectPreset,
  onApply,
  onRefresh,
}: {
  summary: ProviderSummary;
  preset: DashboardRangePreset;
  range: DateRange;
  showControls: boolean;
  refreshing: boolean;
  refreshDisabled: boolean;
  onSelectPreset: (preset: Exclude<DashboardRangePreset, "custom">) => void;
  onApply: (range: DateRange) => void;
  onRefresh: () => void;
}) {
  const [draft, setDraft] = useState<DateRange>(range);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);

  return (
    <section className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <h1
          id="dashboard-overview-title"
          tabIndex={-1}
          className="text-[24px] font-bold leading-[30px] text-[var(--text-primary)]"
        >
          {vi.provider.dashboard.intro.title}
        </h1>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {summary.providerName ? (
            formatMessageParts(vi.provider.dashboard.intro.liveForProvider, {
              providerName: (
                <span
                  key="providerName"
                  className="rounded-full bg-[var(--accent-hover)] px-2.5 py-1 text-[12px] font-bold leading-[15px] text-white"
                >
                  {summary.providerName}
                </span>
              ),
            }).map((part, index) =>
              typeof part === "string" ? (
                part ? (
                  <span
                    key={index}
                    className="text-[12px] font-semibold leading-[15px] text-[var(--text-secondary)]"
                  >
                    {part.trimEnd()}
                  </span>
                ) : null
              ) : (
                part
              ),
            )
          ) : (
            <span className="text-[12px] font-semibold leading-[15px] text-[var(--text-secondary)]">
              {vi.provider.dashboard.intro.loadingProvider}
            </span>
          )}
        </div>
      </div>

      {showControls && (
        <div className="flex flex-wrap items-center gap-2">
          <div
            className={styles.presetGroup}
            role="group"
            aria-label={vi.provider.dashboard.intro.customRange}
          >
            {PRESETS.map((item) => (
              <button
                key={item.value}
                type="button"
                className={styles.presetButton}
                aria-pressed={preset === item.value}
                onClick={() => {
                  setOpen(false);
                  setError("");
                  onSelectPreset(item.value);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div
            className="relative w-fit shrink-0"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setOpen(false);
                trigger.current?.focus();
              }
            }}
          >
            <button
              ref={trigger}
              type="button"
              aria-expanded={open}
              aria-controls={id}
              onClick={() => {
                setDraft(range);
                setError("");
                setOpen((prev) => !prev);
              }}
              className={`${styles.reportingPeriod} ${styles.periodButton} flex cursor-pointer items-center gap-2 rounded-[6px] border bg-white px-3 py-2 text-[var(--text-primary)]`}
            >
              <CalendarIcon className="h-4 w-4" />
              {summary.reportingPeriod}
            </button>
            {open && (
              <form
                id={id}
                onSubmit={(event) => {
                  event.preventDefault();
                  const validation = validateDashboardDateRange(draft);
                  if (validation) {
                    setError(validation);
                    return;
                  }
                  onApply(draft);
                  setOpen(false);
                  trigger.current?.focus();
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setOpen(false);
                    trigger.current?.focus();
                  }
                }}
                className={`${styles.filterForm} absolute left-0 z-20 mt-2 w-[280px] max-w-[calc(100vw-64px)] rounded-[8px] border border-[#eee] bg-white p-4 text-[13px] leading-[18px] shadow-lg sm:left-auto sm:right-0`}
              >
                <label className="block font-semibold" htmlFor={`${id}-start`}>
                  {vi.provider.dashboard.intro.from}
                </label>
                <input
                  id={`${id}-start`}
                  type="date"
                  required
                  value={draft.start}
                  onChange={(event) => {
                    setDraft({ ...draft, start: event.target.value });
                    setError("");
                  }}
                  className="mt-1 block min-w-0 w-full rounded-[6px] border bg-white px-2 py-2"
                />
                <label
                  className="mt-3 block font-semibold"
                  htmlFor={`${id}-end`}
                >
                  {vi.provider.dashboard.intro.to}
                </label>
                <input
                  id={`${id}-end`}
                  type="date"
                  required
                  value={draft.end}
                  onChange={(event) => {
                    setDraft({ ...draft, end: event.target.value });
                    setError("");
                  }}
                  className="mt-1 block min-w-0 w-full rounded-[6px] border bg-white px-2 py-2"
                />
                {error && (
                  <p role="alert" className="mt-2 text-[12px] text-[#b42318]">
                    {error}
                  </p>
                )}
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      trigger.current?.focus();
                    }}
                    className="cursor-pointer rounded-[6px] px-3 py-2"
                  >
                    {vi.common.actions.cancel}
                  </button>
                  <button
                    type="submit"
                    className="cursor-pointer rounded-[6px] bg-[var(--accent-hover)] px-3 py-2 font-semibold text-white"
                  >
                    {vi.common.actions.apply}
                  </button>
                </div>
              </form>
            )}
          </div>

          <button
            type="button"
            className={styles.refreshButton}
            disabled={refreshDisabled || refreshing}
            onClick={onRefresh}
          >
            <RefreshCw aria-hidden="true" size={14} />
            {refreshing
              ? vi.provider.dashboard.intro.refreshing
              : vi.provider.dashboard.intro.refresh}
          </button>
        </div>
      )}
    </section>
  );
}
