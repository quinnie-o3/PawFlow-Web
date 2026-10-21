import { formatCustomerDateTime } from "../customerLogic";
import type { CustomerRecord } from "../types";
import CustomerGroupBadge from "./CustomerGroupBadge";
import styles from "../customers.module.css";

export default function CustomerProfile({ record, onOpen }: { record: CustomerRecord; onOpen: (id: string) => void }) {
  return <section className={styles.profile} aria-labelledby="customer-profile-title">
    <div className={styles.profileHeading}><h2 id="customer-profile-title">Hồ sơ khách · {record.customer.name} <span className={styles.customerId}>{record.customer.id}</span></h2>
      <button type="button" className={styles.outlineButton} onClick={() => onOpen(record.customer.id)}>Xem lịch sử booking</button></div>
    <p>Thông tin trong phạm vi PawCare Studio. Liên hệ và hồ sơ thú cưng chỉ đọc.</p>
    <dl className={styles.profileFields}>
      <div><dt>Thú cưng từng có booking tại cơ sở</dt><dd>{record.pets.map((pet) => <span className={styles.petPreview} key={pet.id}>{pet.name} · {pet.species}</span>)}</dd></div>
      <div><dt>Lịch hoàn thành · toàn bộ lịch sử</dt><dd>{record.completedCount ? `${record.completedCount} lịch` : "Chưa có"}</dd></div>
      <div><dt>Lần phục vụ gần nhất · toàn bộ lịch sử</dt><dd>{record.lastServedAt ? formatCustomerDateTime(record.lastServedAt) : "Chưa có"}</dd></div>
      <div><dt>Nhóm khách theo kỳ</dt><dd><CustomerGroupBadge group={record.group} /></dd></div>
    </dl>
  </section>;
}
