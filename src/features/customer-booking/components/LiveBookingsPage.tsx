"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { formatMessage, vi } from "@/lib/locale";
import Skeleton from "@/components/ui/Skeleton";
import { ApiError, isRequestCancelled } from "../../../lib/api/errors";
import { queryKeys } from "../../../lib/api/queryCache";
import { useSession } from "../../session/SessionProvider";
import { privateCache, retrySession, snapshot } from "../../session/client";
import { roleHome } from "../../session/model";
import {
  formatDuration,
  formatPrice,
  TIME_ZONE,
} from "../../customer-catalog/catalogLogic";
import { validId } from "../../public-catalog/query";
import CustomerDialog from "../../customer-shell/components/CustomerDialog";
import {
  cancelMyBooking,
  classifyBookingError,
  getMyBookingDetail,
  listMyBookings,
  LIVE_BOOKING_STATUSES,
  type LiveBookingErrorInfo,
  type LiveBookingStatus,
  type LiveCustomerBooking,
  type LiveCustomerBookingDetail,
} from "../liveApi";
import {
  activeCustomerActor,
  sessionBoundaryAction,
  sessionIdentityKey,
  type LiveSessionSnapshot,
  type SessionBoundaryDecision,
} from "../liveSubmission";
import {
  beginCancelReconcile,
  beginCancelSubmit,
  cancelCooldownRemainingMs,
  closeCancelFlow,
  createInitialCancelState,
  evaluateCancelEligibility,
  filterLiveBookings,
  formatVietnamAppointment,
  formatVietnamDateTime,
  isCancelDialogOpen,
  isCancelInFlight,
  openCancelFlow,
  resetCancelForSessionBoundary,
  settleCancelReconcile,
  settleCancelSubmit,
  syncCancelWithRefreshedDetail,
  toLiveCancelError,
  updateCancelReason,
  type LiveCancelState,
} from "../liveCancel";
import styles from "../booking.module.css";

type BookingsListState =
  | { status: "loading"; items: LiveCustomerBooking[]; error: null }
  | { status: "ready"; items: LiveCustomerBooking[]; error: null }
  | { status: "error"; items: []; error: LiveBookingErrorInfo };

type BookingDetailState =
  | { status: "loading"; data: LiveCustomerBookingDetail | null; error: null }
  | { status: "ready"; data: LiveCustomerBookingDetail; error: null }
  | { status: "not-found"; data: null; error: null }
  | { status: "error"; data: null; error: LiveBookingErrorInfo };

const INITIAL_LIST_STATE: BookingsListState = {
  status: "loading",
  items: [],
  error: null,
};

const INITIAL_DETAIL_STATE: BookingDetailState = {
  status: "loading",
  data: null,
  error: null,
};

function LiveStatusBadge({ status }: { status: LiveBookingStatus }) {
  return (
    <span className={styles.status} data-status={status}>
      {vi.booking.statuses[status]}
    </span>
  );
}

function SessionFallback({
  boundary,
  session,
}: {
  boundary: SessionBoundaryDecision;
  session: LiveSessionSnapshot;
}) {
  const t = vi.booking.live;
  if (boundary.mode === "session-pending") {
    return (
      <section className={styles.page}>
        <div className={styles.feedback} role="status">
          <p>{t.sessionPending}</p>
        </div>
      </section>
    );
  }
  if (boundary.mode === "session-error") {
    return (
      <section className={styles.page}>
        <div className={styles.feedback} role="alert">
          <h1>{t.sessionErrorTitle}</h1>
          <p>{t.sessionErrorDescription}</p>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => void retrySession().catch(() => {})}
            >
              {t.retrySession}
            </button>
          </div>
        </div>
      </section>
    );
  }
  if (boundary.mode === "guest") {
    return (
      <section className={styles.page}>
        <div className={styles.empty}>
          <h1>{vi.booking.listTitle}</h1>
          <p>{t.guestDescription}</p>
          <Link href="/login" prefetch={false} className={styles.primary}>
            {vi.discovery.detail.login}
          </Link>
        </div>
      </section>
    );
  }
  return (
    <section className={styles.page}>
      <div className={styles.empty}>
        <h1>{t.nonCustomerTitle}</h1>
        <p>{t.nonCustomerDescription}</p>
        {session.session?.user && (
          <Link
            href={roleHome(session.session.user.role)}
            prefetch={false}
            className={styles.primary}
          >
            {t.goToMyHome}
          </Link>
        )}
      </div>
    </section>
  );
}

