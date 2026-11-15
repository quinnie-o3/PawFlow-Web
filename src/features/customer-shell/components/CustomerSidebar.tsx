import { vi } from "@/lib/locale";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCustomerWorkspace } from "@/features/customer-workspace/CustomerWorkspaceProvider";
import CustomerAsset from "./CustomerAsset";
import styles from "../customerShell.module.css";

export default function CustomerSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { profile } = useCustomerWorkspace();
  const path = usePathname();
  return <div className={styles.sidebarContent}>
    <div className={styles.identity}>
      <Image src="/staff/ngoc-mai.png" alt="" aria-hidden="true" width={54} height={54} className={styles.avatar} />
      <div className={styles.identityText}>
        <p className={styles.customerName}>{profile.fullName}</p>
        <div className={styles.role}><span>{vi.customer.shell.sidebar.role}</span><span>{vi.customer.shell.sidebar.you}</span><CustomerAsset name="identity" /></div>
      </div>
    </div>
    <nav aria-label={vi.customer.shell.sidebar.label} className={styles.sidebarNav}>
      <Link href="/account" prefetch={false} className={path.startsWith("/account") ? styles.sidebarActive : undefined} aria-current={path.startsWith("/account") ? "page" : undefined} onClick={onNavigate}>
        <CustomerAsset name="account" /><span>{vi.customer.shell.sidebar.account}</span>
      </Link>
      <Link href="/bookings" prefetch={false} className={path.startsWith("/bookings") ? styles.sidebarActive : undefined} aria-current={path.startsWith("/bookings") ? "page" : undefined} onClick={onNavigate}><CustomerAsset name="bookings" /><span>{vi.customer.shell.sidebar.bookedServices}</span></Link>
      <span title={vi.customer.shell.sidebar.unavailable}><button type="button" disabled><CustomerAsset name="notifications" /><span>{vi.customer.shell.sidebar.notifications}</span><span className={styles.srOnly}> {vi.customer.shell.sidebar.unavailableSuffix}</span></button></span>
    </nav>
  </div>;
}
