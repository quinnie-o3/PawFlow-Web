import { useEffect, useRef, useState } from "react";
import { mockStaffContext } from "../data/staffBookingsMock";
import { formatStaffBookingDate, formatStaffPrice, staffActionLabels, staffBookingActions, staffBookingEnd, staffStatusLabels } from "../staffBookingLogic";
import type { StaffActionResult, StaffBooking, StaffBookingCommand, StaffBookingStatus, StaffBookingTarget } from "../types";
import StaffDialog from "./StaffDialog";
import StaffStatusBadge from "./StaffStatusBadge";
import styles from "../staffBookings.module.css";

type Action = { target: StaffBookingTarget; expectedStatus: StaffBookingStatus };

function ActionConfirmation({ booking, action, now, result, processing, onSubmit, onBack }: {
  booking: StaffBooking;
  action: Action;
  now: number;
  result: StaffActionResult | null;
  processing: boolean;
  onSubmit: (command: StaffBookingCommand) => void;
  onBack: () => void;
}) {
  const [reason, setReason] = useState("");
  const [attested, setAttested] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);
  const feedback = useRef<HTMLParagraphElement>(null);
  useEffect(() => { title.current?.focus(); }, []);
  useEffect(() => { if (result) feedback.current?.focus(); }, [result]);
  const requiresReason = action.target === "rejected" || action.target === "noShow";
  const requiresOutcome = action.target === "completed" || action.target === "noShow";
  const failed = result?.outcome === "error";
  const succeeded = result?.outcome === "success";

  return <form className={styles.confirmation} noValidate aria-busy={processing} onSubmit={(event) => {
    event.preventDefault();
    if (!succeeded && !processing) onSubmit({ bookingId: booking.id, expectedStatus: action.expectedStatus, targetStatus: action.target, reason, confirmedActualOutcome: attested });
  }}>
    <h3 ref={title} tabIndex={-1}>Xác nhận thao tác: {staffActionLabels[action.target]}</h3>
    <p>#{booking.id} · {staffStatusLabels[action.expectedStatus]} → {staffStatusLabels[action.target]}</p>
    <p>Thời gian mô phỏng: {formatStaffBookingDate(new Date(now).toISOString())} (UTC+7).</p>
    {action.target === "completed" && <p>Chỉ xác nhận khi dịch vụ đã thực hiện xong. Không yêu cầu đã thanh toán.</p>}
    {requiresReason && <label className={styles.field}>Lý do / ghi nhận (bắt buộc)
      <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} required disabled={succeeded || processing}
        aria-invalid={failed && !reason.trim() ? true : undefined} aria-describedby={failed ? "staff-operation-error" : undefined} />
    </label>}
    {requiresOutcome && <label className={styles.check}>
      <input type="checkbox" checked={attested} onChange={(event) => setAttested(event.target.checked)} required disabled={succeeded || processing}
        aria-invalid={failed && !attested ? true : undefined} aria-describedby={failed ? "staff-operation-error" : undefined} />
      {action.target === "completed" ? "Tôi xác nhận đã thực hiện xong dịch vụ." : "Tôi xác nhận khách / pet chưa đến."}
    </label>}
    {failed && <p ref={feedback} tabIndex={-1} id="staff-operation-error" role="alert" className={styles.operationError}>{result.message}</p>}
    {succeeded && <p ref={feedback} tabIndex={-1} role="status" className={styles.operationSuccess}>{result.message} Thay đổi chỉ lưu trong phiên mô phỏng.</p>}
    {processing && <p role="status">Đang xử lý thao tác mô phỏng…</p>}
    <div className={styles.formButtons}>
      <button type="button" className={styles.secondaryButton} disabled={processing} onClick={onBack}>{succeeded ? "Về chi tiết" : "Quay lại"}</button>
      {!succeeded && <button type="submit" className={styles.primaryButton} disabled={processing}>{processing ? "Đang xử lý…" : "Xác nhận thao tác"}</button>}
    </div>
  </form>;
}

