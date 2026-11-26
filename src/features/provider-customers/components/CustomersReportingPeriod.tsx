"use client";

import { useId, useState, type FormEvent } from "react";
import { formatMessageParts, vi } from "@/lib/locale";
import { formatCustomerDate, validateReportingRange } from "../customerLogic";
import type {
  CustomerPeriodPreset,
  CustomersPeriodMode,
  ReportingRange,
} from "../types";
import styles from "../customers.module.css";

const PRESETS: readonly { value: CustomerPeriodPreset; label: string }[] = [
  { value: "30d", label: vi.provider.customers.period.presets["30d"] },
  { value: "90d", label: vi.provider.customers.period.presets["90d"] },
  {
    value: "thisMonth",
    label: vi.provider.customers.period.presets.thisMonth,
  },
  { value: "allTime", label: vi.provider.customers.period.presets.allTime },
];

export default function CustomersReportingPeriod({
  periodMode,
  preset,
  range,
  onSelectPreset,
  onApply,
}: {
  periodMode: CustomersPeriodMode;
  preset: CustomerPeriodPreset;
  range: ReportingRange;
  onSelectPreset: (preset: CustomerPeriodPreset) => void;
  onApply: (range: ReportingRange) => void;
}) {
  const [draftState, setDraftState] = useState<{
    baseKey: string;
    draft: ReportingRange;
  }>(() => ({
    baseKey: `${range.start}:${range.end}`,
    draft: range,
  }));
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();

  const currentRangeKey = `${range.start}:${range.end}`;
  const draft =
    draftState.baseKey === currentRangeKey ? draftState.draft : range;

  function updateDraft(next: ReportingRange) {
    setDraftState({ baseKey: currentRangeKey, draft: next });
    setError(null);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = validateReportingRange(draft);
    setError(message);
    if (!message) {
      onApply({ start: draft.start, end: draft.end });
    }
  }

  return (
    <section
      className={styles.period}
      aria-label={vi.provider.customers.period.label}
    >
      <div
        className={styles.presetRow}
        role="group"
        aria-label={vi.provider.customers.period.label}
      >
        {PRESETS.map((item) => {
          const active =
            item.value === "allTime"
              ? periodMode === "all-time"
              : periodMode === "range" && preset === item.value;
          return (
            <button
              key={item.value}
              type="button"
              className={styles.presetButton}
              aria-pressed={active}
              onClick={() => {
                setError(null);
                onSelectPreset(item.value);
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <form
        className={styles.periodForm}
        onSubmit={submit}
        noValidate
        aria-describedby={error ? errorId : undefined}
      >
        <label>
          {vi.provider.customers.period.from}
          <input
            type="date"
            required
            value={draft.start}
            aria-invalid={Boolean(error)}
            onChange={(event) =>
              updateDraft({ ...draft, start: event.target.value })
            }
          />
        </label>
        <label>
          {vi.provider.customers.period.to}
          <input
            type="date"
            required
            value={draft.end}
            aria-invalid={Boolean(error)}
            onChange={(event) =>
              updateDraft({ ...draft, end: event.target.value })
            }
          />
        </label>
        <button className={styles.primaryButton} type="submit">
          {vi.provider.customers.period.apply}
        </button>
      </form>

      {error && (
        <p id={errorId} role="alert" className={styles.error}>
          {error}
        </p>
      )}

      <p className={styles.selectedPeriod} role="status">
        {periodMode === "all-time"
          ? vi.provider.customers.period.selectedAllTime
          : formatMessageParts(vi.provider.customers.period.selected, {
              range: (
                <strong key="range">
                  {formatCustomerDate(range.start)} –{" "}
                  {formatCustomerDate(range.end)}
                </strong>
              ),
            })}
      </p>
      <p>{vi.provider.customers.period.note}</p>
    </section>
  );
}
