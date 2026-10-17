"use client";

import { useId, useRef, useState } from "react";
import type { DateRange, ProviderSummary } from "../types";
import { CalendarIcon } from "./icons";
import styles from "../dashboard.module.css";

export default function OverviewIntro({ summary, range, onApply }: {
  summary: ProviderSummary;
  range: DateRange;
  onApply: (range: DateRange) => void;
}) {
  const [draft, setDraft] = useState(range);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-[24px] font-bold leading-[30px] text-[var(--text-primary)]">Tổng quan hoạt động</h1>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="text-[12px] font-semibold leading-[15px] text-[var(--text-secondary)]">Dữ liệu mẫu cho</span>
          <span className="rounded-full bg-[var(--accent-hover)] px-2.5 py-1 text-[12px] font-bold leading-[15px] text-white">{summary.providerName}</span>
        </div>
      </div>
      <div className="relative w-fit shrink-0" onKeyDown={(event) => {
        if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); }
      }}>
        <button ref={trigger} type="button" aria-expanded={open} aria-controls={id} onClick={() => { setDraft(range); setError(""); setOpen(!open); }}
          className={`${styles.reportingPeriod} ${styles.periodButton} flex cursor-pointer items-center gap-2 rounded-[6px] border bg-white px-3 py-2 text-[var(--text-primary)]`}>
          <CalendarIcon className="h-4 w-4" />
          {summary.reportingPeriod}
        </button>
        {open && (
          <form id={id} onSubmit={(event) => {
            event.preventDefault();
            if (!draft.start || !draft.end || draft.start > draft.end) {
              setError("Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.");
              return;
            }
            onApply(draft);
            setOpen(false);
            trigger.current?.focus();
          }} onKeyDown={(event) => { if (event.key === "Escape") { setOpen(false); event.currentTarget.parentElement?.querySelector("button")?.focus(); } }}
            className={`${styles.filterForm} absolute left-0 z-20 mt-2 w-[280px] max-w-[calc(100vw-80px)] rounded-[8px] border border-[#eee] bg-white p-4 text-[13px] leading-[18px] shadow-lg sm:left-auto sm:right-0`}>
            <label className="block font-semibold" htmlFor={id + "-start"}>Từ ngày</label>
            <input id={id + "-start"} type="date" required value={draft.start} onChange={(event) => setDraft({ ...draft, start: event.target.value })}
              className="mt-1 block min-w-0 w-full rounded-[6px] border bg-white px-2 py-2" />
            <label className="mt-3 block font-semibold" htmlFor={id + "-end"}>Đến ngày</label>
            <input id={id + "-end"} type="date" required value={draft.end} onChange={(event) => setDraft({ ...draft, end: event.target.value })}
              className="mt-1 block min-w-0 w-full rounded-[6px] border bg-white px-2 py-2" />
            {error && <p role="alert" className="mt-2 text-[12px] text-[#b42318]">{error}</p>}
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={() => { setOpen(false); trigger.current?.focus(); }} className="cursor-pointer rounded-[6px] px-3 py-2">Hủy</button>
              <button type="submit" className="cursor-pointer rounded-[6px] bg-[var(--accent-hover)] px-3 py-2 font-semibold text-white">Áp dụng</button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
