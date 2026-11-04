"use client";

import { CalendarDays, RefreshCw } from "lucide-react";
import type { MockService, MockSlot } from "../../customer-catalog/types";
import { availabilityLabel, formatDateOnly, remaining, slotState } from "../../customer-catalog/catalogLogic";
import { useCatalogWorkspace } from "../../discovery-shell/CatalogWorkspace";
import styles from "../detail.module.css";

const labels = { available: "Còn chỗ", past: "Đã qua", closed: "Đã đóng", full: "Hết chỗ", unknown: "Chưa biết số chỗ / thời gian" };
export default function AvailabilityPanel({ service, resource, onRetry }: { service: MockService; resource: { status: "loading" } | { status: "error"; error: string } | { status: "ready"; data: MockSlot[] }; onRetry: () => void }) {
  const { now } = useCatalogWorkspace();
  const slots = resource.status === "ready" ? resource.data.filter(s => s.serviceId === service.id && s.providerId === service.providerId).sort((a, b) => `${a.date}T${a.start}`.localeCompare(`${b.date}T${b.start}`) || a.id.localeCompare(b.id)) : [];
  return <section id="availability" className={styles.availability} aria-labelledby="availability-title" aria-busy={resource.status === "loading"}>
    <div className={styles.panelHeading}><CalendarDays aria-hidden="true" size={24} /><h2 id="availability-title">Lịch khả dụng · {service.name}</h2></div>
    <p>Chỉ xem lịch mô phỏng · Giờ Việt Nam (UTC+7). Chưa chọn hoặc giữ chỗ; số chỗ có thể thay đổi khi đặt lịch.</p>
    {resource.status === "loading" && <p role="status">Đang tải lịch mô phỏng…</p>}
    {resource.status === "error" && <div role="alert" className={styles.feedback}><p>{resource.error}</p><button type="button" onClick={onRetry}><RefreshCw aria-hidden="true" size={18} />Thử tải lại lịch</button></div>}
    {resource.status === "ready" && <><p role="status" className={styles.availabilitySummary}>{availabilityLabel(service, slots, now)}</p>
      {service.schedule === "known" && slots.length > 0 && <ul className={styles.slots}>{slots.map(slot => { const state = slotState(slot, now); return <li key={slot.id} className={styles.slot} data-state={state}><strong>{formatDateOnly(slot.date)}</strong><span>{slot.start}–{slot.end}</span><span className={styles.slotBadge}>{labels[state]}{state === "available" ? ` · ${remaining(slot)} chỗ` : ""}</span></li>; })}</ul>}
    </>}
  </section>;
}
