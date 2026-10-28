import Image from "next/image";
import type { ReactNode } from "react";
import StaffHeader from "./StaffHeader";
import StaffSidebar from "./StaffSidebar";
import styles from "../staffShell.module.css";

export default function StaffShell({ children }: { children: ReactNode }) {
  return <div className={styles.surface} lang="vi">
    <a href="#staff-main" className={styles.skipLink}>Đến nội dung Staff</a>
    <StaffHeader />
    <div className={styles.body}>
      <div className={styles.backdrops} aria-hidden="true">
        <Image src="/dashboard/arc-upper-left.svg" width={500} height={510} alt="" className={styles.arcLeft} />
        <Image src="/dashboard/arc-upper-right.svg" width={610} height={590} alt="" className={styles.arcRight} />
        <Image src="/dashboard/arc-lower-right.svg" width={560} height={570} alt="" className={styles.arcBottom} />
        <Image src="/dashboard/dots-left.svg" width={84} height={84} alt="" className={styles.dotsLeft} />
        <Image src="/dashboard/dots-lower-center.svg" width={168} height={36} alt="" className={styles.dotsBottom} />
      </div>
      <div className={styles.workspace}>
        <StaffSidebar />
        <main id="staff-main" tabIndex={-1} className={styles.main} aria-label="Nội dung Staff">{children}</main>
      </div>
    </div>
  </div>;
}
