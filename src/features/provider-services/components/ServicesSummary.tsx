import { vi, formatMessage } from "@/lib/locale";
import type { ProviderService } from "../types";
import styles from "../services.module.css";

export default function ServicesSummary({ services }: { services: ProviderService[] }) {
  const visible = services.filter((service) => service.active).length;
  const popular = services.reduce<ProviderService | undefined>((best, service) => !best || service.completedCount > best.completedCount ? service : best, undefined);
  return <div className={styles.summaries} aria-label={vi.provider.services.summary.label}>
    <article><h2>{vi.provider.services.status.displayed}</h2><p className={styles.summaryCount}>{String(visible).padStart(2, "0")}</p><p>{vi.provider.services.summary.bookable}</p></article>
    <article><h2>{vi.provider.services.status.hidden}</h2><p className={styles.summaryCount}>{String(services.length - visible).padStart(2, "0")}</p><p>{vi.provider.services.summary.hiddenHint}</p></article>
    <article><h2>{vi.provider.services.summary.popularTitle}</h2><p className={styles.summaryCount}>{popular?.completedCount || 0}</p><p>{popular && popular.completedCount > 0 ? formatMessage(vi.provider.services.summary.popularService, { serviceName: popular.name }) : vi.provider.services.summary.noCompletedBookings}</p></article>
  </div>;
}
