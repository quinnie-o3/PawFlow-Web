import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { Menu } from "lucide-react";
import { useCustomerWorkspace } from "@/features/customer-workspace/CustomerWorkspaceProvider";
import CustomerAsset from "./CustomerAsset";
import CustomerSidebar from "./CustomerSidebar";
import styles from "../customerShell.module.css";

const outsideItems = ["Trang chủ", "Dịch vụ", "Cơ sở", "Đặt lịch", "Liên hệ"];

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
      <nav aria-label="Điều hướng chính" className={styles.topNav}>
        {outsideItems.slice(0, 4).map((label) => <span key={label} title="Chưa hỗ trợ"><button type="button" disabled>{label}<span className={styles.srOnly}> — Chưa hỗ trợ</span></button></span>)}
        <Link href="/account" prefetch={false} className={styles.topActive}>Tài khoản</Link>
        <span title="Chưa hỗ trợ"><button type="button" disabled>Liên hệ<span className={styles.srOnly}> — Chưa hỗ trợ</span></button></span>
      </nav>
      <div className={styles.headerActions}>
        <span title="Lịch hẹn chưa được hỗ trợ" className={styles.calendarAction}><button type="button" disabled aria-label="Lịch hẹn — Chưa hỗ trợ"><CustomerAsset name="calendar" /></button></span>
        <Link href="/account" prefetch={false} aria-label={"Thông tin tài khoản của " + profile.fullName} className={styles.avatarLink}>
          <Image src="/customer-account/header-avatar.png" alt="" aria-hidden="true" width={54} height={54} className={styles.avatar} />
        </Link>
        <span className={styles.language} title="Chưa hỗ trợ đổi ngôn ngữ"><button type="button" disabled aria-label="VI / EN — Chưa hỗ trợ đổi ngôn ngữ">VI / EN</button></span>
        <details ref={menu} className={styles.mobileMenu} onKeyDown={(event) => {
          if (event.key === "Escape" && menu.current?.open) {
            event.preventDefault();
            menu.current.open = false;
            menu.current.querySelector("summary")?.focus();
          }
        }} onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
        }}>
          <summary aria-label="Mở điều hướng tài khoản"><Menu aria-hidden="true" size={22} /></summary>
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
