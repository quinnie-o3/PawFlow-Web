"use client";

import { vi, formatMessage } from "@/lib/locale";

import { CalendarDays, RefreshCw } from "lucide-react";
import type { MockService, MockSlot } from "../../customer-catalog/types";
import { availabilityLabel, formatDateOnly, remaining, slotState } from "../../customer-catalog/catalogLogic";
import { useCatalogWorkspace } from "../../discovery-shell/CatalogWorkspace";
import styles from "../detail.module.css";

const labels = { available: vi.discovery.availability.available, past: vi.discovery.availability.past, closed: vi.discovery.availability.closed, full: vi.discovery.availability.full, unknown: vi.discovery.availability.unknown };
export default function AvailabilityPanel({ service, resource, onRetry }: { service: MockService; resource: { status: "loading" } | { status: "error"; error: string } | { status: "ready"; data: MockSlot[] }; onRetry: () => void }) {
  const { now } = useCatalogWorkspace();
  const slots = resource.status === "ready" ? resource.data.filter(s => s.serviceId === service.id && s.providerId === service.providerId).sort((a, b) => `${a.date}T${a.start}`.localeCompare(`${b.date}T${b.start}`) || a.id.localeCompare(b.id)) : [];
  return <section id="availability" className={styles.availability} aria-labelledby="availability-title" aria-busy={resource.status === "loading"}>
    <div className={styles.panelHeading}><CalendarDays aria-hidden="true" size={24} /><h2 id="availability-title">{formatMessage(vi.discovery.availability.title, { serviceName: service.name })}</h2></div>
    <p>{vi.discovery.availability.description}</p>
    {resource.status === "loading" && <p role="status">{vi.discovery.availability.loading}</p>}
    {resource.status === "error" && <div role="alert" className={styles.feedback}><p>{resource.error}</p><button type="button" onClick={onRetry}><RefreshCw aria-hidden="true" size={18} />{vi.discovery.availability.retry}</button></div>}
    {resource.status === "ready" && <><p role="status" className={styles.availabilitySummary}>{availabilityLabel(service, slots, now)}</p>
      {service.schedule === "known" && slots.length > 0 && <ul className={styles.slots}>{slots.map(slot => { const state = slotState(slot, now); return <li key={slot.id} className={styles.slot} data-state={state}><strong>{formatDateOnly(slot.date)}</strong><span>{slot.start}–{slot.end}</span><span className={styles.slotBadge}>{labels[state]}{state === "available" ? formatMessage(vi.discovery.availability.capacity, { remaining: String(remaining(slot)) }) : ""}</span></li>; })}</ul>}
    </>}
  </section>;
}
