"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Check, Info, RefreshCw } from "lucide-react";
import CatalogImage from "../../customer-catalog/components/CatalogImage";
import { useCatalogWorkspace } from "../../discovery-shell/CatalogWorkspace";
import DiscoveryHero from "../../discovery-shell/components/DiscoveryHero";
import MockNotice from "../../discovery-shell/components/MockNotice";
import DesignAsset from "../../discovery-shell/components/DesignAsset";
import { detailHref, safeReturnTo } from "../../customer-discovery/queryState";
import { formatDuration, formatPrice, formatRating, mockEligibility, publicService } from "../../customer-catalog/catalogLogic";
import { useProviderDetail } from "../hooks/useProviderDetail";
import AvailabilityPanel from "./AvailabilityPanel";
import DetailIntro from "./DetailIntro";
import BookingExplanation from "./BookingExplanation";
import shell from "../../discovery-shell/shell.module.css";
import styles from "../detail.module.css";

export default function ProviderDetailPage({ providerId }: { providerId: string }) {
  const params = useSearchParams(); const returnTo = safeReturnTo(params.get("returnTo")); const requestedServiceId = params.get("serviceId");
  const { detail, availability, retryDetail, retryAvailability } = useProviderDetail(providerId); const { persona, pet } = useCatalogWorkspace();
  if (detail.status !== "ready") return <div className={`${shell.container} ${styles.initialState}`}><Link href={returnTo}><ArrowLeft aria-hidden="true" size={18} />Quay lại khám phá</Link>{detail.status === "loading" ? <p role="status">Đang tải thông tin cơ sở…</p> : <div role="alert" className={styles.feedback}><p>{detail.error}</p><button type="button" onClick={retryDetail}><RefreshCw size={18} aria-hidden="true" />Thử lại</button></div>}</div>;
  if (!detail.data) return <div className={`${shell.container} ${styles.initialState}`}><h1>Cơ sở không khả dụng</h1><p>Cơ sở không tồn tại hoặc hiện chưa được công bố. Vui lòng chọn cơ sở khác.</p><Link href={returnTo}><ArrowLeft aria-hidden="true" size={18} />Quay lại khám phá</Link></div>;
  const { provider, services } = detail.data; const active = services.filter(service => publicService(provider, service));
  const selected = requestedServiceId ? active.find(service => service.id === requestedServiceId) : active[0];
  return <><DiscoveryHero providerName={provider.name} /><DetailIntro />
    <div className={`${shell.container} ${styles.detailBody}`}><Link className={styles.back} href={returnTo}><ArrowLeft aria-hidden="true" size={18} />Quay lại kết quả khám phá</Link><MockNotice />
      <section id="services" aria-labelledby="services-title" className={styles.services}>
        <h2 id="services-title">Dịch vụ tại cơ sở <DesignAsset src="/customer-discovery/e6e20.svg" /></h2><p className={styles.introText}>Giá và thời lượng được hiển thị theo từng dịch vụ. Cơ sở xác nhận khả năng tiếp nhận trước khi thực hiện.</p>
        <div className={styles.providerInfo}><h3>{provider.name}</h3><p>{provider.address}</p><p>{formatRating(provider)}</p><p><Check aria-hidden="true" size={16} />Đã được duyệt · Giờ làm việc: {provider.hours ?? "chưa có dữ liệu"} · Liên hệ qua PawFlow</p><p>{provider.description}</p></div>
        {active.length === 0 && <p className={styles.feedback}>Chưa có dịch vụ đang hoạt động để hiển thị.</p>}
        <div className={styles.serviceList}>{active.map((service, index) => <article className={`${styles.serviceRow} ${selected?.id === service.id ? styles.selectedService : ""}`} key={service.id}>
          <div className={styles.serviceCopy}><div><h3>{service.name}</h3><p>{formatDuration(service.durationMinutes)} · {formatPrice(service.price)}</p><p>{service.description ?? "Chưa có mô tả dịch vụ."}</p><Link href={`${detailHref(provider.id, service.id, returnTo)}#availability`} prefetch={false} aria-current={selected?.id === service.id ? "true" : undefined}>Xem lịch dịch vụ này</Link></div><span className={styles.serviceNumber}>{index + 1}</span></div>
          <CatalogImage src={service.image} alt={service.name} className={styles.servicePhoto} missingClassName={styles.servicePhotoMissing} missingLabel="Chưa có hình ảnh dịch vụ" />
          {index < 2 && <DesignAsset src="/customer-provider-detail/200d9.svg" className={styles.serviceArc} />}
        </article>)}</div>
      </section>
      {requestedServiceId && !selected && <div role="alert" className={styles.feedback}><h2>Dịch vụ đã chọn không khả dụng</h2><p>Dịch vụ không tồn tại, đã ngừng hoạt động hoặc không thuộc cơ sở này. Chọn một dịch vụ đang hiển thị để xem lịch.</p></div>}
      {selected && <AvailabilityPanel service={selected} resource={availability} onRetry={retryAvailability} />}
      <section className={styles.bookingBoundary} aria-label="Thông tin trước khi đặt lịch"><Info aria-hidden="true" size={24} /><div><h2>Trước khi đặt lịch</h2><p>{persona === "customer" ? mockEligibility(provider, pet) : "Đăng nhập để sử dụng hồ sơ thú cưng của bạn. Nội dung cơ sở và dịch vụ vẫn xem được khi chưa đăng nhập."}</p><p>Điều kiện tiếp nhận và lịch ở đây chỉ là mô phỏng, chưa xác thực điều kiện đặt với máy chủ.</p><div className={styles.bookingActions}>{persona === "guest" && <Link href="/login" prefetch={false} className={shell.primaryButton}>Đăng nhập</Link>}<button disabled type="button" aria-describedby="booking-unavailable">Đặt lịch</button><p id="booking-unavailable">Chức năng đặt lịch chưa khả dụng. Hiện bạn có thể xem thông tin và lịch mẫu.</p></div></div></section>
    </div><BookingExplanation /></>;
}
