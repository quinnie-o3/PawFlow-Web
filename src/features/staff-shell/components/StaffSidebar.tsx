import Image from "next/image";
import Link from "next/link";
import StaffNavigation from "./StaffNavigation";
import styles from "../staffShell.module.css";

export default function StaffSidebar() {
  return <aside className={styles.sidebar} aria-label="Khu vực nhân viên">
    <Link href="/staff/bookings" prefetch={false} className={styles.sidebarBrand} aria-label="PawFlow Staff">
      <Image src="/sidebar-logo.png" width={78} height={78} alt="" />
      <Image src="/webname.png" width={317} height={82} alt="PawFlow" />
    </Link>
    <div className={styles.profile}>
      <Image src="/staff/ngoc-mai.png" width={54} height={54} alt="" className={styles.avatar} />
      <div><p>Ngọc Mai</p><span>Lịch hẹn <strong>Nhân viên</strong></span></div>
    </div>
    <StaffNavigation label="Điều hướng Staff" />
  </aside>;
}
