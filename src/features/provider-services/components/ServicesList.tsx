import type { ProviderService } from "../types";
import ServiceCard from "./ServiceCard";
import styles from "../services.module.css";

export default function ServicesList({ services, total, onSelect, onCreate, onClearFilters }: {
  services: ProviderService[];
  total: number;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onClearFilters: () => void;
}) {
  return <section aria-label="Danh sách dịch vụ">
    <p className={styles.srOnly} role="status">Hiển thị {services.length} / {total} dịch vụ</p>
    {services.length ? <div className={styles.grid}>
      {services.map((service) => <ServiceCard key={service.id} service={service} onSelect={() => onSelect(service.id)} />)}
    </div> : <div className={styles.empty}>
      <h2>{total === 0 ? "Chưa có dịch vụ" : "Không tìm thấy dịch vụ"}</h2>
      <p>{total === 0 ? "Thêm dịch vụ đầu tiên để khách có thể lựa chọn khi đặt lịch." : "Thử từ khóa khác hoặc xóa bộ lọc để xem lại danh sách."}</p>
      <button type="button" className={styles.softButton} onClick={total === 0 ? onCreate : onClearFilters}>{total === 0 ? "Thêm dịch vụ đầu tiên" : "Xóa bộ lọc"}</button>
    </div>}
  </section>;
}