export default function LiveBookingsPage({
  initialStatus = "",
}: {
  initialStatus?: LiveBookingStatus | "";
}) {
  const session = useSession();
  const t = vi.booking.live;

  const [trackedSession, setTrackedSession] = useState<{
    identity: string | null;
    status: LiveSessionSnapshot["status"];
  }>(() => ({
    identity: sessionIdentityKey(session),
    status: session.status,
  }));

  const [listState, setListState] =
    useState<BookingsListState>(INITIAL_LIST_STATE);
  const [statusFilter, setStatusFilter] = useState<LiveBookingStatus | "">(
    initialStatus,
  );
  const [searchInput, setSearchInput] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");

  const composingRef = useRef(false);
  const listControllerRef = useRef<AbortController | null>(null);
  const listRevisionRef = useRef(0);

  const boundary = sessionBoundaryAction(trackedSession.identity, session);
  const sessionChanged =
    trackedSession.identity !== boundary.identity ||
    trackedSession.status !== session.status;

  if (sessionChanged) {
    setTrackedSession({ identity: boundary.identity, status: session.status });
    if (boundary.resetPrivateState) {
      setListState(INITIAL_LIST_STATE);
      setStatusFilter(initialStatus);
      setSearchInput("");
      setAppliedQuery("");
    }
  }

  const customerIdentity =
    boundary.mode === "customer" ? boundary.identity : null;

  const loadBookings = useCallback(async () => {
    if (!customerIdentity) return;
    listControllerRef.current?.abort();
    const controller = new AbortController();
    listControllerRef.current = controller;
    const revision = ++listRevisionRef.current;

    setListState((current) => ({
      status: "loading",
      items: current.status === "ready" ? current.items : [],
      error: null,
    }));

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const items = await listMyBookings({ signal: controller.signal });
        if (
          controller.signal.aborted ||
          revision !== listRevisionRef.current ||
          sessionIdentityKey(snapshot()) !== customerIdentity
        ) {
          return;
        }
        setListState({ status: "ready", items, error: null });
        return;
      } catch (error) {
        if (
          controller.signal.aborted ||
          revision !== listRevisionRef.current ||
          sessionIdentityKey(snapshot()) !== customerIdentity
        ) {
          return;
        }
        if (isRequestCancelled(error)) {
          // Cache write rejected due to concurrent invalidation; reload once cleanly.
          if (attempt === 0) continue;
          setListState({
            status: "error",
            items: [],
            error: classifyBookingError(
              new ApiError("network"),
              "list-bookings",
            ),
          });
          return;
        }
        setListState({
          status: "error",
          items: [],
          error: classifyBookingError(error, "list-bookings"),
        });
        return;
      }
    }
  }, [customerIdentity]);

  useEffect(() => {
    if (!customerIdentity) {
      listControllerRef.current?.abort();
      return;
    }
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return loadBookings();
    });
    return () => {
      active = false;
      listControllerRef.current?.abort();
    };
  }, [customerIdentity, loadBookings]);

  const rows = useMemo(() => {
    if (listState.status !== "ready") return [];
    return filterLiveBookings(listState.items, {
      status: statusFilter,
      query: appliedQuery,
    });
  }, [listState, statusFilter, appliedQuery]);

  if (boundary.mode !== "customer") {
    return <SessionFallback boundary={boundary} session={session} />;
  }

  const allBookings = listState.status === "ready" ? listState.items : [];
  const hasActiveFilter = statusFilter !== "" || appliedQuery.trim() !== "";

  return (
    <section
      className={styles.page}
      aria-labelledby="live-bookings-title"
      aria-busy={listState.status === "loading"}
    >
      <div className={styles.detailHeading}>
        <h1 id="live-bookings-title">{vi.booking.listTitle}</h1>
        <button
          type="button"
          className={styles.secondary}
          disabled={listState.status === "loading"}
          onClick={() => void loadBookings()}
        >
          {t.reloadList}
        </button>
      </div>
      <p className={styles.count}>{t.listSubtitle}</p>

      <label className={styles.search}>
        <Search aria-hidden="true" size={20} />
        <input
          type="search"
          value={searchInput}
          aria-label={vi.booking.searchLabel}
          placeholder={vi.booking.search}
          onCompositionStart={() => {
            composingRef.current = true;
          }}
          onCompositionEnd={(event) => {
            composingRef.current = false;
            const next = event.currentTarget.value;
            setSearchInput(next);
            setAppliedQuery(next);
          }}
          onChange={(event) => {
            const next = event.target.value;
            setSearchInput(next);
            if (!composingRef.current) {
              setAppliedQuery(next);
            }
          }}
        />
      </label>

      <div className={styles.filters} aria-label={vi.booking.columns.status}>
        <button
          type="button"
          aria-pressed={statusFilter === ""}
          onClick={() => setStatusFilter("")}
        >
          {vi.booking.all}
        </button>
        {LIVE_BOOKING_STATUSES.map((status) => (
          <button
            type="button"
            key={status}
            aria-pressed={statusFilter === status}
            onClick={() => setStatusFilter(status)}
          >
            {vi.booking.statuses[status]}
          </button>
        ))}
      </div>

      {listState.status === "loading" ? (
        <div className={styles.feedback}>
          <Skeleton label={t.loading} rows={4} />
        </div>
      ) : listState.status === "error" ? (
        <div className={styles.feedback} role="alert">
          <p>{t.errors[listState.error.code]}</p>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => void loadBookings()}
            >
              {vi.booking.retry}
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className={styles.count} role="status">
            {formatMessage(vi.booking.listCount, { count: rows.length })}
          </p>
          {rows.length === 0 ? (
            <div className={styles.empty}>
              <p>
                {allBookings.length > 0 ? vi.booking.noResults : t.listEmpty}
              </p>
              {allBookings.length > 0 && hasActiveFilter && (
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={() => {
                    setStatusFilter("");
                    setSearchInput("");
                    setAppliedQuery("");
                  }}
                >
                  {vi.booking.resetFilters}
                </button>
              )}
              <Link className={styles.primary} href="/discover" prefetch={false}>
                {vi.booking.discover}
              </Link>
            </div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    {Object.entries(vi.booking.columns).map(([key, label]) => (
                      <th key={key} scope="col">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((booking) => (
                    <tr key={booking.id}>
                      <td>#{booking.id}</td>
                      <td>
                        <div className={styles.serviceCell}>
                          <div>
                            {booking.service.name}
                            <small>{booking.provider.businessName}</small>
                          </div>
                        </div>
                      </td>
                      <td>{formatVietnamAppointment(booking.slot)}</td>
                      <td>{booking.pet.name}</td>
                      <td>
                        <LiveStatusBadge status={booking.status} />
                      </td>
                      <td>
                        <Link
                          className={styles.link}
                          href={`/bookings/${encodeURIComponent(booking.id)}`}
                          prefetch={false}
                          aria-label={formatMessage(vi.booking.detail, {
                            bookingId: booking.id,
                          })}
                        >
                          {vi.booking.view}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export function LiveBookingDetailPage({ bookingId }: { bookingId: string }) {
  const session = useSession();
  const t = vi.booking.live;
  const idValid = validId(bookingId);

  const [tracked, setTracked] = useState<{
    identity: string | null;
    status: LiveSessionSnapshot["status"];
    bookingId: string;
  }>(() => ({
    identity: sessionIdentityKey(session),
    status: session.status,
    bookingId,
  }));

  const [detailState, setDetailState] = useState<BookingDetailState>(() =>
    idValid
      ? INITIAL_DETAIL_STATE
      : { status: "not-found", data: null, error: null },
  );
  const [cancelState, setCancelState] = useState<LiveCancelState>(() =>
    createInitialCancelState(),
  );
  const [pageNotice, setPageNotice] = useState<string | null>(null);
  const [dialogNotice, setDialogNotice] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const cancelRef = useRef<LiveCancelState>(cancelState);
  const detailControllerRef = useRef<AbortController | null>(null);
  const detailRevisionRef = useRef(0);
  const cancelControllerRef = useRef<AbortController | null>(null);
  const cancelRequestSeqRef = useRef(0);
  const reasonRef = useRef<HTMLTextAreaElement | null>(null);

  const boundary = sessionBoundaryAction(tracked.identity, session);
  const sessionChanged =
    tracked.identity !== boundary.identity ||
    tracked.status !== session.status;
  const bookingIdChanged = tracked.bookingId !== bookingId;

  if (sessionChanged || bookingIdChanged) {
    setTracked({
      identity: boundary.identity,
      status: session.status,
      bookingId,
    });
    if (boundary.resetPrivateState || bookingIdChanged) {
      setDetailState(
        idValid
          ? INITIAL_DETAIL_STATE
          : { status: "not-found", data: null, error: null },
      );
      setCancelState(createInitialCancelState());
      setPageNotice(null);
      setDialogNotice(null);
    } else if (boundary.closeDialog) {
      setCancelState((current) =>
        resetCancelForSessionBoundary(current, boundary.identity),
      );
      setDialogNotice(null);
    }
  }

  useEffect(() => {
    cancelRef.current = cancelState;
  }, [cancelState]);

  const commitCancel = useCallback((next: LiveCancelState) => {
    cancelRef.current = next;
    setCancelState(next);
  }, []);

  // Abort any in-flight cancel or reconcile request on identity/booking switch or unmount.
  useEffect(() => {
    return () => {
      cancelControllerRef.current?.abort();
    };
  }, [boundary.identity, bookingId]);

  const actor = activeCustomerActor(session);
  const customerIdentity =
    boundary.mode === "customer" ? boundary.identity : null;

  const loadDetail = useCallback(
    async (options: { preserveData?: boolean } = {}) => {
      if (!customerIdentity) return;
      if (!idValid) {
        setDetailState({ status: "not-found", data: null, error: null });
        return;
      }

      detailControllerRef.current?.abort();
      const controller = new AbortController();
      detailControllerRef.current = controller;
      const revision = ++detailRevisionRef.current;

      setDetailState((current) => {
        if (options.preserveData && current.status === "ready") {
          return current;
        }
        return {
          status: "loading",
          data: current.status === "ready" ? current.data : null,
          error: null,
        };
      });

      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const detail = await getMyBookingDetail(bookingId, {
            signal: controller.signal,
          });
          if (
            controller.signal.aborted ||
            revision !== detailRevisionRef.current ||
            sessionIdentityKey(snapshot()) !== customerIdentity
          ) {
            return;
          }
          setNow(Date.now());
          setDetailState({ status: "ready", data: detail, error: null });
          return;
        } catch (error) {
          if (
            controller.signal.aborted ||
            revision !== detailRevisionRef.current ||
            sessionIdentityKey(snapshot()) !== customerIdentity
          ) {
            return;
          }
          if (isRequestCancelled(error)) {
            if (attempt === 0) continue;
            if (!options.preserveData) {
              setDetailState({
                status: "error",
                data: null,
                error: classifyBookingError(
                  new ApiError("network"),
                  "get-booking",
                ),
              });
            }
            return;
          }
          const classified = classifyBookingError(error, "get-booking");
          if (classified.code === "BOOKING_NOT_FOUND") {
            setDetailState({ status: "not-found", data: null, error: null });
            return;
          }
          if (!options.preserveData) {
            setDetailState({ status: "error", data: null, error: classified });
          }
          return;
        }
      }
    },
    [bookingId, customerIdentity, idValid],
  );

  useEffect(() => {
    if (!customerIdentity || !idValid) {
      detailControllerRef.current?.abort();
      return;
    }
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return loadDetail();
    });
    return () => {
      active = false;
      detailControllerRef.current?.abort();
    };
  }, [customerIdentity, idValid, loadDetail]);

  const cooldownUntil =
    (cancelState.phase === "failed" || cancelState.phase === "unknown") &&
    cancelState.cooldownUntil !== null
      ? cancelState.cooldownUntil
      : 0;

  useEffect(() => {
    if (cooldownUntil <= 0) return;
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= cooldownUntil) clearInterval(timer);
    }, 500);
    return () => clearInterval(timer);
  }, [cooldownUntil]);

  const detail = detailState.status === "ready" ? detailState.data : null;
  const eligibility = useMemo(
    () => (detail ? evaluateCancelEligibility(detail, now) : null),
    [detail, now],
  );

  // Refresh clock automatically when an eligible upcoming appointment reaches its start time.
  const upcomingStartMs =
    eligibility?.eligible && eligibility.slotStartMs > now
      ? eligibility.slotStartMs
      : null;

  useEffect(() => {
    if (upcomingStartMs === null) return;
    const delay = upcomingStartMs - Date.now() + 50;
    if (delay <= 0 || delay > 24 * 60 * 60 * 1000) return;
    const timer = setTimeout(() => {
      setNow(Date.now());
    }, delay);
    return () => clearTimeout(timer);
  }, [upcomingStartMs]);

  const dialogOpen =
    boundary.mode === "customer" &&
    detail !== null &&
    isCancelDialogOpen(cancelState);
  const cancelInFlight = isCancelInFlight(cancelState);

  useEffect(() => {
    if (dialogOpen && cancelState.phase === "confirming") {
      reasonRef.current?.focus({ preventScroll: true });
    }
  }, [dialogOpen, cancelState.phase]);

  if (boundary.mode !== "customer") {
    return <SessionFallback boundary={boundary} session={session} />;
  }

  const cooldownMs = cancelCooldownRemainingMs(cancelState, now);
  const cooldownSeconds = Math.ceil(cooldownMs / 1000);

  function handleOpenCancel() {
    if (!actor || !detail) return;
    const timestamp = Date.now();
    setNow(timestamp);
    setDialogNotice(null);
    const opened = openCancelFlow(cancelRef.current, actor, detail, timestamp);
    if (opened.ok) {
      commitCancel(opened.state);
    }
  }

  function handleCloseCancel() {
    if (isCancelInFlight(cancelRef.current)) return;
    const wasUnknown = cancelRef.current.phase === "unknown";
    setDialogNotice(null);
    commitCancel(closeCancelFlow(cancelRef.current));
    if (wasUnknown) {
      privateCache.invalidate(queryKeys.bookings.all());
      void loadDetail({ preserveData: true });
    }
  }

  async function refreshAfterConflict(
    expectedBookingId: string,
    expectedIdentity: string,
    controller: AbortController,
  ) {
    privateCache.invalidate(queryKeys.bookings.all());
    try {
      const refreshed = await getMyBookingDetail(expectedBookingId, {
        signal: controller.signal,
      });
      if (
        controller.signal.aborted ||
        sessionIdentityKey(snapshot()) !== expectedIdentity
      ) {
        return;
      }
      const timestamp = Date.now();
      setNow(timestamp);
      setDetailState({ status: "ready", data: refreshed, error: null });
      const synced = syncCancelWithRefreshedDetail(
        cancelRef.current,
        refreshed,
        timestamp,
      );
      if (synced.resolution === "already-cancelled") {
        commitCancel(synced.state);
        setDialogNotice(null);
        setPageNotice(t.cancelConfirmedAfterSync);
      } else if (synced.resolution === "no-longer-cancellable") {
        commitCancel(synced.state);
        setDialogNotice(null);
        setPageNotice(
          synced.reasonCode === "CANCEL_TIME"
            ? t.cancelSyncedTimePassed
            : formatMessage(t.cancelSyncedNotCancellable, {
                status: vi.booking.statuses[refreshed.status],
              }),
        );
      } else if (synced.resolution === "still-cancellable") {
        commitCancel(synced.state);
      }
    } catch (refreshError) {
      if (
        isRequestCancelled(refreshError) ||
        controller.signal.aborted ||
        sessionIdentityKey(snapshot()) !== expectedIdentity
      ) {
        return;
      }
      const classified = classifyBookingError(refreshError, "get-booking");
      if (classified.code === "BOOKING_NOT_FOUND") {
        commitCancel(createInitialCancelState());
        setDialogNotice(null);
        setDetailState({ status: "not-found", data: null, error: null });
      }
    }
  }

  async function handleSubmitCancel(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!actor || !detail) return;
    if (isCancelInFlight(cancelRef.current)) return;

    const timestamp = Date.now();
    setNow(timestamp);
    const requestId = ++cancelRequestSeqRef.current;
    const begun = beginCancelSubmit(
      cancelRef.current,
      actor,
      detail,
      requestId,
      timestamp,
    );
    if (!begun.ok) {
      if (begun.reason === "INELIGIBLE") {
        commitCancel(begun.state);
        privateCache.invalidate(queryKeys.bookings.all());
        void loadDetail({ preserveData: true });
      }
      return;
    }

    setDialogNotice(null);
    commitCancel(begun.state);

    const expectedIdentity =
      begun.state.phase === "submitting" ? begun.state.identity : "";
    const targetBookingId = detail.id;

    cancelControllerRef.current?.abort();
    const controller = new AbortController();
    cancelControllerRef.current = controller;

    try {
      const updated = await cancelMyBooking(targetBookingId, begun.input, {
        signal: controller.signal,
      });
      if (
        controller.signal.aborted ||
        sessionIdentityKey(snapshot()) !== expectedIdentity
      ) {
        return;
      }
      const settled = settleCancelSubmit(
        cancelRef.current,
        requestId,
        expectedIdentity,
        { kind: "success", booking: updated },
      );
      commitCancel(settled);
      setDialogNotice(null);
      setPageNotice(t.cancelSucceeded);
      setDetailState((current) =>
        current.status === "ready" && current.data.id === updated.id
          ? {
              status: "ready",
              data: { ...current.data, ...updated },
              error: null,
            }
          : current,
      );
      void loadDetail({ preserveData: true });
    } catch (error) {
      if (
        isRequestCancelled(error) ||
        controller.signal.aborted ||
        sessionIdentityKey(snapshot()) !== expectedIdentity
      ) {
        return;
      }
      const apiErr = toLiveCancelError(
        classifyBookingError(error, "cancel-booking"),
      );
      const failedAt = Date.now();
      setNow(failedAt);
      const settled = settleCancelSubmit(
        cancelRef.current,
        requestId,
        expectedIdentity,
        { kind: "error", error: apiErr, failedAt },
      );
      commitCancel(settled);

      if (apiErr.code === "BOOKING_NOT_FOUND") {
        privateCache.invalidate(queryKeys.bookings.all());
        commitCancel(createInitialCancelState());
        setDialogNotice(null);
        setDetailState({ status: "not-found", data: null, error: null });
        return;
      }
      if (
        apiErr.code === "CANCEL_STATUS" ||
        apiErr.code === "CANCEL_TIME" ||
        apiErr.code === "BOOKING_CONFLICT"
      ) {
        await refreshAfterConflict(
          targetBookingId,
          expectedIdentity,
          controller,
        );
      }
    }
  }

  async function handleReconcileCancel() {
    if (!actor || !detail) return;
    if (isCancelInFlight(cancelRef.current)) return;

    const timestamp = Date.now();
    setNow(timestamp);
    const requestId = ++cancelRequestSeqRef.current;
    const begun = beginCancelReconcile(
      cancelRef.current,
      actor,
      requestId,
      timestamp,
    );
    if (!begun.ok) return;

    setDialogNotice(null);
    commitCancel(begun.state);

    const expectedIdentity =
      begun.state.phase === "reconciling" ? begun.state.identity : "";

    cancelControllerRef.current?.abort();
    const controller = new AbortController();
    cancelControllerRef.current = controller;

    try {
      const refreshed = await getMyBookingDetail(begun.bookingId, {
        signal: controller.signal,
      });
      if (
        controller.signal.aborted ||
        sessionIdentityKey(snapshot()) !== expectedIdentity
      ) {
        return;
      }
      const settledAt = Date.now();
      setNow(settledAt);
      setDetailState({ status: "ready", data: refreshed, error: null });

      const result = settleCancelReconcile(
        cancelRef.current,
        requestId,
        expectedIdentity,
        { kind: "detail", detail: refreshed },
        settledAt,
      );
      if (result.resolution === "ignored") return;
      commitCancel(result.state);
      if (result.resolution === "cancelled") {
        setDialogNotice(null);
        setPageNotice(t.cancelConfirmedAfterSync);
      } else if (result.resolution === "still-cancellable") {
        setDialogNotice(t.cancelReconcileStillOpen);
      } else if (result.resolution === "no-longer-cancellable") {
        setDialogNotice(null);
        setPageNotice(
          result.reasonCode === "CANCEL_TIME"
            ? t.cancelSyncedTimePassed
            : formatMessage(t.cancelSyncedNotCancellable, {
                status: vi.booking.statuses[refreshed.status],
              }),
        );
      }
    } catch (error) {
      if (
        isRequestCancelled(error) ||
        controller.signal.aborted ||
        sessionIdentityKey(snapshot()) !== expectedIdentity
      ) {
        return;
      }
      const err = toLiveCancelError(classifyBookingError(error, "get-booking"));
      const failedAt = Date.now();
      setNow(failedAt);
      const result = settleCancelReconcile(
        cancelRef.current,
        requestId,
        expectedIdentity,
        { kind: "error", error: err, failedAt },
        failedAt,
      );
      if (result.resolution === "ignored") return;
      commitCancel(result.state);
      if (
        result.resolution === "terminal-error" &&
        err.code === "BOOKING_NOT_FOUND"
      ) {
        privateCache.invalidate(queryKeys.bookings.all());
        setDialogNotice(null);
        setDetailState({ status: "not-found", data: null, error: null });
      }
    }
  }

  return (
    <section className={styles.page}>
      <Link className={styles.link} href="/bookings" prefetch={false}>
        {vi.booking.back}
      </Link>

      {detailState.status === "loading" ? (
        <div className={styles.feedback}>
          <Skeleton label={t.detailLoading} rows={5} />
        </div>
      ) : detailState.status === "error" ? (
        <div className={styles.feedback} role="alert">
          <p>{t.errors[detailState.error.code]}</p>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => void loadDetail()}
            >
              {vi.booking.retry}
            </button>
          </div>
        </div>
      ) : detailState.status === "not-found" || !detail ? (
        <div className={styles.empty}>
          <h1>{t.detailNotFoundTitle}</h1>
          <p>{t.detailNotFoundDescription}</p>
          <Link className={styles.primary} href="/bookings" prefetch={false}>
            {vi.booking.back}
          </Link>
        </div>
      ) : (
        <article className={styles.detailCard}>
          <div className={styles.detailHeading}>
            <h1 id="live-booking-detail-title" tabIndex={-1}>
              {formatMessage(vi.booking.detail, { bookingId: detail.id })}
            </h1>
            <LiveStatusBadge status={detail.status} />
          </div>

          {pageNotice && (
            <p className={styles.notice} role="status">
              {pageNotice}
            </p>
          )}

          <dl className={styles.facts}>
            <dt>{vi.booking.providerLabel}</dt>
            <dd>
              <Link
                className={styles.link}
                href={`/providers/${encodeURIComponent(detail.provider.id)}`}
                prefetch={false}
              >
                {detail.provider.businessName}
              </Link>
            </dd>
            <dt>{t.providerAddressLabel}</dt>
            <dd>{detail.provider.address}</dd>
            <dt>{vi.booking.serviceLabel}</dt>
            <dd>{detail.service.name}</dd>
            <dt>{vi.booking.durationLabel}</dt>
            <dd>
              {formatDuration(detail.service.durationMinutes)}
              <br />
              <small>{t.currentDurationHint}</small>
            </dd>
            <dt>{t.bookedPriceLabel}</dt>
            <dd>{formatPrice(detail.bookedPrice)}</dd>
            <dt>{vi.booking.appointmentLabel}</dt>
            <dd>
              {formatVietnamAppointment(detail.slot)} · {TIME_ZONE}
            </dd>
            <dt>{vi.booking.petLabel}</dt>
            <dd>
              {detail.pet.name} · {detail.pet.petType.name}
              {detail.pet.breed ? ` · ${detail.pet.breed}` : ""}
            </dd>
            <dt>{vi.booking.note}</dt>
            <dd>{detail.customerNote ?? "—"}</dd>
            <dt>{t.createdAtLabel}</dt>
            <dd>
              {formatVietnamDateTime(detail.createdAt)} · {TIME_ZONE}
            </dd>
          </dl>

          <div className={styles.actions}>
            {eligibility?.eligible && (
              <button
                type="button"
                className={styles.primary}
                onClick={handleOpenCancel}
              >
                {vi.booking.cancel}
              </button>
            )}
            {eligibility &&
              !eligibility.eligible &&
              eligibility.reasonCode === "CANCEL_TIME" && (
                <button
                  type="button"
                  className={styles.primary}
                  disabled
                  aria-describedby="live-cancel-locked-reason"
                >
                  {vi.booking.cancel}
                </button>
              )}
            <button
              type="button"
              className={styles.secondary}
              onClick={() => void loadDetail()}
            >
              {t.reloadDetail}
            </button>
          </div>

          {eligibility &&
            !eligibility.eligible &&
            eligibility.reasonCode === "CANCEL_TIME" && (
              <p id="live-cancel-locked-reason">{t.cancelLockedByTime}</p>
            )}

          {detail.status === "COMPLETED" && (
            <p className={styles.count}>{t.feedbackDeferredNotice}</p>
          )}

          <h2>{vi.booking.timeline}</h2>
          {detail.statusLogs.length === 0 ? (
            <p className={styles.count}>{t.noStatusLogs}</p>
          ) : (
            <ol className={styles.timeline}>
              {detail.statusLogs.map((log) => (
                <li key={log.id}>
                  {log.oldStatus === null
                    ? vi.booking.statuses[log.newStatus]
                    : formatMessage(t.statusTransition, {
                        from: vi.booking.statuses[log.oldStatus],
                        to: vi.booking.statuses[log.newStatus],
                      })}
                  <time dateTime={log.createdAt}>
                    {formatVietnamDateTime(log.createdAt)} · {TIME_ZONE}
                  </time>
                  {log.reason && (
                    <p>{formatMessage(t.logReason, { reason: log.reason })}</p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </article>
      )}

      {dialogOpen && detail && (
        <CustomerDialog
          title={formatMessage(vi.booking.cancelTitle, {
            bookingId: detail.id,
          })}
          description={t.cancelDescription}
          busy={cancelInFlight}
          onClose={handleCloseCancel}
          returnFocusId="live-booking-detail-title"
        >
          {cancelState.phase === "unknown" ||
          cancelState.phase === "reconciling" ? (
            <div className={styles.steps}>
              <div className={styles.notice} role="status">
                <p>
                  <strong>{t.cancelUnknownTitle}</strong>
                </p>
                <p>{t.cancelUnknownDescription}</p>
              </div>
              <label className={styles.field}>
                {vi.booking.reasonOptional}
                <textarea value={cancelState.reason} disabled readOnly />
              </label>
              {cancelState.phase === "unknown" &&
                cancelState.reconcileError && (
                  <p className={styles.error} role="alert">
                    {t.errors[cancelState.reconcileError.code]}
                  </p>
                )}
              {cooldownSeconds > 0 && (
                <p role="status">
                  {formatMessage(t.cooldownWait, { seconds: cooldownSeconds })}
                </p>
              )}
              <div className={styles.dialogActions}>
                <button
                  type="button"
                  className={styles.primary}
                  disabled={cancelInFlight || cooldownSeconds > 0}
                  onClick={() => void handleReconcileCancel()}
                >
                  {cancelState.phase === "reconciling"
                    ? t.cancelReconciling
                    : t.cancelReconcileAction}
                </button>
                <button
                  type="button"
                  className={styles.secondary}
                  disabled={cancelInFlight}
                  onClick={handleCloseCancel}
                >
                  {t.cancelCloseAndRefresh}
                </button>
              </div>
            </div>
          ) : (
            <form
              className={styles.steps}
              onSubmit={(event) => void handleSubmitCancel(event)}
              aria-busy={cancelInFlight}
            >
              {dialogNotice && (
                <p className={styles.notice} role="status">
                  {dialogNotice}
                </p>
              )}
              <label className={styles.field}>
                {vi.booking.reasonOptional}
                <textarea
                  ref={reasonRef}
                  value={
                    cancelState.phase === "confirming" ||
                    cancelState.phase === "submitting" ||
                    cancelState.phase === "failed"
                      ? cancelState.reason
                      : ""
                  }
                  placeholder={t.cancelReasonPlaceholder}
                  disabled={
                    cancelInFlight ||
                    (cancelState.phase === "failed" && !cancelState.canRetry)
                  }
                  onChange={(event) =>
                    commitCancel(
                      updateCancelReason(cancelRef.current, event.target.value),
                    )
                  }
                />
              </label>
              {cancelState.phase === "failed" && (
                <p className={styles.error} role="alert">
                  {t.errors[cancelState.error.code]}
                </p>
              )}
              {cooldownSeconds > 0 && (
                <p role="status">
                  {formatMessage(t.cooldownWait, { seconds: cooldownSeconds })}
                </p>
              )}
              <div className={styles.dialogActions}>
                <button
                  type="submit"
                  className={styles.primary}
                  disabled={
                    cancelInFlight ||
                    cooldownSeconds > 0 ||
                    (cancelState.phase === "failed" && !cancelState.canRetry)
                  }
                >
                  {cancelState.phase === "submitting"
                    ? vi.booking.working
                    : vi.booking.confirmCancel}
                </button>
                <button
                  type="button"
                  className={styles.secondary}
                  disabled={cancelInFlight}
                  onClick={handleCloseCancel}
                >
                  {vi.booking.keep}
                </button>
              </div>
            </form>
          )}
        </CustomerDialog>
      )}
    </section>
  );
}
