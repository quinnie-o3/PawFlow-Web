import { vi } from "@/lib/locale";
import { Search } from "lucide-react";
import type { CustomerFilters } from "../types";
import styles from "../customers.module.css";

const groups = [{ value: "all", label: vi.common.actions.all }, { value: "returning", label: vi.provider.customers.groups.returning }, { value: "new", label: vi.provider.customers.groups.new }] as const;

export default function CustomersToolbar({ filters, onChange }: { filters: CustomerFilters; onChange: (filters: CustomerFilters) => void }) {
  return <div className={styles.toolbar}>
    <div className={styles.filters} role="group" aria-label={vi.provider.customers.filters.groupLabel}>
      {groups.map((group) => <button key={group.value} type="button" aria-pressed={filters.group === group.value}
        onClick={() => onChange({ ...filters, group: group.value })}>{group.label}</button>)}
    </div>
    <label className={styles.search}>
      <span className={styles.srOnly}>{vi.provider.customers.filters.searchLabel}</span>
      <Search className={styles.searchIcon} aria-hidden="true" focusable="false" size={16} />
      <input type="search" placeholder={vi.provider.customers.filters.searchPlaceholder} value={filters.query} onChange={(event) => onChange({ ...filters, query: event.target.value })} />
    </label>
  </div>;
}
