"use client";

import Link from "next/link";
import { Cat, Dog, Star } from "lucide-react";
import { useCatalogWorkspace } from "../CatalogWorkspace";
import DesignAsset from "./DesignAsset";
import styles from "../shell.module.css";

export default function DiscoveryHero({ providerName }: { providerName?: string }) {
  const { persona } = useCatalogWorkspace(); const detail = providerName !== undefined;
  return <section className={`${styles.hero} ${detail ? styles.detailHero : ""}`} aria-labelledby="catalog-hero-title">
    <DesignAsset src={detail ? "/customer-provider-detail/0e0e2.svg" : "/customer-discovery/2674f.svg"} className={styles.heroBackground} />
    {detail && <><DesignAsset src="/customer-provider-detail/4528f.svg" className={styles.heroCircle} /><DesignAsset src="/customer-provider-detail/82079.svg" className={styles.heroCircleInner} /></>}
    <div className={`${styles.container} ${styles.heroInner}`}>
      <div className={styles.heroCopy}><h1 id="catalog-hero-title">{detail ? providerName : "Khám phá cơ sở"}<span>{detail ? "Chăm sóc thú cưng" : "và dịch vụ"}</span></h1><DesignAsset src="/customer-discovery/80c6c.svg" className={styles.heroPaw} />
        <p>{detail ? "Xem dịch vụ, giá và lịch còn chỗ của cơ sở trước khi đặt lịch." : "Tìm nơi chăm sóc phù hợp, xem dịch vụ và cơ sở trước khi đặt lịch."}</p>
        {detail && persona === "guest" ? <Link className={styles.primaryButton} href="/login" prefetch={false}>Đăng nhập để đặt lịch</Link> : <a className={styles.primaryButton} href={detail ? "#availability" : "#results"}>{detail ? "Xem lịch còn chỗ" : persona === "customer" ? "Chọn cơ sở để đặt lịch" : "Xem dịch vụ"}</a>}
      </div>
      <div className={styles.heroAnimals}><DesignAsset src={detail ? "/customer-provider-detail/40476.png" : "/customer-discovery/62a5e.png"} priority />
        <DesignAsset src={detail ? "/customer-provider-detail/326a8.svg" : "/customer-discovery/2751b.svg"} className={styles.heroShadow} />
        <span className={styles.catBadge}><Cat size={23} aria-hidden="true" /></span><span className={styles.dogBadge}><Dog size={18} aria-hidden="true" /></span>
        {detail && <div className={styles.partner}><div>{providerName}<span>Đã được duyệt <Star size={12} fill="currentColor" aria-hidden="true" /></span></div><DesignAsset src="/customer-provider-detail/cdcc4.png" /></div>}
      </div>
    </div>
  </section>;
}
