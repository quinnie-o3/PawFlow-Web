"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { Bell, CalendarDays, Menu, UserRound } from "lucide-react";
import { useCatalogWorkspace } from "../CatalogWorkspace";
import DesignAsset from "./DesignAsset";
import styles from "../shell.module.css";

export function Brand() { return <Link href="/discover" className={styles.brand} aria-label="PawFlow · Khám phá cơ sở"><DesignAsset src="/customer-discovery/49717.svg" /><DesignAsset src="/customer-discovery/9eea8.svg" /></Link>; }
export default function DiscoveryHeader() {
  const { persona } = useCatalogWorkspace(); const path = usePathname(); const menu = useRef<HTMLDetailsElement>(null);
  const nav = <><Link href="/discover" prefetch={false}>Trang chủ</Link><Link href="/discover#results" prefetch={false}>Dịch vụ</Link><Link href="/discover" aria-current={path === "/discover" ? "page" : undefined}>Cơ sở</Link><span title="Đặt lịch chưa khả dụng"><button disabled>Đặt lịch</button></span><span title="Hồ sơ thú cưng chưa được kết nối"><button disabled>Thú cưng</button></span><span title="Liên hệ chưa khả dụng"><button disabled>Liên hệ</button></span></>;
  return <header className={styles.header}>
    <a className={styles.skip} href="#discovery-content">Đến nội dung chính</a>
    <div className={`${styles.container} ${styles.headerInner}`}><Brand />
      <nav className={styles.desktopNav} aria-label="Điều hướng khám phá">{nav}</nav>
      <div className={styles.headerActions}>
        <span title="Thông báo chưa được kết nối"><button disabled aria-label="Thông báo chưa khả dụng"><Bell size={20} aria-hidden="true" /></button></span>
        {persona === "guest" ? <Link className={styles.login} href="/login" prefetch={false}><CalendarDays size={20} aria-hidden="true" />Đăng ký / Đăng nhập</Link> : <span className={styles.customer} aria-label="Khách hàng mô phỏng"><UserRound size={24} aria-hidden="true" /><span>Khách hàng mẫu</span></span>}
        <span className={styles.language} title="Chưa hỗ trợ đổi ngôn ngữ"><button disabled>VI / EN</button></span>
        <details ref={menu} className={styles.mobileNav} onKeyDown={e => { if (e.key === "Escape" && menu.current?.open) { e.preventDefault(); menu.current.open = false; menu.current.querySelector("summary")?.focus(); } }} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) e.currentTarget.open = false; }}>
          <summary aria-label="Mở điều hướng"><Menu size={22} aria-hidden="true" /></summary><nav aria-label="Điều hướng thu gọn" onClick={() => { menu.current?.removeAttribute("open"); menu.current?.querySelector("summary")?.focus(); }}>{nav}</nav>
        </details>
      </div>
    </div>
  </header>;
}
