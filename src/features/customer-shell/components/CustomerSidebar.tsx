import Image from "next/image";
import Link from "next/link";
import { useCustomerWorkspace } from "@/features/customer-workspace/CustomerWorkspaceProvider";
import CustomerAsset from "./CustomerAsset";
import styles from "../customerShell.module.css";

export default function CustomerSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { profile } = useCustomerWorkspace();
  return <div className={styles.sidebarContent}>
    <div className={styles.identity}>
      <Image src="/customer-account/sidebar-avatar.png" alt="" aria-hidden="true" width={54} height={54} className={styles.avatar} />
      <div className={styles.identityText}>
        <p className={styles.customerName}>{profile.fullName}</p>
        <div className={styles.role}><span>Khách hàng</span><span>Bạn</span><CustomerAsset name="identity" /></div>
      </div>
    </div>
    <nav aria-label="Điều hướng tài khoản" className={styles.sidebarNav}>
      <Link href="/account" prefetch={false} className={styles.sidebarActive} onClick={onNavigate}>
        <CustomerAsset name="account" /><span>Tài khoản</span>
      </Link>
      <span title="Chưa hỗ trợ"><button type="button" disabled><CustomerAsset name="bookings" /><span>Dịch vụ đã đặt</span><span className={styles.srOnly}> — Chưa hỗ trợ</span></button></span>
      <span title="Chưa hỗ trợ"><button type="button" disabled><CustomerAsset name="notifications" /><span>Thông báo</span><span className={styles.srOnly}> — Chưa hỗ trợ</span></button></span>
    </nav>
  </div>;
}
