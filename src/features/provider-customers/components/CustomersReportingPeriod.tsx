"use client";

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
  return <section className={styles.period} aria-label="Kỳ báo cáo">
    <form className={styles.periodForm} onSubmit={submit} noValidate aria-describedby={error ? errorId : undefined}>
      <label>Từ ngày<input type="date" required value={draft.start} aria-invalid={!!error} onChange={(event) => { setDraft({ ...draft, start: event.target.value }); setError(null); }} /></label>
      <label>Đến ngày<input type="date" required value={draft.end} aria-invalid={!!error} onChange={(event) => { setDraft({ ...draft, end: event.target.value }); setError(null); }} /></label>
      <button className={styles.primaryButton} type="submit">Áp dụng kỳ</button>
    </form>
    {error && <p id={errorId} role="alert" className={styles.error}>{error}</p>}
    <p className={styles.selectedPeriod} role="status">Kỳ đang chọn: <strong>{formatCustomerDate(range.start)} – {formatCustomerDate(range.end)}</strong> · Asia/Ho_Chi_Minh</p>
    <p>Chỉ số và nhóm khách tính theo giờ bắt đầu lịch đã hoàn thành. Kỳ báo cáo không giới hạn danh sách khách hoặc lịch sử booking.</p>
  </section>;
}
