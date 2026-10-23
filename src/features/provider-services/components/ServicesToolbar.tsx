import { useId } from "react";
import { Search } from "lucide-react";
import type { ServiceFilters } from "../types";
import styles from "../services.module.css";

export default function ServicesToolbar({ filters, onChange }: { filters: ServiceFilters; onChange: (filters: ServiceFilters) => void }) {
  const searchId = useId();
  return <div className={styles.toolbar}>
    <div className={styles.filters} role="group" aria-label="Lọc trạng thái dịch vụ">
      {([["all", "Tất cả"], ["visible", "Đang hiển thị"], ["hidden", "Tạm ẩn"]] as const).map(([value, label]) =>
        <button type="button" key={value} aria-pressed={filters.status === value} onClick={() => onChange({ ...filters, status: value })}>{label}</button>)}
    </div>
    <label className={styles.search} htmlFor={searchId}>
      <span className={styles.srOnly}>Tìm tên dịch vụ</span>
      <Search aria-hidden="true" focusable="false" size={12} strokeWidth={2} className={styles.searchIcon} />
      <input id={searchId} type="search" placeholder="Tìm tên dịch vụ" value={filters.query} onChange={(event) => onChange({ ...filters, query: event.target.value })} />
    </label>
  </div>;
}
