"use client";

import { vi } from "@/lib/locale";

import Link from "next/link";
import { usePathname } from "next/navigation";
import DesignAsset from "./DesignAsset";
import { Brand } from "./DiscoveryHeader";
import styles from "../shell.module.css";

export default function DiscoveryFooter() {
  const path = usePathname();
  return <footer className={styles.footer}>
    <DesignAsset src="/customer-discovery/80645.svg" className={styles.footerWave} />
    <DesignAsset src="/customer-discovery/c4ca0.svg" className={styles.footerPawRight} /><DesignAsset src="/customer-discovery/6fd9f.svg" className={styles.footerPawLeft} />
    <div className={`${styles.container} ${styles.footerInner}`}>
      <div><p>{vi.discovery.footer.description}</p><Brand /></div>
      <div className={styles.footerPhoto} aria-hidden="true"><DesignAsset src="/customer-discovery/a7c98.png" className={styles.photoBack} /><DesignAsset src="/customer-discovery/713a2.png" className={styles.photoPaper} /><DesignAsset src="/customer-discovery/945f3.svg" className={styles.photoBorder} /><DesignAsset src="/customer-discovery/c6336.png" className={styles.photoDog} /></div>
      <nav aria-label={vi.discovery.footer.services}><h2>{vi.discovery.footer.services}</h2><Link href="/discover?categoryId=bath">{vi.discovery.footer.bath}</Link><Link href="/discover?categoryId=groom">{vi.discovery.footer.groom}</Link><Link href="/discover?categoryId=boarding">{vi.discovery.footer.boarding}</Link></nav>
      <nav aria-label="PawFlow"><h2>PawFlow</h2><Link href="/discover" prefetch={false}>{vi.discovery.footer.home}</Link><Link href={path === "/discover" ? "#results" : "/discover"}>{vi.discovery.footer.discover}</Link><Link href="/login" prefetch={false}>{vi.discovery.footer.login}</Link></nav>
    </div>
  </footer>;
}
