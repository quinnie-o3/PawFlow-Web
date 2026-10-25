import Image from "next/image";
import type { ReactNode } from "react";
import AdminHeader from "./AdminHeader";
import AdminMain from "./AdminMain";
import AdminSidebar from "./AdminSidebar";
import styles from "../adminShell.module.css";

export default function AdminShell({ children }: { children: ReactNode }) {
  return <div className={styles.surface} lang="vi">
    <a href="#admin-main" className={styles.skipLink}>Đến nội dung Admin</a>
    <AdminHeader />
    <div className={styles.body}>
      <div className={styles.backdrops} aria-hidden="true">
        <Image src="/dashboard/arc-upper-left.svg" width={500} height={510} alt="" className={styles.arcLeft} />
        <Image src="/dashboard/arc-upper-right.svg" width={610} height={590} alt="" className={styles.arcRight} />
        <Image src="/dashboard/arc-lower-right.svg" width={560} height={570} alt="" className={styles.arcBottom} />
        <Image src="/dashboard/dots-left.svg" width={84} height={84} alt="" className={styles.dotsLeft} />
        <Image src="/dashboard/dots-lower-center.svg" width={168} height={36} alt="" className={styles.dotsBottom} />
      </div>
      <div className={styles.workspace}><AdminSidebar /><AdminMain>{children}</AdminMain></div>
    </div>
  </div>;
}
