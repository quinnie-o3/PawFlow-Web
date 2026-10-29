"use client";

import type { ReactNode } from "react";
import { Info } from "lucide-react";
import CustomerHeader from "./CustomerHeader";
import CustomerSidebar from "./CustomerSidebar";
import CustomerNavigation from "./CustomerNavigation";
import styles from "../customerShell.module.css";

export default function CustomerShell({ children }: { children: ReactNode }) {
  return <div className={styles.surface} lang="vi">
    <a href="#customer-content" className={styles.skipLink}>Đến nội dung chính</a>
    <CustomerHeader />
    <div className={styles.workspace}>
      <aside className={styles.desktopSidebar} aria-label="Tài khoản khách hàng"><CustomerSidebar /></aside>
      <main id="customer-content" tabIndex={-1} className={styles.main}>
        <CustomerNavigation />
        {children}
        <p className={styles.mockNotice}><Info aria-hidden="true" size={16} />
          <span>Dữ liệu mô phỏng. Thay đổi được giữ khi chuyển hai tab, khôi phục khi tải lại hoặc rời khu vực Tài khoản. Chưa lưu lên máy chủ và chưa xác thực quyền truy cập máy chủ.</span>
        </p>
      </main>
    </div>
  </div>;
}
