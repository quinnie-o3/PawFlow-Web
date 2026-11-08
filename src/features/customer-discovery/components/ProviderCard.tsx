import { vi, formatMessage } from "@/lib/locale";
import Link from "next/link";
import { MapPin, Star, Check } from "lucide-react";
import type { DiscoveryCard } from "../../customer-catalog/types";
import { formatDuration, formatPrice, formatRating } from "../../customer-catalog/catalogLogic";
import { detailHref } from "../queryState";
import CatalogImage from "../../customer-catalog/components/CatalogImage";
import styles from "../discovery.module.css";

export default function ProviderCard({ card: { provider, service }, returnTo }: { card: DiscoveryCard; returnTo: string }) {
  return <article className={styles.card} data-provider-id={provider.id} data-service-id={service.id}>
    <CatalogImage src={provider.image} alt={formatMessage(vi.discovery.card.imageLabel, { providerName: provider.name })} className={styles.cardImage} missingClassName={styles.imageMissing} missingLabel={vi.discovery.card.missingImage} />
    <h3><Link href={detailHref(provider.id, service.id, returnTo)} prefetch={false}>{provider.name}</Link></h3>
    <p className={styles.address}><MapPin aria-hidden="true" size={18} />{provider.address}</p>
    <div className={styles.serviceSummary}><span>{vi.discovery.card.matchedService}</span><strong>{service.name}</strong><p>{formatPrice(service.price)} · {formatDuration(service.durationMinutes)}</p></div>
    <p className={styles.approved}><Check size={14} aria-hidden="true" />{vi.discovery.card.approved}</p>
    <p className={styles.rating}><Star size={15} aria-hidden="true" />{formatRating(provider)}</p>
    <p className={styles.description}>{provider.description}</p>
    <Link className={styles.detailLink} href={detailHref(provider.id, service.id, returnTo)} prefetch={false} aria-label={formatMessage(vi.discovery.card.detailsLabel, { providerName: provider.name, serviceName: service.name })}>{vi.discovery.card.details}</Link>
  </article>;
}
