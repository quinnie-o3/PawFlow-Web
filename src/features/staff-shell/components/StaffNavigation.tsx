import Link from "next/link";
import { CalendarDays } from "lucide-react";
import styles from "../staffShell.module.css";

export default function StaffNavigation({ label, compact = false, onNavigate }: {
  label: string;
  compact?: boolean;
  onNavigate?: () => void;
}) {
  return <nav aria-label={label} className={compact ? styles.topNavigation : styles.navigation}>
    <Link href="/staff/bookings" prefetch={false} aria-current="page" onClick={onNavigate}>
      {!compact && <CalendarDays size={24} aria-hidden="true" />}<span>Lịch hẹn</span>
    </Link>
  </nav>;
}
