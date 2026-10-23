import BookingStatusBadge from "@/features/provider-bookings/components/BookingStatusBadge";
import { formatCustomerDateTime } from "../customerLogic";
import type { CustomerRecord } from "../types";
import styles from "../customers.module.css";

export default function CustomerBookingHistory({ record }: { record: CustomerRecord }) {
  return <section className={styles.detailSection} aria-labelledby="customer-history-title">
    <h3 id="customer-history-title">Lịch sử booking tại cơ sở</h3>
    <p className={styles.help}>Toàn bộ lịch sử tại PawCare Studio, gồm cả lịch sắp tới và đủ các trạng thái; không giới hạn theo kỳ báo cáo. Giờ hiển thị: Asia/Ho_Chi_Minh.</p>
    <ol className={styles.history}>
      {record.bookings.map((booking) => {
        const pet = record.pets.find((item) => item.id === booking.petId);
        return <li key={booking.id}>
          <div className={styles.historyHeading}><strong>{booking.id}</strong><BookingStatusBadge status={booking.status} /></div>
          <p className={styles.historyService}>{booking.serviceName}</p>
          <p>{pet ? `${pet.name} · ${pet.species}` : "Thông tin thú cưng chưa có"} <span className={styles.customerId}>{booking.petId}</span></p>
          <p>Giờ bắt đầu: <time dateTime={booking.scheduledAt}>{formatCustomerDateTime(booking.scheduledAt)}</time></p>
        </li>;
      })}
    </ol>
  </section>;
}
