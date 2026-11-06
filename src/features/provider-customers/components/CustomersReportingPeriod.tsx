"use client";

import { vi, formatMessageParts } from "@/lib/locale";

import { useId, useState, type FormEvent } from "react";
import { formatCustomerDate, validateReportingRange } from "../customerLogic";
import type { ReportingRange } from "../types";
import styles from "../customers.module.css";

export default function CustomersReportingPeriod({ range, onApply }: { range: ReportingRange; onApply: (range: ReportingRange) => void }) {
  const [draft, setDraft] = useState(range);
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = validateReportingRange(draft);
    setError(message);
    if (!message) onApply({ ...draft });
  }
  return <section className={styles.period} aria-label={vi.provider.customers.period.label}>
    <form className={styles.periodForm} onSubmit={submit} noValidate aria-describedby={error ? errorId : undefined}>
      <label>{vi.provider.customers.period.from}<input type="date" required value={draft.start} aria-invalid={!!error} onChange={(event) => { setDraft({ ...draft, start: event.target.value }); setError(null); }} /></label>
      <label>{vi.provider.customers.period.to}<input type="date" required value={draft.end} aria-invalid={!!error} onChange={(event) => { setDraft({ ...draft, end: event.target.value }); setError(null); }} /></label>
      <button className={styles.primaryButton} type="submit">{vi.provider.customers.period.apply}</button>
    </form>
    {error && <p id={errorId} role="alert" className={styles.error}>{error}</p>}
    <p className={styles.selectedPeriod} role="status">{formatMessageParts(vi.provider.customers.period.selected, { range: <strong key="range">{formatCustomerDate(range.start)} – {formatCustomerDate(range.end)}</strong> })}</p>
    <p>{vi.provider.customers.period.note}</p>
  </section>;
}
