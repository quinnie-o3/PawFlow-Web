import { vi, formatMessage } from "@/lib/locale";
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
    <h3 ref={title} tabIndex={-1}>{formatMessage(vi.staff.bookings.details.confirmationTitle, { action: staffActionLabels[action.target] })}</h3>
    <p>#{booking.id} · {staffStatusLabels[action.expectedStatus]} → {staffStatusLabels[action.target]}</p>
    <p>{formatMessage(vi.staff.bookings.details.mockTime, { time: formatStaffBookingDate(new Date(now).toISOString()) })}</p>
    {action.target === "completed" && <p>{vi.staff.bookings.details.completionHint}</p>}
    {requiresReason && <label className={styles.field}>{vi.staff.bookings.details.reasonLabel}<textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} required disabled={succeeded || processing}
        aria-invalid={failed && !reason.trim() ? true : undefined} aria-describedby={failed ? "staff-operation-error" : undefined} />
    </label>}
    {requiresOutcome && <label className={styles.check}>
      <input type="checkbox" checked={attested} onChange={(event) => setAttested(event.target.checked)} required disabled={succeeded || processing}
        aria-invalid={failed && !attested ? true : undefined} aria-describedby={failed ? "staff-operation-error" : undefined} />
      {action.target === "completed" ? vi.staff.bookings.details.attestCompleted : vi.staff.bookings.details.attestNoShow}
    </label>}
    {failed && <p ref={feedback} tabIndex={-1} id="staff-operation-error" role="alert" className={styles.operationError}>{result.message}</p>}
    {succeeded && <p ref={feedback} tabIndex={-1} role="status" className={styles.operationSuccess}>{formatMessage(vi.staff.bookings.details.sessionResult, { message: result.message })}</p>}
    {processing && <p role="status">{vi.staff.bookings.details.processingNotice}</p>}
    <div className={styles.formButtons}>
      <button type="button" className={styles.secondaryButton} disabled={processing} onClick={onBack}>{succeeded ? vi.staff.bookings.details.backToDetails : vi.staff.bookings.details.back}</button>
      {!succeeded && <button type="submit" className={styles.primaryButton} disabled={processing}>{processing ? vi.staff.bookings.details.processing : vi.staff.bookings.details.confirmAction}</button>}
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
  return <StaffDialog title={formatMessage(vi.staff.bookings.details.title, { bookingId: booking.id })} busy={processing} onClose={onClose}>
    <h3 ref={detailsTitle} tabIndex={-1} className={styles.detailHeading}>{vi.staff.bookings.details.informationTitle}</h3>
    <StaffStatusBadge status={booking.status} />
    <dl className={styles.facts}>
      <div><dt>{vi.staff.bookings.details.customerLabel}</dt><dd>{booking.customerName}</dd></div>
      <div><dt>{vi.staff.bookings.details.contactLabel}</dt><dd>{booking.contactPhone || vi.staff.bookings.details.noPhone}</dd></div>
      <div><dt>{vi.staff.bookings.details.petLabel}</dt><dd>{booking.petName} · {booking.petSpecies}{booking.petBreed && ` · ${booking.petBreed}`}</dd></div>
      {booking.petAge && <div><dt>{vi.staff.bookings.details.ageLabel}</dt><dd>{booking.petAge}</dd></div>}
      {booking.petWeightKg != null && <div><dt>{vi.staff.bookings.details.weightLabel}</dt><dd>{booking.petWeightKg} kg</dd></div>}
      {booking.petAllergies && <div><dt>{vi.staff.bookings.details.allergiesLabel}</dt><dd className={styles.notes}>{booking.petAllergies}</dd></div>}
      <div><dt>{vi.staff.bookings.details.serviceLabel}</dt><dd>{booking.serviceName}<small>{formatMessage(vi.staff.bookings.details.snapshotDuration, { duration: booking.durationMinutesSnapshot != null && booking.durationMinutesSnapshot > 0 ? formatMessage(vi.staff.bookings.details.durationMinutes, { count: booking.durationMinutesSnapshot }) : vi.staff.bookings.details.invalidDuration })}</small></dd></div>
      <div><dt>{vi.staff.bookings.details.priceLabel}</dt><dd>{formatStaffPrice(booking.priceSnapshot)}</dd></div>
      <div><dt>{vi.staff.bookings.details.appointmentTimeLabel}</dt><dd>{formatStaffBookingDate(booking.scheduledAt)}<small>Asia/Ho_Chi_Minh (UTC+7)</small></dd></div>
      <div><dt>{vi.staff.bookings.details.expectedEndLabel}</dt><dd>{end === null ? vi.staff.bookings.details.unknownEnd : formatStaffBookingDate(new Date(end).toISOString())}</dd></div>
      <div><dt>{vi.staff.bookings.details.notesLabel}</dt><dd className={styles.notes}>{booking.notes || vi.staff.bookings.details.noNotes}</dd></div>
    </dl>
    {action ? <ActionConfirmation key={action.target} booking={booking} action={action} now={now} result={result}
      processing={processing} onSubmit={onSubmit}
      onBack={() => { returning.current = true; setAction(null); onStartAction(); }} /> : actions.length > 0 ? <div className={styles.actionBlock}>
      <p className={styles.permissionNote}>{vi.staff.bookings.details.actionRules}</p>
      <div className={styles.actions}>{actions.map(({ target, label, disabledReason }) => <div key={target}>
        <button type="button" disabled={processing || !!disabledReason} aria-describedby={disabledReason ? `staff-block-${target}` : undefined}
          onClick={() => { onStartAction(); setAction({ target, expectedStatus: booking.status }); }}>{label}</button>
        {disabledReason && <p id={`staff-block-${target}`} className={styles.disabledReason}>{disabledReason}</p>}
      </div>)}</div>
    </div> : <p className={styles.permissionNote}>{vi.staff.bookings.details.terminalNotice}</p>}
    <p className={styles.muted}>{vi.staff.bookings.details.ownerPaymentNotice}</p>
  </StaffDialog>;
}
