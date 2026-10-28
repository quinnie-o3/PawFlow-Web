"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { Menu } from "lucide-react";
import StaffNavigation from "./StaffNavigation";
import styles from "../staffShell.module.css";

export default function StaffHeader() {
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      if (event.target instanceof Node && !menu.current?.contains(event.target)) menu.current?.removeAttribute("open");
    }
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);

  function closeMenu() {
    if (!menu.current) return;
    menu.current.open = false;
    menu.current.querySelector("summary")?.focus();
  }

  return <header className={styles.header}>
    <Link href="/staff/bookings" prefetch={false} className={styles.logo} aria-label="PawFlow Staff — Lịch hẹn">
      <Image src="/logo.png" width={60} height={60} alt="" />
      <Image src="/name.png" width={317} height={82} alt="PawFlow" />
    </Link>
    <div className={styles.desktopNavigation}><StaffNavigation label="Menu Staff" compact /></div>
    <div className={styles.headerActions}>
      <span className={styles.identity}>Ngọc Mai · Nhân viên</span>
      <Image src="/staff/ngoc-mai.png" width={44} height={44} alt="" className={styles.avatar} />
      <span className={styles.language} title="Chưa hỗ trợ đổi ngôn ngữ">VI / EN</span>
      <details ref={menu} className={styles.mobileMenu}
        onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false; }}
        onKeyDown={(event) => { if (event.key === "Escape" && menu.current?.open) { event.preventDefault(); closeMenu(); } }}>
        <summary aria-label="Mở menu Staff"><Menu size={22} aria-hidden="true" /></summary>
        <div className={styles.menuPanel}><p>Ngọc Mai · PawCare Studio</p><StaffNavigation label="Menu Staff thu gọn" onNavigate={closeMenu} /></div>
      </details>
    </div>
  </header>;
}
