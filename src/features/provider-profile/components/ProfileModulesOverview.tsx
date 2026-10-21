import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { mockWeeklyHours } from "@/features/provider-availability/data/providerAvailabilityMock";
import { formatRanges } from "@/features/provider-availability/availabilityLogic";
import { createServicesMock } from "@/features/provider-services/data/providerServicesMock";
import styles from "../profile.module.css";

// Read-only summaries of the existing modules' initial fixtures, not shared live state.
const services = createServicesMock().services.filter((service) => service.active);
const hourGroups = mockWeeklyHours.reduce<{ label: string; hours: string; lastDay: string }[]>((groups, day) => {
  const hours = formatRanges(day.ranges);
  const previous = groups.at(-1);
  if (previous?.hours === hours) previous.lastDay = day.label;
  else groups.push({ label: day.label, hours, lastDay: day.label });
  return groups;
}, []);

export default function ProfileModulesOverview() {
  return <>
    <div className={styles.modules}>
      <section className={`${styles.card} ${styles.moduleCard}`} aria-labelledby="profile-services-title">
        <div className={styles.sectionHeading}>
          <h2 id="profile-services-title">Dịch vụ hiển thị</h2>
          <Link className={styles.outlineButton} href="/dashboard/services" prefetch={false}>Xem dịch vụ<ArrowUpRight aria-hidden="true" size={14} /></Link>
        </div>
        <ul className={styles.services}>{services.map((service) => <li key={service.id}>{service.name}</li>)}</ul>
      </section>
      <section className={`${styles.card} ${styles.moduleCard}`} aria-labelledby="profile-hours-title">
        <div className={styles.sectionHeading}>
          <h2 id="profile-hours-title">Giờ hoạt động</h2>
          <Link className={styles.outlineButton} href="/dashboard/availability" prefetch={false}>Xem lịch<ArrowUpRight aria-hidden="true" size={14} /></Link>
        </div>
        <dl className={styles.hours}>{hourGroups.map((group) => <div key={group.label}>
          <dt>{group.label === group.lastDay ? group.label : `${group.label} – ${group.lastDay}`}</dt><dd>{group.hours}</dd>
        </div>)}</dl>
      </section>
    </div>
    <p className={styles.help}>Tóm tắt từ mẫu ban đầu của Dịch vụ và Lịch khả dụng; chưa đồng bộ thay đổi giữa các màn. Quản lý dịch vụ và giờ tuần tại module tương ứng.</p>
  </>;
}
