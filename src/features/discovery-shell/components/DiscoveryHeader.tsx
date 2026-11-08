"use client";

import { vi } from "@/lib/locale";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { Bell, CalendarDays, Menu, UserRound } from "lucide-react";
import { useCatalogWorkspace } from "../CatalogWorkspace";
import DesignAsset from "./DesignAsset";
import styles from "../shell.module.css";

export function Brand() { return <Link href="/discover" className={styles.brand} aria-label={vi.discovery.header.brand}><DesignAsset src="/customer-discovery/49717.svg" /><DesignAsset src="/customer-discovery/9eea8.svg" /></Link>; }
export default function DiscoveryHeader() {
  const { persona } = useCatalogWorkspace(); const path = usePathname(); const menu = useRef<HTMLDetailsElement>(null);
  const nav = <><Link href="/discover" prefetch={false}>{vi.discovery.header.home}</Link><Link href="/discover#results" prefetch={false}>{vi.discovery.header.services}</Link><Link href="/discover" aria-current={path === "/discover" ? "page" : undefined}>{vi.discovery.header.providers}</Link><span title={vi.discovery.header.bookingUnavailable}><button disabled>{vi.discovery.header.booking}</button></span><span title={vi.discovery.header.petsUnavailable}><button disabled>{vi.discovery.header.pets}</button></span><span title={vi.discovery.header.contactUnavailable}><button disabled>{vi.discovery.header.contact}</button></span></>;
  return <header className={styles.header}>
    <a className={styles.skip} href="#discovery-content">{vi.discovery.header.skip}</a>
    <div className={`${styles.container} ${styles.headerInner}`}><Brand />
      <nav className={styles.desktopNav} aria-label={vi.discovery.header.navigation}>{nav}</nav>
      <div className={styles.headerActions}>
        <span title={vi.discovery.header.notificationsDisconnected}><button disabled aria-label={vi.discovery.header.notificationsUnavailable}><Bell size={20} aria-hidden="true" /></button></span>
        {persona === "guest" ? <Link className={styles.login} href="/login" prefetch={false}><CalendarDays size={20} aria-hidden="true" />{vi.discovery.header.login}</Link> : <span className={styles.customer} aria-label={vi.discovery.header.customerLabel}><UserRound size={24} aria-hidden="true" /><span>{vi.discovery.header.customer}</span></span>}
        <span className={styles.language} title={vi.common.language.unavailable}><button disabled>VI / EN</button></span>
        <details ref={menu} className={styles.mobileNav} onKeyDown={e => { if (e.key === "Escape" && menu.current?.open) { e.preventDefault(); menu.current.open = false; menu.current.querySelector("summary")?.focus(); } }} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) e.currentTarget.open = false; }}>
          <summary aria-label={vi.common.a11y.openNavigation}><Menu size={22} aria-hidden="true" /></summary><nav aria-label={vi.common.a11y.compactNavigation} onClick={() => { menu.current?.removeAttribute("open"); menu.current?.querySelector("summary")?.focus(); }}>{nav}</nav>
        </details>
      </div>
    </div>
  </header>;
}
