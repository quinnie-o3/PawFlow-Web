import { formatStaffBookingDate, staffStatusLabels } from "../staffBookingLogic";
import type { StaffAuditEntry } from "../types";
import styles from "../staffBookings.module.css";

export default function StaffBookingAudit({ logs }: { logs: readonly StaffAuditEntry[] }) {
  return <section className={styles.listCard} aria-labelledby="staff-audit-title">
    <div className={styles.listHeading}><h2 id="staff-audit-title">Nhật ký trong phiên ({logs.length})</h2>
      <p>Ghi nhận thao tác thành công và thất bại của bản mô phỏng; mất khi rời trang, tải lại hoặc khôi phục mẫu.</p></div>
    {logs.length === 0 ? <p className={styles.listNote}>Chưa có thao tác trong phiên.</p> :
      <ol className={styles.auditList}>{[...logs].reverse().map((log) => <li key={log.id}>
        <h3>#{log.id} · {log.bookingId} · {log.outcome === "success" ? "Thành công" : "Thất bại"}</h3>
        <p>{log.actor} · {log.occurredAt ? formatStaffBookingDate(log.occurredAt) : "Chưa xác định thời gian"} (UTC+7)</p>
        <p>Trước: {log.previousStatus ? staffStatusLabels[log.previousStatus] : "Không có dữ liệu trong phạm vi"} → Sau: {log.nextStatus ? staffStatusLabels[log.nextStatus] : "Không có dữ liệu trong phạm vi"}.</p>
        <p>Yêu cầu: {staffStatusLabels[log.requestedStatus]}. Xác nhận kết quả thực tế: {log.confirmedActualOutcome ? "Có" : "Không"}.</p>
        <p className={styles.notes}>Lý do / ghi nhận: {log.reason || "Không có"}</p>
        <p className={log.outcome === "error" ? styles.auditError : styles.auditSuccess}>{log.message}</p>
      </li>)}</ol>}
  </section>;
}
