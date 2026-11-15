"use client";

import { vi, formatMessage } from "@/lib/locale";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Check, Info, RefreshCw } from "lucide-react";
import CatalogImage from "../../customer-catalog/components/CatalogImage";
import { useCatalogWorkspace } from "../../discovery-shell/CatalogWorkspace";
import DiscoveryHero from "../../discovery-shell/components/DiscoveryHero";
import MockNotice from "../../discovery-shell/components/MockNotice";
import DesignAsset from "../../discovery-shell/components/DesignAsset";
import { detailHref, safeReturnTo } from "../../customer-discovery/queryState";
import { formatDuration, formatPrice, formatRating, publicService } from "../../customer-catalog/catalogLogic";
import { useProviderDetail } from "../hooks/useProviderDetail";
import AvailabilityPanel from "./AvailabilityPanel";
import DetailIntro from "./DetailIntro";
import BookingExplanation from "./BookingExplanation";
import BookingPanel from "../../customer-booking/components/BookingPanel";
import shell from "../../discovery-shell/shell.module.css";
import styles from "../detail.module.css";

export default function ProviderDetailPage({ providerId }: { providerId: string }) {
  const params = useSearchParams(); const returnTo = safeReturnTo(params.get("returnTo")); const requestedServiceId = params.get("serviceId");
  const { detail, availability, retryDetail, retryAvailability } = useProviderDetail(providerId); const { persona } = useCatalogWorkspace();
  if (detail.status !== "ready") return <div className={`${shell.container} ${styles.initialState}`}><Link href={returnTo}><ArrowLeft aria-hidden="true" size={18} />{vi.discovery.detail.back}</Link>{detail.status === "loading" ? <p role="status">{vi.discovery.detail.loading}</p> : <div role="alert" className={styles.feedback}><p>{detail.error}</p><button type="button" onClick={retryDetail}><RefreshCw size={18} aria-hidden="true" />{vi.common.actions.retry}</button></div>}</div>;
  if (!detail.data) return <div className={`${shell.container} ${styles.initialState}`}><h1>{vi.discovery.detail.unavailableTitle}</h1><p>{vi.discovery.detail.unavailableDescription}</p><Link href={returnTo}><ArrowLeft aria-hidden="true" size={18} />{vi.discovery.detail.back}</Link></div>;
  const { provider, services } = detail.data; const active = services.filter(service => publicService(provider, service));
  const selected = requestedServiceId ? active.find(service => service.id === requestedServiceId) : active[0];
  return <><DiscoveryHero providerName={provider.name} /><DetailIntro />
    <div className={`${shell.container} ${styles.detailBody}`}><Link className={styles.back} href={returnTo}><ArrowLeft aria-hidden="true" size={18} />{vi.discovery.detail.backToResults}</Link><MockNotice />
      <section id="services" aria-labelledby="services-title" className={styles.services}>
        <h2 id="services-title">{vi.discovery.detail.servicesTitle}<DesignAsset src="/customer-discovery/e6e20.svg" /></h2><p className={styles.introText}>{vi.discovery.detail.servicesDescription}</p>
        <div className={styles.providerInfo}><h3>{provider.name}</h3><p>{provider.address}</p><p>{formatRating(provider)}</p><p><Check aria-hidden="true" size={16} />{formatMessage(vi.discovery.detail.hours, { hours: provider.hours ?? vi.discovery.detail.unknownHours })}</p><p>{provider.description}</p></div>
        {active.length === 0 && <p className={styles.feedback}>{vi.discovery.detail.noServices}</p>}
        <div className={styles.serviceList}>{active.map((service, index) => <article className={`${styles.serviceRow} ${selected?.id === service.id ? styles.selectedService : ""}`} key={service.id}>
          <div className={styles.serviceCopy}><div><h3>{service.name}</h3><p>{formatDuration(service.durationMinutes)} · {formatPrice(service.price)}</p><p>{service.description ?? vi.discovery.detail.noDescription}</p><Link href={`${detailHref(provider.id, service.id, returnTo)}#availability`} prefetch={false} aria-current={selected?.id === service.id ? "true" : undefined}>{vi.discovery.detail.viewSchedule}</Link></div><span className={styles.serviceNumber}>{index + 1}</span></div>
          <CatalogImage src={service.image} alt={service.name} className={styles.servicePhoto} missingClassName={styles.servicePhotoMissing} missingLabel={vi.discovery.detail.missingImage} />
          {index < 2 && <DesignAsset src="/customer-provider-detail/200d9.svg" className={styles.serviceArc} />}
        </article>)}</div>
      </section>
      {requestedServiceId && !selected && <div role="alert" className={styles.feedback}><h2>{vi.discovery.detail.invalidServiceTitle}</h2><p>{vi.discovery.detail.invalidServiceDescription}</p></div>}
      {selected && <AvailabilityPanel service={selected} resource={availability} onRetry={retryAvailability} />}
      {persona === "customer" && selected ? <BookingPanel providerId={providerId} serviceId={selected.id} availabilityStatus={availability.status} /> : <section id="booking" className={styles.bookingBoundary} aria-label={vi.discovery.detail.bookingRegion}><Info aria-hidden="true" size={24} /><div><h2>{vi.discovery.detail.bookingTitle}</h2><p>{vi.discovery.detail.guestDescription}</p><Link href="/login" prefetch={false} className={shell.primaryButton}>{vi.discovery.detail.login}</Link></div></section>}
    </div><BookingExplanation /></>;
}
