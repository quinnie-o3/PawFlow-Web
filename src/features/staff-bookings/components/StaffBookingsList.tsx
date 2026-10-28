import { CalendarDays } from "lucide-react";
import { formatStaffBookingDate } from "../staffBookingLogic";
import type { StaffBooking } from "../types";
import StaffStatusBadge from "./StaffStatusBadge";
import styles from "../staffBookings.module.css";

export default function StaffBookingsList({ bookings, total, filtered, onOpen, onClear }: {
  bookings: readonly StaffBooking[];
  total: number;
  filtered: boolean;
  onOpen: (id: string) => void;
  onClear: () => void;
}) {
  return <>
    <p role="status" className={styles.resultCount}>Hiển thị {bookings.length} / {total} lịch hẹn</p>
    {bookings.length ? <div className={styles.tableFrame} role="region" aria-label="Bảng lịch hẹn Staff, cuộn ngang để xem thêm" tabIndex={0}>
      <table><caption className={styles.srOnly}>Lịch hẹn thuộc cơ sở PawCare Studio</caption>
        <thead><tr>{["Mã lịch", "Khách / thú cưng", "Dịch vụ", "Thời gian", "Trạng thái", "Thao tác"].map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead>
        <tbody>{bookings.map((booking) => <tr key={booking.id}>
          <th scope="row">{booking.id}</th><td>{booking.customerName} · {booking.petName}</td>
          <td>{booking.serviceName}</td><td>{formatStaffBookingDate(booking.scheduledAt)}</td>
          <td><StaffStatusBadge status={booking.status} /></td>
          <td><button type="button" className={styles.detailButton} aria-label={`Xem chi tiết ${booking.id}`} onClick={() => onOpen(booking.id)}>Xem chi tiết</button></td>
        </tr>)}</tbody>
      </table>
    </div> : <div className={styles.empty}><CalendarDays size={30} aria-hidden="true" />
      <h3>{filtered ? "Không có lịch phù hợp" : "Chưa có lịch hẹn"}</h3>
      <p>{filtered ? "Thử từ khóa khác hoặc xóa bộ lọc để xem danh sách." : "Lịch hẹn của cơ sở sẽ hiển thị tại đây."}</p>
      {filtered && <button type="button" className={styles.secondaryButton} onClick={onClear}>Xóa bộ lọc</button>}
    </div>}
  </>;
}
