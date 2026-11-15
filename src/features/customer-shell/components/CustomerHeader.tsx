import { vi, formatMessage } from "@/lib/locale";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { Menu } from "lucide-react";
import { useCustomerWorkspace } from "@/features/customer-workspace/CustomerWorkspaceProvider";
import CustomerAsset from "./CustomerAsset";
import CustomerSidebar from "./CustomerSidebar";
import styles from "../customerShell.module.css";

const outsideItems = [vi.customer.shell.header.home, vi.customer.shell.header.services, vi.customer.shell.header.providers, vi.customer.shell.header.booking, vi.customer.shell.header.contact];

export default function CustomerHeader() {
  const { profile } = useCustomerWorkspace();
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      if (event.target instanceof Node && !menu.current?.contains(event.target)) menu.current?.removeAttribute("open");
    }
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);

  return <header className={styles.header}>
    <div className={styles.headerInner}>
      <div className={styles.brand} aria-label="PawFlow"><CustomerAsset name="logo" /><CustomerAsset name="wordmark" /></div>
      <nav aria-label={vi.customer.shell.header.navigation} className={styles.topNav}>
        {outsideItems.slice(0, 4).map((label, i) => <Link key={label} href={i === 3 ? "/bookings" : "/discover"} prefetch={false}>{label}</Link>)}
        <Link href="/account" prefetch={false} className={styles.topActive}>{vi.customer.shell.header.account}</Link>
        <span title={vi.customer.shell.header.unavailable}><button type="button" disabled>{vi.customer.shell.header.contact}<span className={styles.srOnly}> {vi.customer.shell.header.unavailableSuffix}</span></button></span>
      </nav>
      <div className={styles.headerActions}>
        <span title={vi.customer.shell.header.calendarUnavailable} className={styles.calendarAction}><button type="button" disabled aria-label={vi.customer.shell.header.calendarLabel}><CustomerAsset name="calendar" /></button></span>
        <Link href="/account" prefetch={false} aria-label={formatMessage(vi.customer.shell.header.accountLabel, { fullName: profile.fullName })} className={styles.avatarLink}>
          <Image src="/staff/ngoc-mai.png" alt="" aria-hidden="true" width={54} height={54} className={styles.avatar} />
        </Link>
        <span className={styles.language} title={vi.common.language.unavailable}><button type="button" disabled aria-label={vi.customer.shell.header.languageLabel}>VI / EN</button></span>
        <details ref={menu} className={styles.mobileMenu} onKeyDown={(event) => {
          if (event.key === "Escape" && menu.current?.open) {
            event.preventDefault();
            menu.current.open = false;
            menu.current.querySelector("summary")?.focus();
          }
        }} onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
        }}>
          <summary aria-label={vi.customer.shell.header.openMenu}><Menu aria-hidden="true" size={22} /></summary>
          <div className={styles.menuPanel}><CustomerSidebar onNavigate={() => {
            if (menu.current) {
              menu.current.open = false;
              menu.current.querySelector("summary")?.focus();
            }
          }} /></div>
        </details>
      </div>
    </div>
  </header>;
}
