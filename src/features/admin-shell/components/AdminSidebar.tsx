import Image from "next/image";
import Link from "next/link";
import UserAvatar from "@/components/ui/UserAvatar";
import AdminNavigation from "./AdminNavigation";
import styles from "../adminShell.module.css";

export default function AdminSidebar() {
  return <aside className={styles.sidebar} aria-label="Khu vực quản trị">
    <Link href="/admin" prefetch={false} className={styles.sidebarBrand} aria-label="PawFlow Admin"><Image src="/sidebar-logo.png" width={39} height={39} alt="" /><Image src="/webname.png" width={170} height={44} alt="PawFlow" /></Link>
    <div className={styles.profile}><UserAvatar size={54} /><div><p>PawFlow Admin</p><span>Admin · Quản trị viên</span></div></div>
    <AdminNavigation label="Điều hướng Admin" />
  </aside>;
}
