import { Search } from "lucide-react";
import type { CustomerFilters } from "../types";
import styles from "../customers.module.css";

const groups = [{ value: "all", label: "Tất cả" }, { value: "returning", label: "Quay lại" }, { value: "new", label: "Mới" }] as const;

export default function CustomersToolbar({ filters, onChange }: { filters: CustomerFilters; onChange: (filters: CustomerFilters) => void }) {
  return <div className={styles.toolbar}>
    <div className={styles.filters} role="group" aria-label="Lọc nhóm khách theo kỳ">
      {groups.map((group) => <button key={group.value} type="button" aria-pressed={filters.group === group.value}
        onClick={() => onChange({ ...filters, group: group.value })}>{group.label}</button>)}
    </div>
    <label className={styles.search}>
      <span className={styles.srOnly}>Tìm mã khách, tên khách hoặc thú cưng</span>
      <Search className={styles.searchIcon} aria-hidden="true" focusable="false" size={16} />
      <input type="search" placeholder="Tên khách, thú cưng hoặc mã khách" value={filters.query} onChange={(event) => onChange({ ...filters, query: event.target.value })} />
    </label>
  </div>;
}
