"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { actionLabels, bookingActions, formatBookingDate, scheduledEnd, statusLabels } from "../bookingLogic";
import { mockNow, mockOwner } from "../data/providerBookingsMock";
import type { Booking, BookingCommand, BookingLog, BookingStatus, MockBookingsState } from "../types";
import BookingStatusBadge from "./BookingStatusBadge";
import styles from "../bookings.module.css";

type Props = {
  booking: Booking;
  logs: BookingLog[];
  pending: boolean;
  feedback: MockBookingsState["feedback"];
  simulateFailure: boolean;
  onSubmit: (command: BookingCommand) => void;
  onClose: () => void;
};

export default function BookingDetailsDialog({ booking, logs, pending, feedback, simulateFailure, onSubmit, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [target, setTarget] = useState<BookingStatus | null>(null);
  const [confirmationStatus, setConfirmationStatus] = useState(booking.status);
  const [reason, setReason] = useState("");
  const [attested, setAttested] = useState(false);
  const [validation, setValidation] = useState("");
  const confirmationRef = useRef<HTMLHeadingElement>(null);
  const feedbackRef = useRef<HTMLParagraphElement>(null);
  const actions = bookingActions(booking, mockOwner, mockNow);
  // A successful update invalidates the confirmation view immediately.
  const confirming = target !== null && confirmationStatus === booking.status;

  useEffect(() => {
    const dialog = ref.current;
    const trigger = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
      else document.getElementById("bookings-title")?.focus();
    };
  }, []);

  useEffect(() => {
    if (feedback) feedbackRef.current?.focus();
  }, [feedback]);

  function beginConfirmation(next: BookingStatus) {
    setTarget(next);
    setConfirmationStatus(booking.status);
    setReason("");
    setAttested(false);
    setValidation("");
    window.requestAnimationFrame(() => confirmationRef.current?.focus());
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!target || pending) return;
    if (target === "cancelled" && !reason.trim()) {
      setValidation("Vui lòng nhập lý do hủy; không được chỉ có khoảng trắng.");
      return;
    }
    if (["completed", "noShow"].includes(target) && !attested) {
      setValidation("Vui lòng xác nhận kết quả thực tế của lịch hẹn.");
      return;
    }
    setValidation("");
    onSubmit({ bookingId: booking.id, expectedStatus: booking.status, targetStatus: target, reason, confirmedActualOutcome: attested, simulateFailure });
  }

  return <dialog ref={ref} className={styles.dialog} aria-labelledby={titleId}
    onKeyDown={(event) => {
      if (event.key !== "Tab") return;
      const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), summary, a[href], [tabindex="0"]'))
        .filter((element) => element.getClientRects().length > 0);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!controls.includes(document.activeElement as HTMLElement) || (event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
        event.preventDefault();
        (event.shiftKey ? last : first)?.focus();
      }
    }}
    onCancel={(event) => { event.preventDefault(); if (!pending) onClose(); }}
    onClick={(event) => { if (event.target === event.currentTarget && !pending) onClose(); }}>
    <div className={styles.dialogBody}>
      <h2 id={titleId}>Chi tiết lịch #{booking.id}</h2>
      <p className={styles.mockLabel}>Dữ liệu mô phỏng · PawCare Studio</p>
      <dl className={styles.detailFields}>
        <dt>Khách hàng</dt><dd>{booking.customerName}</dd>
        <dt>Thú cưng</dt><dd>{booking.petName} ({booking.petSpecies})</dd>
        <dt>Dịch vụ</dt><dd>{booking.serviceName}</dd>
        <dt>Ngày giờ</dt><dd>{formatBookingDate(booking.scheduledAt, true)}</dd>
        <dt>Thời lượng</dt><dd>{booking.durationMinutes} phút</dd>
        <dt>Kết thúc dự kiến</dt><dd>{formatBookingDate(new Date(scheduledEnd(booking)).toISOString(), true)}</dd>
        <dt>Giá</dt><dd>{booking.price.toLocaleString("vi-VN")} ₫</dd>
        <dt>Ghi chú</dt><dd>{booking.notes || "Không có ghi chú"}</dd>
        <dt>Trạng thái</dt><dd><BookingStatusBadge status={booking.status} /></dd>
      </dl>
      <p className={styles.mockLabel}>Thời gian mô phỏng: {formatBookingDate(mockNow, true)} (Asia/Ho_Chi_Minh)</p>

      {feedback && <p ref={feedbackRef} tabIndex={-1} className={feedback.outcome === "error" ? styles.error : styles.success} role={feedback.outcome === "error" ? "alert" : "status"}>{feedback.message}</p>}

      {confirming ? <form onSubmit={submit} className={styles.confirmation} aria-busy={pending}>
        <h3 ref={confirmationRef} tabIndex={-1}>{actionLabels[target]}?</h3>
        <p>{booking.id} · {booking.customerName} · {booking.petName}</p>
        <p>{statusLabels[booking.status]} → {statusLabels[target]}</p>
        {target === "cancelled" && <label className={styles.fieldLabel}>
          Lý do hủy (bắt buộc)
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} required disabled={pending} rows={3} />
        </label>}
        {(target === "completed" || target === "noShow") && <label className={styles.checkboxLabel}>
          <input type="checkbox" checked={attested} onChange={(event) => setAttested(event.target.checked)} disabled={pending} required />
          {target === "completed" ? "Tôi xác nhận dịch vụ thực tế đã hoàn tất." : "Tôi xác nhận khách không đến lịch hẹn này."}
        </label>}
        {validation && <p role="alert" className={styles.error}>{validation}</p>}
        <button type="submit" className={styles.primaryButton} disabled={pending}>{pending ? "Đang cập nhật…" : "Xác nhận thao tác"}</button>
        <button type="button" className={styles.softButton} disabled={pending} onClick={() => {
          setTarget(null);
          window.requestAnimationFrame(() => ref.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus());
        }}>Quay lại chi tiết</button>
      </form> : <div className={styles.actions}>
        {actions.map((action) => <div key={action.target}>
          <button type="button" className={styles.primaryButton} disabled={pending || !!action.disabledReason}
            aria-describedby={action.disabledReason ? `${titleId}-${action.target}` : undefined}
            onClick={() => beginConfirmation(action.target)}>{action.label}</button>
          {action.disabledReason && <p id={`${titleId}-${action.target}`} className={styles.actionHint}>{action.disabledReason}</p>}
        </div>)}
        {actions.length === 0 && <p className={styles.actionHint}>Lịch đã kết thúc; không thể chuyển trạng thái tiếp.</p>}
      </div>}

      {logs.length > 0 && <details className={styles.log}>
        <summary>Nhật ký thao tác ({logs.length})</summary>
        <ol>{logs.map((entry) => <li key={entry.id}>
          <p>{statusLabels[entry.previousStatus]} → {statusLabels[entry.nextStatus]} · {entry.outcome === "success" ? "Thành công" : "Thất bại"}</p>
          <p>{entry.actor.name} (Provider Owner) · {formatBookingDate(entry.occurredAt, true)}</p>
          <p>Lý do: {entry.reason || "Không có"}</p>
          {entry.outcome === "error" && <p>{entry.message} Yêu cầu: {statusLabels[entry.requestedStatus]}.</p>}
        </li>)}</ol>
      </details>}
      <button type="button" className={styles.softButton} disabled={pending} onClick={onClose} autoFocus>Đóng</button>
    </div>
  </dialog>;
}
