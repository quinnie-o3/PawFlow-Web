import { vi } from "@/lib/locale";
import { Circle } from "lucide-react";
import { formatRanges } from "../availabilityLogic";
import type { WeeklyDay } from "../types";
import styles from "../availability.module.css";

export default function WeeklySchedule({ days }: { days: WeeklyDay[] }) {
  return <section className={`${styles.card} ${styles.weeklyCard}`} aria-labelledby="weekly-hours-title">
    <div className={styles.sectionHeading}><h2 id="weekly-hours-title">{vi.provider.availability.weekly.title}</h2><p>{vi.provider.availability.weekly.description}</p></div>
    <ul className={styles.weeklyList}>{days.map((day) => <li key={day.weekday}>
      <span className={styles.dayName}>{day.label}</span><span className={styles.hours}>{formatRanges(day.ranges)}</span>
      <span className={`${styles.badge} ${day.ranges.length ? styles.open : styles.closed}`}>
        <Circle aria-hidden="true" focusable="false" size={7} strokeWidth={2} fill="currentColor" />
        {day.ranges.length ? vi.provider.availability.weekly.open : vi.common.actions.close}
      </span>
    </li>)}</ul>
  </section>;
}
