"use client";

import { useEffect, useId, useRef, type FormEvent } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { formatMessage, vi } from "@/lib/locale";
import type { ProviderBooking } from "../../provider-workspace/liveApi";
import {
  getProviderErrorMessage,
  type ProviderLifecyclePermissions,
} from "../../provider-workspace/lifecycle";
import ProviderWorkspaceDialog from "../../provider-workspace/components/ProviderWorkspaceDialog";
import {
  ACTION_TARGET_STATUS,
  BOOKING_ACTION_LABELS,
  BOOKING_STATUS_LABELS,
  evaluateBookingTimeNotice,
  formatBookingSlotRange,
  formatBookingTimestamp,
  formatCalendarDate,
  formatVndAmount,
  getAvailableBookingActions,
} from "../bookingLogic";
import type {
  BookingDetailLoadState,
  BookingDraftState,
  BookingFeedback,
  ProviderBookingAction,
} from "../types";
import BookingStatusBadge from "./BookingStatusBadge";
import styles from "../bookings.module.css";

type Props = {
  bookingId: string;
  facilityName: string;
  summaryBooking: ProviderBooking | null;
  detailState: BookingDetailLoadState;
  permissions: ProviderLifecyclePermissions | null;
  draftState: BookingDraftState;
  feedback: BookingFeedback | null;
  cooldownSeconds: number;
  locked: boolean;
  onRetryDetail: () => void;
  onReloadList: () => void;
  onBeginAction: (action: ProviderBookingAction) => void;
  onCancelAction: () => void;
  onReasonChange: (value: string) => void;
  onSubmitAction: (action: ProviderBookingAction, reason: string) => void;
  onReconcileUnknown: () => void;
  onClose: () => void;
};

