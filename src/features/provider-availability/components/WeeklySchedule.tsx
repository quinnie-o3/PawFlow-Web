import { Circle } from "lucide-react";
import { formatRanges } from "../availabilityLogic";
import type { WeeklyDay } from "../types";
import styles from "../availability.module.css";

export default function WeeklySchedule({ days }: { days: WeeklyDay[] }) {
  return <section className={`${styles.card} ${styles.weeklyCard}`} aria-labelledby="weekly-hours-title">
    <div className={styles.sectionHeading}><h2 id="weekly-hours-title">Giờ hoạt động hằng tuần</h2><p>Các khung giờ mở sẽ hiển thị ở luồng đặt lịch của khách.</p></div>
    <ul className={styles.weeklyList}>{days.map((day) => <li key={day.weekday}>
      <span className={styles.dayName}>{day.label}</span><span className={styles.hours}>{formatRanges(day.ranges)}</span>
      <span className={`${styles.badge} ${day.ranges.length ? styles.open : styles.closed}`}>
        <Circle aria-hidden="true" focusable="false" size={7} strokeWidth={2} fill="currentColor" />
        {day.ranges.length ? "Mở" : "Đóng"}
      </span>
    </li>)}</ul>
  </section>;
}
