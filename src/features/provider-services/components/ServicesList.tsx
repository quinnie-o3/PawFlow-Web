import { vi, formatMessage } from "@/lib/locale";
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
  return <section aria-label={vi.provider.services.list.label}>
    <p className={styles.srOnly} role="status">{formatMessage(vi.provider.services.list.resultCount, { visible: services.length, total })}</p>
    {services.length ? <div className={styles.grid}>
      {services.map((service) => <ServiceCard key={service.id} service={service} onSelect={() => onSelect(service.id)} />)}
    </div> : <div className={styles.empty}>
      <h2>{total === 0 ? vi.provider.services.list.emptyTitle : vi.provider.services.list.noResultsTitle}</h2>
      <p>{total === 0 ? vi.provider.services.list.emptyDescription : vi.provider.services.list.noResultsDescription}</p>
      <button type="button" className={styles.softButton} onClick={total === 0 ? onCreate : onClearFilters}>{total === 0 ? vi.provider.services.list.createFirst : vi.provider.services.list.clearFilters}</button>
    </div>}
  </section>;
}
