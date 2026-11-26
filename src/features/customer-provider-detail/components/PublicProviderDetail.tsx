"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { vi } from "@/lib/locale";
import { formatDuration, formatPrice, formatDateOnly } from "../../customer-catalog/catalogLogic";
import CatalogImage from "../../customer-catalog/components/CatalogImage";
import DiscoveryHero from "../../discovery-shell/components/DiscoveryHero";
import { usePublicCatalog } from "../../public-catalog/PublicCatalogProvider";
import { usePublicResource } from "../../public-catalog/usePublicResource";
import { Pagination, PublicError, SourceNotice } from "../../public-catalog/Feedback";
import { publicDetailHref, publicReturnTo, validId } from "../../public-catalog/query";
import type { Page, Service, Slot } from "../../public-catalog/api";
import LiveBookingPanel from "../../customer-booking/components/LiveBookingPanel";
import shell from "../../discovery-shell/shell.module.css";
import styles from "../detail.module.css";

function PublicAvailability({
  service,
  state,
  onPage,
  onRetry,
}: {
  service: Service;
  state: ReturnType<typeof usePublicResource<Page<Slot>>>["state"];
  onPage: (page: number) => void;
  onRetry: () => void;
}) {
  const t = vi.publicCatalog;
  return <section id="availability" className={styles.availability} aria-labelledby="availability-title" aria-busy={state.status === "loading"}>
    <h2 id="availability-title">{service.name} · {vi.booking.live.availabilityTitle}</h2><p>{t.availabilityNote}</p>
    {state.status === "loading" && <p role="status">{vi.booking.live.availabilityLoading}</p>}
    {state.status === "error" && <PublicError {...state} onRetry={onRetry} />}
    {state.status === "ready" && <>{!state.data.items.length && <p role="status">{t.noSlots}</p>}<ul className={styles.slots}>{state.data.items.map(slot => <li key={slot.id} className={styles.slot}><strong>{formatDateOnly(slot.slotDate)}</strong><span>{slot.startTime.slice(0, 5)}–{slot.endTime.slice(0, 5)}</span><span>{slot.capacity - slot.bookedCount} {t.places}</span></li>)}</ul><Pagination meta={state.data.meta} onPage={onPage} /></>}
  </section>;
}
export default function PublicProviderDetail({ providerId }: { providerId: string }) {
  const params = useSearchParams(), requested = String(params.get("serviceId") ?? ""), returnTo = publicReturnTo(params.get("returnTo")), { api } = usePublicCatalog(), t = vi.publicCatalog;
  const [page, setPage] = useState(1);
  const [slotPagination, setSlotPagination] = useState<{ serviceId: string; page: number }>({ serviceId: "", page: 1 });
  const [availabilityRevision, setAvailabilityRevision] = useState(0);
  const valid = validId(providerId) && (!params.has("serviceId") || validId(requested)) && ["catalog", "serviceId", "returnTo"].every(key => params.getAll(key).length <= 1) && (!params.has("catalog") || params.get("catalog") === "live");
  const providerLoader = useCallback((signal: AbortSignal) => api.provider(providerId, signal), [api, providerId]);
  const provider = usePublicResource("provider", valid ? providerId : null, providerLoader);
  const servicesLoader = useCallback((signal: AbortSignal) => api.services(providerId, page, signal), [api, providerId, page]);
  const services = usePublicResource("services", valid && provider.state.status === "ready" ? new URLSearchParams({ providerId, sort: "newest", page: String(page), limit: "20" }).toString() : null, servicesLoader);
  const serviceLoader = useCallback((signal: AbortSignal) => api.service(providerId, requested, signal), [api, providerId, requested]);
  const service = usePublicResource("service", valid && requested && provider.state.status === "ready" ? `${providerId}/${requested}` : null, serviceLoader);
  const selected = requested
    ? service.state.status === "ready" && service.state.data.provider.id === providerId
      ? service.state.data
      : null
    : services.state.status === "ready"
      ? (services.state.data.items[0] ?? null)
      : null;
  const selectedProviderId = selected?.provider.id ?? null;
  const selectedServiceId = selected?.id ?? null;
  const slotPage = selectedServiceId && slotPagination.serviceId === selectedServiceId ? slotPagination.page : 1;
  const setSlotPage = useCallback((nextPage: number) => {
    if (!selectedServiceId) return;
    setSlotPagination({ serviceId: selectedServiceId, page: nextPage });
  }, [selectedServiceId]);
  const availabilityWire =
    valid &&
    provider.state.status === "ready" &&
    selectedProviderId === providerId &&
    selectedServiceId
      ? new URLSearchParams({
          providerId: selectedProviderId,
          serviceId: selectedServiceId,
          page: String(slotPage),
          limit: "20",
        }).toString()
      : null;
  const availabilityLoader = useCallback(
    (signal: AbortSignal) => {
      if (!selectedProviderId || !selectedServiceId) {
        return Promise.reject(new DOMException("Cancelled", "AbortError"));
      }
      return api.slots(selectedProviderId, selectedServiceId, slotPage, signal);
    },
    [api, selectedProviderId, selectedServiceId, slotPage],
  );
  const availability = usePublicResource("availability", availabilityWire, availabilityLoader, 0);
  const refreshAvailability = () => {
    setAvailabilityRevision(n => n + 1);
    availability.retry();
  };
  const activeServices = services.state.status === "ready" ? services.state.data.items : [];
  const shownServices = selected && !activeServices.some(s => s.id === selected.id) ? [selected, ...activeServices] : activeServices;
  const serviceRow = (s: Service) => <article className={`${styles.serviceRow} ${s.id === selected?.id ? styles.selectedService : ""}`} key={s.id} data-service-id={s.id}>
    <div className={styles.serviceCopy}><div><h3>{s.name}</h3><p>{formatDuration(s.durationMinutes)} · {formatPrice(s.price)}</p><p>{s.description ?? t.noDescription}</p><Link href={publicDetailHref(providerId, returnTo, s.id) + "#availability"} prefetch={false} aria-current={selected?.id === s.id ? "true" : undefined}>{vi.discovery.detail.viewSchedule}</Link></div></div>
    <CatalogImage src={null} alt={s.name} className={styles.servicePhoto} missingClassName={styles.servicePhotoMissing} missingLabel={vi.discovery.detail.missingImage} />
  </article>;
  return <>
    {provider.state.status === "ready" && <DiscoveryHero providerName={provider.state.data.businessName} />}
    <div className={`${shell.container} ${styles.detailBody} ${provider.state.status !== "ready" ? styles.initialState : ""}`}><Link className={styles.back} href={returnTo}>{vi.discovery.detail.backToResults}</Link><SourceNotice />
      {!valid && <p role="alert">{t.invalidDetail}</p>}
      {provider.state.status === "loading" && <p role="status">{vi.discovery.detail.loading}</p>}
      {provider.state.status === "error" && <PublicError {...provider.state} onRetry={provider.retry} />}
      {provider.state.status === "ready" && <>
        <section id="services" className={styles.services} aria-labelledby="services-title"><h2 id="services-title">{vi.discovery.detail.servicesTitle}</h2>
          <div className={styles.providerInfo}><h3>{provider.state.data.businessName}</h3><p>{provider.state.data.address}</p><p>{provider.state.data.description ?? t.noDescription}</p><p>{provider.state.data.ratingCount ? `${provider.state.data.ratingAvg} / 5 · ${provider.state.data.ratingCount} ${t.reviews}` : vi.discovery.catalog.noReviews}</p><p>{vi.discovery.detail.unknownHours}</p></div>
          {services.state.status === "loading" && <p role="status">{t.servicesLoading}</p>}
          {services.state.status === "error" && <PublicError {...services.state} onRetry={services.retry} />}
          {service.state.status === "loading" && <p role="status">{t.selectedLoading}</p>}
          {service.state.status === "error" && <PublicError {...service.state} onRetry={service.retry} />}
          {services.state.status === "ready" && !services.state.data.items.length && <p>{vi.discovery.detail.noServices}</p>}
          <div className={styles.serviceList}>{shownServices.map(serviceRow)}</div>
          {services.state.status === "ready" && <Pagination meta={services.state.data.meta} onPage={setPage} />}
        </section>
        {selected && <PublicAvailability service={selected} state={availability.state} onPage={setSlotPage} onRetry={refreshAvailability} />}
        <LiveBookingPanel
          provider={provider.state.data}
          selectedService={selected}
          serviceLoading={services.state.status === "loading" || service.state.status === "loading"}
          availabilityState={availability.state}
          availabilityRevision={availabilityRevision}
          onRefreshAvailability={refreshAvailability}
        />
      </>}
    </div>
  </>;
}
