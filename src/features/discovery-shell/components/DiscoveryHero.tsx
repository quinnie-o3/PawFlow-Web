"use client";

import { vi } from "@/lib/locale";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "../../session/SessionProvider";
import { Cat, Dog, Star } from "lucide-react";
import { useCatalogWorkspace } from "../CatalogWorkspace";
import DesignAsset from "./DesignAsset";
import styles from "../shell.module.css";

export default function DiscoveryHero({ providerName }: { providerName?: string }) {
  const workspace = useCatalogWorkspace(), session = useSession(), params = useSearchParams();
  const demo = params.getAll("catalog").length === 1 && params.get("catalog") === "demo";
  const persona = demo ? workspace.persona : session.session?.user?.role === "CUSTOMER" ? "customer" : "guest"; const detail = providerName !== undefined;
  return <section className={`${styles.hero} ${detail ? styles.detailHero : ""}`} aria-labelledby="catalog-hero-title">
    <DesignAsset src={detail ? "/customer-provider-detail/0e0e2.svg" : "/customer-discovery/2674f.svg"} className={styles.heroBackground} />
    {detail && <><DesignAsset src="/customer-provider-detail/4528f.svg" className={styles.heroCircle} /><DesignAsset src="/customer-provider-detail/82079.svg" className={styles.heroCircleInner} /></>}
    <div className={`${styles.container} ${styles.heroInner}`}>
      <div className={styles.heroCopy}><h1 id="catalog-hero-title">{detail ? providerName : vi.discovery.hero.title}<span>{detail ? vi.discovery.hero.detailSubtitle : vi.discovery.hero.searchSubtitle}</span></h1><DesignAsset src="/customer-discovery/80c6c.svg" className={styles.heroPaw} />
        <p>{detail ? vi.discovery.hero.detailDescription : vi.discovery.hero.searchDescription}</p>
        {detail && demo && persona === "guest" ? <Link className={styles.primaryButton} href="/login" prefetch={false}>{vi.discovery.hero.login}</Link> : <a className={styles.primaryButton} href={detail ? demo ? "#availability" : "#services" : "#results"}>{detail ? demo ? vi.discovery.hero.availability : vi.discovery.hero.services : persona === "customer" ? vi.discovery.hero.chooseProvider : vi.discovery.hero.services}</a>}
      </div>
      <div className={styles.heroAnimals}><DesignAsset src={detail ? "/customer-provider-detail/40476.png" : "/customer-discovery/62a5e.png"} priority />
        <DesignAsset src={detail ? "/customer-provider-detail/326a8.svg" : "/customer-discovery/2751b.svg"} className={styles.heroShadow} />
        <span className={styles.catBadge}><Cat size={23} aria-hidden="true" /></span><span className={styles.dogBadge}><Dog size={18} aria-hidden="true" /></span>
        {detail && demo && <div className={styles.partner}><div>{providerName}<span>{vi.discovery.hero.approved}<Star size={12} fill="currentColor" aria-hidden="true" /></span></div><DesignAsset src="/customer-provider-detail/cdcc4.png" /></div>}
      </div>
    </div>
  </section>;
}