export default function StaffBookingDetails({ booking, now, result, processing, onStartAction, onSubmit, onClose }: {
  booking: StaffBooking;
  now: number;
  result: StaffActionResult | null;
  processing: boolean;
  onStartAction: () => void;
  onSubmit: (command: StaffBookingCommand) => void;
  onClose: () => void;
}) {
  const [action, setAction] = useState<Action | null>(null);
  const detailsTitle = useRef<HTMLHeadingElement>(null);
  const returning = useRef(false);
  useEffect(() => {
    if (!action && returning.current) {
      detailsTitle.current?.focus();
      returning.current = false;
    }
  }, [action]);
  const actions = staffBookingActions(booking, mockStaffContext, now);
  const end = staffBookingEnd(booking);
  return <StaffDialog title={`Chi tiết lịch #${booking.id}`} busy={processing} onClose={onClose}>
    <h3 ref={detailsTitle} tabIndex={-1} className={styles.detailHeading}>Thông tin lịch hẹn</h3>
    <StaffStatusBadge status={booking.status} />
    <dl className={styles.facts}>
      <div><dt>Khách hàng</dt><dd>{booking.customerName}</dd></div>
      <div><dt>Liên hệ cho lịch hẹn</dt><dd>{booking.contactPhone || "Chưa có số điện thoại trong booking"}</dd></div>
      <div><dt>Thú cưng trong lịch</dt><dd>{booking.petName} · {booking.petSpecies}{booking.petBreed && ` · ${booking.petBreed}`}</dd></div>
      {booking.petAge && <div><dt>Tuổi</dt><dd>{booking.petAge}</dd></div>}
      {booking.petWeightKg != null && <div><dt>Cân nặng</dt><dd>{booking.petWeightKg} kg</dd></div>}
      {booking.petAllergies && <div><dt>Dị ứng trong booking</dt><dd className={styles.notes}>{booking.petAllergies}</dd></div>}
      <div><dt>Dịch vụ</dt><dd>{booking.serviceName}<small>Thời lượng snapshot: {booking.durationMinutesSnapshot != null && booking.durationMinutesSnapshot > 0 ? `${booking.durationMinutesSnapshot} phút` : "Chưa có dữ liệu hợp lệ"}</small></dd></div>
      <div><dt>Giá snapshot (chỉ đọc)</dt><dd>{formatStaffPrice(booking.priceSnapshot)}</dd></div>
      <div><dt>Thời gian hẹn</dt><dd>{formatStaffBookingDate(booking.scheduledAt)}<small>Asia/Ho_Chi_Minh (UTC+7)</small></dd></div>
      <div><dt>Kết thúc dự kiến</dt><dd>{end === null ? "Chưa xác định — không cho Hoàn thành" : formatStaffBookingDate(new Date(end).toISOString())}</dd></div>
      <div><dt>Lưu ý chăm sóc trong lịch</dt><dd className={styles.notes}>{booking.notes || "Chưa có lưu ý trong booking."}</dd></div>
    </dl>
    {action ? <ActionConfirmation key={action.target} booking={booking} action={action} now={now} result={result}
      processing={processing} onSubmit={onSubmit}
      onBack={() => { returning.current = true; setAction(null); onStartAction(); }} /> : actions.length > 0 ? <div className={styles.actionBlock}>
      <p className={styles.permissionNote}>Mỗi thao tác có bước xác nhận và kiểm tra lại trạng thái, giờ mô phỏng. Không tự động đổi trạng thái.</p>
      <div className={styles.actions}>{actions.map(({ target, label, disabledReason }) => <div key={target}>
        <button type="button" disabled={processing || !!disabledReason} aria-describedby={disabledReason ? `staff-block-${target}` : undefined}
          onClick={() => { onStartAction(); setAction({ target, expectedStatus: booking.status }); }}>{label}</button>
        {disabledReason && <p id={`staff-block-${target}`} className={styles.disabledReason}>{disabledReason}</p>}
      </div>)}</div>
    </div> : <p className={styles.permissionNote}>Lịch đã kết thúc, chỉ xem kết quả; không được sửa lại trạng thái.</p>}
    <p className={styles.muted}>Ghi nhận thanh toán thuộc quyền chủ cơ sở. Không mở hồ sơ khách / pet đầy đủ từ lịch hẹn này.</p>
  </StaffDialog>;
}
