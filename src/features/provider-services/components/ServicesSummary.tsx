import type { ProviderService } from "../types";
import styles from "../services.module.css";

export default function ServicesSummary({ services }: { services: ProviderService[] }) {
  const visible = services.filter((service) => service.active).length;
  const popular = services.reduce<ProviderService | undefined>((best, service) => !best || service.completedCount > best.completedCount ? service : best, undefined);
  return <div className={styles.summaries} aria-label="Tổng hợp dịch vụ">
    <article><h2>Đang hiển thị</h2><p className={styles.summaryCount}>{String(visible).padStart(2, "0")}</p><p>Khách có thể đặt lịch</p></article>
    <article><h2>Tạm ẩn</h2><p className={styles.summaryCount}>{String(services.length - visible).padStart(2, "0")}</p><p>Không hiện ở luồng đặt lịch</p></article>
    <article><h2>Dịch vụ phổ biến</h2><p className={styles.summaryCount}>{popular?.completedCount || 0}</p><p>{popular && popular.completedCount > 0 ? `Lịch hoàn thành · ${popular.name}` : "Chưa có lịch hoàn thành"}</p></article>
  </div>;
}
