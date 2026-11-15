import { vi, formatMessage } from "@/lib/locale";
import type { ProviderService } from "../types";
import { ArrowRight } from "lucide-react";
import { formatDuration, formatPrice } from "../serviceLogic";
import ServiceStatusBadge from "./ServiceStatusBadge";
import styles from "../services.module.css";

export default function ServiceCard({ service, onSelect }: { service: ProviderService; onSelect: () => void }) {
  return <button type="button" className={styles.serviceCard} aria-label={formatMessage(vi.provider.services.card.editLabel, { serviceName: service.name })} onClick={onSelect}>
    <span className={styles.cardHeading}><span className={styles.serviceName}>{service.name}</span><ServiceStatusBadge active={service.active} /></span>
    <span className={styles.metadata}>{service.category} · {formatDuration(service.duration)}</span>
    <span className={styles.description}>{service.description}</span>
    <span className={styles.price}>{formatMessage(vi.provider.services.card.price, { price: formatPrice(service.price) })}</span>
    <span className={styles.cardNote}>{!service.active ? vi.provider.services.card.existingBookingsKept : service.completedCount > 0 ? formatMessage(vi.provider.services.card.completedCount, { count: service.completedCount }) : service.duration.unit === "day" ? vi.provider.services.card.capacityHint : vi.provider.services.card.availabilityHint}</span>
    <span className={styles.editLink}>{vi.common.actions.edit} <ArrowRight aria-hidden="true" focusable="false" size={13} strokeWidth={2} className={styles.inlineIcon} /></span>
  </button>;
}
