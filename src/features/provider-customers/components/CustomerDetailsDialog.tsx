import DashboardDialog from "@/features/provider-dashboard/components/DashboardDialog";
import type { CustomerRecord } from "../types";
import CustomerBookingHistory from "./CustomerBookingHistory";
import CustomerGroupBadge from "./CustomerGroupBadge";
import styles from "../customers.module.css";

export default function CustomerDetailsDialog({ record, onClose }: { record: CustomerRecord; onClose: () => void }) {
  return <DashboardDialog title={`Hồ sơ khách hàng · ${record.customer.name} (${record.customer.id})`} onClose={onClose}>
    <div className={styles.details}>
      <CustomerGroupBadge group={record.group} />
      <section className={styles.detailSection} aria-labelledby="customer-contact-title">
        <h3 id="customer-contact-title">Thông tin liên hệ</h3>
        <p className={styles.help}>Thông tin chỉ đọc của khách có booking tại cơ sở này.</p>
        <dl className={styles.contactFields}>
          <div><dt>Mã khách hàng</dt><dd>{record.customer.id}</dd></div>
          <div><dt>Họ tên</dt><dd>{record.customer.name}</dd></div>
          <div><dt>Số điện thoại</dt><dd>{record.customer.phone || "Chưa có"}</dd></div>
          <div><dt>Email</dt><dd>{record.customer.email || "Chưa có"}</dd></div>
        </dl>
      </section>
      <section className={styles.detailSection} aria-labelledby="customer-pets-title">
        <h3 id="customer-pets-title">Thú cưng từng có booking tại cơ sở</h3>
        <ul className={styles.pets}>{record.pets.map((pet) => <li key={pet.id}>
          <strong>{pet.name}</strong><span className={styles.customerId}>{pet.id}</span><p>{pet.species} · {pet.breed}</p>
        </li>)}</ul>
      </section>
      <CustomerBookingHistory record={record} />
      <button className={styles.softButton} type="button" onClick={onClose}>Đóng hồ sơ</button>
    </div>
  </DashboardDialog>;
}
