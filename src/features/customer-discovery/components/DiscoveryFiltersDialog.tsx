"use client";

import { useEffect, useId, useRef } from "react";
import { X, Check } from "lucide-react";
import type { DiscoveryQuery } from "../../customer-catalog/types";
import { presetActive, togglePreset } from "../queryState";
import styles from "../discovery.module.css";

export default function DiscoveryFiltersDialog({ query, onApply, onReset, onClose }: { query: DiscoveryQuery; onApply: (query: DiscoveryQuery) => void; onReset: () => void; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null); const title = useId(); const description = useId();
  useEffect(() => {
    const dialog = ref.current; const trigger = document.activeElement; const before = document.documentElement.style.overflow;
    dialog?.showModal(); dialog?.querySelector<HTMLButtonElement>("button[aria-pressed]")?.focus(); document.documentElement.style.overflow = "hidden";
    return () => { dialog?.close(); document.documentElement.style.overflow = before; if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus(); };
  }, []);
  return <dialog ref={ref} className={styles.dialog} aria-labelledby={title} aria-describedby={description} onCancel={event => { event.preventDefault(); onClose(); }} onKeyDown={event => {
    if (event.key !== "Tab") return;
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not([disabled])"));
    const first = buttons[0]; const last = buttons.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }} onClick={event => {
    if (event.target !== event.currentTarget) return;
    const box = event.currentTarget.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose();
  }}>
    <div className={styles.dialogHeading}><h2 id={title}>Lọc cơ sở & dịch vụ</h2><button type="button" onClick={onClose} aria-label="Đóng bộ lọc"><X aria-hidden="true" size={20} /></button></div>
    <p id={description}>Chỉ hiển thị cơ sở đã được duyệt và dịch vụ đang hoạt động. Có thể kết hợp hai bộ điều kiện.</p>
    {([ ["nearby", "Quận 3 · Giá dưới 300.000 ₫ · Còn chỗ"], ["rated", "Tắm & spa · Đánh giá từ 4,5"] ] as const).map(([preset, label], index) => <button type="button" autoFocus={index === 0} key={preset} className={presetActive(query, preset) ? styles.presetActive : styles.preset} aria-pressed={presetActive(query, preset)} onClick={() => onApply(togglePreset(query, preset))}>{presetActive(query, preset) && <Check aria-hidden="true" size={18} />}{label}</button>)}
    <button type="button" className={styles.preset} onClick={onReset}>Đặt lại bộ lọc</button><button type="button" className={styles.preset} onClick={onClose}>Đóng</button>
  </dialog>;
}