export default function BookingDetailsDialog({
  bookingId,
  facilityName,
  summaryBooking,
  detailState,
  permissions,
  draftState,
  feedback,
  cooldownSeconds,
  locked,
  onRetryDetail,
  onReloadList,
  onBeginAction,
  onCancelAction,
  onReasonChange,
  onSubmitAction,
  onReconcileUnknown,
  onClose,
}: Props) {
  const hintPrefix = useId();
  const feedbackRef = useRef<HTMLDivElement>(null);
  const confirmationRef = useRef<HTMLHeadingElement>(null);

  const busy =
    draftState.phase === "submitting" || draftState.phase === "reconciling";
  const booking = detailState.detail ?? summaryBooking;
  const isDetailReady = detailState.status === "ready" && detailState.detail !== null;
  const actions = booking
    ? getAvailableBookingActions(booking, permissions)
    : [];

  const activeAction =
    draftState.bookingId === bookingId ? draftState.action : null;
  const isUnknown =
    activeAction !== null &&
    (draftState.phase === "unknown" || draftState.phase === "reconciling");

  useEffect(() => {
    if (feedback) {
      feedbackRef.current?.focus();
    }
  }, [feedback]);

  const timeNoticeKind =
    booking && activeAction && draftState.openedAtMs !== null
      ? evaluateBookingTimeNotice(
          booking.slot,
          activeAction,
          draftState.openedAtMs,
        )
      : null;

  const slotRangeText = booking ? formatBookingSlotRange(booking.slot) : "";
  const timeNoticeMessage =
    timeNoticeKind === "no-show-before-start"
      ? formatMessage(vi.provider.bookings.timeNotice.noShowBeforeStart, {
          slotRange: slotRangeText,
        })
      : timeNoticeKind === "complete-before-start"
        ? formatMessage(vi.provider.bookings.timeNotice.completeBeforeStart, {
            slotRange: slotRangeText,
          })
        : timeNoticeKind === "complete-before-end"
          ? formatMessage(vi.provider.bookings.timeNotice.completeBeforeEnd, {
              slotRange: slotRangeText,
            })
          : null;

  function handleBeginAction(action: ProviderBookingAction) {
    onBeginAction(action);
    window.requestAnimationFrame(() => confirmationRef.current?.focus());
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeAction || busy || locked || cooldownSeconds > 0 || isUnknown) {
      return;
    }
    onSubmitAction(activeAction, draftState.reason);
  }

  return (
    <ProviderWorkspaceDialog
      title={formatMessage(vi.provider.bookings.details.title, { bookingId })}
      subtitle={formatMessage(vi.provider.bookings.details.subtitle, {
        facilityName,
      })}
      disableClose={busy}
      restoreFocusFallbackId="bookings-title"
      onClose={onClose}
    >
      <div className={styles.dialogContent}>
        {feedback && feedback.bookingId === bookingId && (
          <div
            ref={feedbackRef}
            tabIndex={-1}
            role={feedback.tone === "error" ? "alert" : "status"}
            className={
              feedback.tone === "error"
                ? styles.error
                : feedback.tone === "warning"
                  ? styles.warning
                  : styles.success
            }
          >
            {feedback.message}
          </div>
        )}

        {detailState.status === "loading" && !detailState.detail && (
          <div className={styles.stateBox} role="status" aria-busy="true">
            <p>{vi.provider.bookings.details.loading}</p>
          </div>
        )}

        {detailState.status === "not-found" && (
          <div className={styles.error} role="alert">
            <h3>{vi.provider.bookings.details.notFoundTitle}</h3>
            <p>{vi.provider.bookings.details.notFoundDescription}</p>
            <div className={styles.inlineActions}>
              <button
                type="button"
                className={styles.softButton}
                disabled={busy || cooldownSeconds > 0}
                onClick={() => {
                  onReloadList();
                  onClose();
                }}
              >
                {vi.provider.bookings.details.reloadList}
              </button>
            </div>
          </div>
        )}

        {detailState.status === "error" && (
          <div className={styles.error} role="alert">
            <h3>{vi.provider.bookings.details.errorTitle}</h3>
            <p>
              {detailState.error
                ? getProviderErrorMessage(detailState.error, cooldownSeconds)
                : vi.provider.workspace.errors.UNKNOWN_ERROR}
            </p>
            <div className={styles.inlineActions}>
              <button
                type="button"
                className={styles.softButton}
                disabled={busy || cooldownSeconds > 0}
                onClick={onRetryDetail}
              >
                <RefreshCw aria-hidden="true" size={14} />
                {vi.provider.bookings.details.retryDetail}
              </button>
            </div>
          </div>
        )}

        {booking && detailState.status !== "not-found" && (
          <>
            <dl className={styles.detailFields}>
              <dt>{vi.provider.bookings.labels.status}</dt>
              <dd>
                <BookingStatusBadge status={booking.status} />
              </dd>

              <dt>{vi.provider.bookings.labels.customer}</dt>
              <dd>
                <strong>{booking.customer.fullName}</strong>{" "}
                <span className={styles.mutedInline}>
                  (#{booking.customer.id})
                </span>
                <p className={styles.fieldHint}>
                  {vi.provider.bookings.details.piiNote}
                </p>
              </dd>

              <dt>{vi.provider.bookings.labels.pet}</dt>
              <dd>
                <strong>{booking.pet.name}</strong> ({booking.pet.petType.name}
                {booking.pet.breed ? ` · ${booking.pet.breed}` : ""})
                <div className={styles.petMeta}>
                  {booking.pet.birthDate && (
                    <span>
                      {formatMessage(
                        vi.provider.bookings.details.petBirthDate,
                        { date: formatCalendarDate(booking.pet.birthDate) },
                      )}
                    </span>
                  )}
                  {booking.pet.weight && (
                    <span>
                      {formatMessage(vi.provider.bookings.details.petWeight, {
                        weight: booking.pet.weight,
                      })}
                    </span>
                  )}
                </div>
                <p className={styles.fieldHint}>
                  {vi.provider.bookings.labels.petHealth}:{" "}
                  {booking.pet.healthNote ??
                    vi.provider.bookings.details.noHealthNote}
                </p>
              </dd>

              <dt>{vi.provider.bookings.labels.service}</dt>
              <dd>{booking.service.name}</dd>

              <dt>{vi.provider.bookings.labels.slotTime}</dt>
              <dd>{slotRangeText}</dd>

              <dt>{vi.provider.bookings.labels.duration}</dt>
              <dd>
                {formatMessage(vi.provider.bookings.details.duration, {
                  count: booking.service.durationMinutes,
                })}
                <p className={styles.fieldHint}>
                  {vi.provider.bookings.details.durationCurrentHint}
                </p>
              </dd>

              <dt>{vi.provider.bookings.labels.price}</dt>
              <dd>
                <strong>{formatVndAmount(booking.bookedPrice)}</strong>
                <p className={styles.fieldHint}>
                  {vi.provider.bookings.details.bookedPriceHint}
                </p>
              </dd>

              <dt>{vi.provider.bookings.labels.notes}</dt>
              <dd>
                {booking.customerNote || vi.provider.bookings.labels.noNotes}
              </dd>

              <dt>{vi.provider.bookings.details.createdAt}</dt>
              <dd>{formatBookingTimestamp(booking.createdAt)}</dd>

              <dt>{vi.provider.bookings.details.updatedAt}</dt>
              <dd>{formatBookingTimestamp(booking.updatedAt)}</dd>
            </dl>

            {isDetailReady && activeAction ? (
              <form
                onSubmit={handleSubmit}
                className={styles.confirmation}
                aria-busy={busy}
              >
                <h3 ref={confirmationRef} tabIndex={-1}>
                  {formatMessage(vi.provider.bookings.confirmation.heading, {
                    action: BOOKING_ACTION_LABELS[activeAction],
                  })}
                </h3>
                <p className={styles.transitionSummary}>
                  {formatMessage(vi.provider.bookings.confirmation.transition, {
                    from: BOOKING_STATUS_LABELS[booking.status],
                    to: BOOKING_STATUS_LABELS[ACTION_TARGET_STATUS[activeAction]],
                  })}
                </p>

                {activeAction === "confirm" && (
                  <p className={styles.actionHint}>
                    {vi.provider.bookings.confirmation.confirmHint}
                  </p>
                )}
                {activeAction === "complete" && (
                  <p className={styles.actionHint}>
                    {vi.provider.bookings.confirmation.completeHint}
                  </p>
                )}

                {timeNoticeMessage && (
                  <div className={styles.warning} role="note">
                    <AlertTriangle aria-hidden="true" size={16} />
                    <span>{timeNoticeMessage}</span>
                  </div>
                )}

                {(activeAction === "reject" || activeAction === "no-show") && (
                  <label className={styles.fieldLabel}>
                    <span>
                      {activeAction === "reject"
                        ? vi.provider.bookings.confirmation.rejectReasonLabel
                        : vi.provider.bookings.confirmation.noShowReasonLabel}
                    </span>
                    <textarea
                      value={draftState.reason}
                      onChange={(event) => onReasonChange(event.target.value)}
                      disabled={busy || isUnknown || locked}
                      rows={3}
                      maxLength={500}
                      placeholder={
                        activeAction === "reject"
                          ? vi.provider.bookings.confirmation
                              .rejectReasonPlaceholder
                          : vi.provider.bookings.confirmation
                              .noShowReasonPlaceholder
                      }
                    />
                  </label>
                )}

                {isUnknown ? (
                  <div className={styles.warning} role="alert">
                    <AlertTriangle aria-hidden="true" size={18} />
                    <div className={styles.warningBody}>
                      <h4>{vi.provider.bookings.unknown.title}</h4>
                      <p>{vi.provider.bookings.unknown.description}</p>
                      {draftState.reconcileError && (
                        <p className={styles.errorInline}>
                          {getProviderErrorMessage(
                            draftState.reconcileError,
                            cooldownSeconds,
                          )}
                        </p>
                      )}
                      <div className={styles.inlineActions}>
                        <button
                          type="button"
                          className={styles.primaryButton}
                          disabled={busy || locked || cooldownSeconds > 0}
                          onClick={onReconcileUnknown}
                        >
                          <RefreshCw aria-hidden="true" size={15} />
                          {draftState.phase === "reconciling"
                            ? vi.provider.bookings.unknown.reconciling
                            : vi.provider.bookings.unknown.reconcileButton}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {draftState.error && (
                      <p role="alert" className={styles.error}>
                        {getProviderErrorMessage(
                          draftState.error,
                          cooldownSeconds,
                        )}
                      </p>
                    )}
                    <div className={styles.confirmButtons}>
                      <button
                        type="submit"
                        className={styles.primaryButton}
                        disabled={busy || locked || cooldownSeconds > 0}
                      >
                        {draftState.phase === "submitting"
                          ? vi.provider.bookings.confirmation.pending
                          : vi.provider.bookings.confirmation.submit}
                      </button>
                      <button
                        type="button"
                        className={styles.softButton}
                        disabled={busy}
                        onClick={onCancelAction}
                      >
                        {vi.provider.bookings.confirmation.back}
                      </button>
                    </div>
                  </>
                )}
              </form>
            ) : isDetailReady ? (
              <div className={styles.actions}>
                {actions.map((option) => {
                  const hintId = `${hintPrefix}-${option.action}`;
                  return (
                    <div key={option.action} className={styles.actionRow}>
                      <button
                        type="button"
                        className={
                          option.action === "reject" ||
                          option.action === "no-show"
                            ? styles.softButton
                            : styles.primaryButton
                        }
                        disabled={
                          busy ||
                          locked ||
                          cooldownSeconds > 0 ||
                          Boolean(option.disabledReason)
                        }
                        aria-describedby={
                          option.disabledReason ? hintId : undefined
                        }
                        onClick={() => handleBeginAction(option.action)}
                      >
                        {option.label}
                      </button>
                      {option.disabledReason && (
                        <p id={hintId} className={styles.actionHint}>
                          {option.disabledReason}
                        </p>
                      )}
                    </div>
                  );
                })}
                {actions.length === 0 && (
                  <p className={styles.actionHint}>
                    {vi.provider.bookings.errors.finalStatus}
                  </p>
                )}
              </div>
            ) : null}

            {isDetailReady && detailState.detail && (
              <details className={styles.log} open>
                <summary>
                  {formatMessage(vi.provider.bookings.logs.title, {
                    count: detailState.detail.statusLogs.length,
                  })}
                </summary>
                {detailState.detail.statusLogs.length > 0 ? (
                  <ol>
                    {detailState.detail.statusLogs.map((entry) => (
                      <li key={entry.id}>
                        <p className={styles.logStatus}>
                          {entry.oldStatus === null
                            ? formatMessage(
                                vi.provider.bookings.logs.initialStatus,
                                {
                                  status:
                                    BOOKING_STATUS_LABELS[entry.newStatus],
                                },
                              )
                            : formatMessage(
                                vi.provider.bookings.logs.transitionStatus,
                                {
                                  from: BOOKING_STATUS_LABELS[entry.oldStatus],
                                  to: BOOKING_STATUS_LABELS[entry.newStatus],
                                },
                              )}
                        </p>
                        <p className={styles.logTime}>
                          <time dateTime={entry.createdAt}>
                            {formatBookingTimestamp(entry.createdAt)}
                          </time>{" "}
                          · Asia/Ho_Chi_Minh
                        </p>
                        <p className={styles.logReason}>
                          {formatMessage(vi.provider.bookings.logs.reason, {
                            reason:
                              entry.reason ||
                              vi.provider.bookings.logs.noReason,
                          })}
                        </p>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className={styles.actionHint}>
                    {vi.provider.bookings.logs.empty}
                  </p>
                )}
              </details>
            )}
          </>
        )}
      </div>
    </ProviderWorkspaceDialog>
  );
}
