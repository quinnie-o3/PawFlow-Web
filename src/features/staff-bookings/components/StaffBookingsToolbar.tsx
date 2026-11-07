import { vi } from "@/lib/locale";
import { Search, X } from "lucide-react";
import { staffStatusLabels, staffStatusOrder } from "../staffBookingLogic";
import type { StaffBookingFilters } from "../types";
import styles from "../staffBookings.module.css";

export default function StaffBookingsToolbar({ filters, onChange }: { filters: StaffBookingFilters; onChange: (filters: StaffBookingFilters) => void }) {
  const hasFilters = filters.status !== "all" || filters.query.trim() !== "";
  return <>
    <div className={styles.filters} role="group" aria-label={vi.staff.bookings.toolbar.statusFilterLabel}>
      <button type="button" aria-pressed={filters.status === "all"} onClick={() => onChange({ ...filters, status: "all" })}>{vi.common.actions.all}</button>
      {staffStatusOrder.map((status) => <button type="button" key={status} aria-pressed={filters.status === status} onClick={() => onChange({ ...filters, status })}>{staffStatusLabels[status]}</button>)}
    </div>
    <div className={styles.searchRow}>
      <label className={styles.search}><Search size={18} aria-hidden="true" />
        <span className={styles.srOnly}>{vi.staff.bookings.toolbar.searchLabel}</span>
        <input type="search" placeholder={vi.staff.bookings.toolbar.searchPlaceholder} value={filters.query} onChange={(event) => onChange({ ...filters, query: event.target.value })} />
      </label>
      {hasFilters && <button type="button" className={styles.clearButton} onClick={() => onChange({ query: "", status: "all" })}><X size={16} aria-hidden="true" />{vi.staff.bookings.toolbar.clearFilters}</button>}
    </div>
  </>;
}
