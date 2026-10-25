"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { Menu } from "lucide-react";
import UserAvatar from "@/components/ui/UserAvatar";
import AdminNavigation from "./AdminNavigation";
import styles from "../adminShell.module.css";

export default function AdminHeader() {
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
    <Link href="/admin" prefetch={false} className={styles.logo} aria-label="PawFlow Admin — Tổng quan"><Image src="/logo.png" width={60} height={60} alt="" /><Image src="/name.png" width={115} height={30} alt="PawFlow" /></Link>
    <div className={styles.desktopNavigation}><AdminNavigation label="Menu Admin" compact /></div>
    <div className={styles.headerActions}><span className={styles.adminIdentity} aria-label="Khu vực Admin mô phỏng"><UserAvatar size={44} /></span>
      <span className={styles.language} title="Chưa hỗ trợ đổi ngôn ngữ">VI / EN</span>
      <details ref={menu} className={styles.mobileMenu} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false; }} onKeyDown={(event) => { if (event.key === "Escape" && menu.current?.open) { event.preventDefault(); closeMenu(); } }}>
        <summary aria-label="Mở menu Admin"><Menu size={22} aria-hidden="true" /></summary>
        <div className={styles.menuPanel}><AdminNavigation label="Menu Admin thu gọn" onNavigate={closeMenu} /></div>
      </details>
    </div>
  </header>;
}
