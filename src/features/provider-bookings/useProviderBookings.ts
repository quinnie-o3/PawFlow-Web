"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, isRequestCancelled } from "@/lib/api/errors";
import { formatMessage, vi } from "@/lib/locale";
import { snapshot } from "../session/client";
import {
  classifyProviderError,
  completeProviderBooking,
  confirmProviderBooking,
  getProviderBookingDetail,
  listProviderBookings,
  noShowProviderBooking,
  rejectProviderBooking,
  type ProviderApiErrorInfo,
  type ProviderBooking,
} from "../provider-workspace/liveApi";
import {
  getProviderErrorMessage,
  providerSessionIdentityKey,
} from "../provider-workspace/lifecycle";
import { useProviderProfile } from "../provider-workspace/useProviderProfile";
import {
  ACTION_SOURCE_STATUS,
  BOOKING_STATUS_LABELS,
  EMPTY_BOOKING_DETAIL,
  EMPTY_BOOKING_DRAFT,
  EMPTY_PENDING_UNKNOWN_BOOKINGS,
  buildReasonPayload,
  clearPendingUnknownBooking,
  createBookingDetailLoader,
  getPendingUnknownBooking,
  isBookingConflictOrNotFoundCode,
  reconcileUnknownMutation,
  recoverAbortedBookingDraft,
  storePendingUnknownBooking,
  type BookingDetailLoader,
  type FetchBookingDetailResult,
  type PendingUnknownBookingMap,
} from "./bookingLogic";
import type {
  BookingDetailLoadState,
  BookingDraftState,
  BookingFeedback,
  BookingListLoadState,
  ProviderBookingAction,
} from "./types";

const EMPTY_LIST: BookingListLoadState = {
  identity: null,
  status: "idle",
  bookings: [],
  error: null,
  reloading: false,
  refreshError: null,
};

const EMPTY_DETAIL: BookingDetailLoadState = EMPTY_BOOKING_DETAIL;

const EMPTY_DRAFT: BookingDraftState = EMPTY_BOOKING_DRAFT;

type ScopedSelection = Readonly<{
  identity: string | null;
  bookingId: string | null;
}>;

type ScopedFeedback = Readonly<{
  identity: string | null;
  feedback: BookingFeedback | null;
}>;

type ScopedDateFilters = Readonly<{
  identity: string | null;
  fromDate: string;
  toDate: string;
}>;

const EMPTY_SELECTION: ScopedSelection = { identity: null, bookingId: null };
const EMPTY_FEEDBACK: ScopedFeedback = { identity: null, feedback: null };
const EMPTY_DATE_FILTERS: ScopedDateFilters = {
  identity: null,
  fromDate: "",
  toDate: "",
};

function mergeUpdatedBooking(
  bookings: readonly ProviderBooking[],
  updated: ProviderBooking,
): ProviderBooking[] {
  let replaced = false;
  const next = bookings.map((item) => {
    if (item.id === updated.id) {
      replaced = true;
      return updated;
    }
    return item;
  });
  return replaced ? next : [updated, ...next];
}

export function useProviderBookings() {
  const profileState = useProviderProfile();
  const {
    sessionBoundary,
    status: profileStatus,
    markNotFound,
    reload: reloadProfile,
  } = profileState;
  const { canFetchPrivate, identity, resetPrivateState, hidePrivateData } =
    sessionBoundary;

  const [listState, setListState] = useState<BookingListLoadState>(EMPTY_LIST);
  const [selectionState, setSelectionState] =
    useState<ScopedSelection>(EMPTY_SELECTION);
  const [detailState, setDetailState] =
    useState<BookingDetailLoadState>(EMPTY_DETAIL);
  const [draftState, setDraftState] = useState<BookingDraftState>(EMPTY_DRAFT);
  const [pendingUnknownState, setPendingUnknownState] =
    useState<PendingUnknownBookingMap>(EMPTY_PENDING_UNKNOWN_BOOKINGS);
  const [feedbackState, setFeedbackState] =
    useState<ScopedFeedback>(EMPTY_FEEDBACK);
  const [dateFilterState, setDateFilterState] =
    useState<ScopedDateFilters>(EMPTY_DATE_FILTERS);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  const listControllerRef = useRef<AbortController | null>(null);
  const detailLoaderRef = useRef<BookingDetailLoader | null>(null);
  const mutationControllerRef = useRef<AbortController | null>(null);
  const pendingUnknownRef = useRef<PendingUnknownBookingMap>(
    EMPTY_PENDING_UNKNOWN_BOOKINGS,
  );
  const listRequestIdRef = useRef(0);
  const submittingRef = useRef(false);
  const currentIdentityRef = useRef<string | null>(identity);
  const canFetchRef = useRef(canFetchPrivate);
  const lockActionsRef = useRef(sessionBoundary.lockActions);
  const selectedBookingIdRef = useRef<string | null>(null);
  const profileStatusRef = useRef(profileStatus);

  const preservedIdentity = !resetPrivateState && identity !== null;

  const selectedBookingId =
    preservedIdentity && selectionState.identity === identity
      ? selectionState.bookingId
      : null;

  useEffect(() => {
    pendingUnknownRef.current = pendingUnknownState;
  }, [pendingUnknownState]);

  useEffect(() => {
    currentIdentityRef.current = identity;
    canFetchRef.current = canFetchPrivate;
    lockActionsRef.current = sessionBoundary.lockActions;
    selectedBookingIdRef.current = selectedBookingId;
    profileStatusRef.current = profileStatus;
  }, [
    identity,
    canFetchPrivate,
    sessionBoundary.lockActions,
    selectedBookingId,
    profileStatus,
  ]);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setCooldownSeconds((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownSeconds]);

  const applyCooldown = useCallback((info: ProviderApiErrorInfo) => {
    if (
      info.outcome === "rate-limited" &&
      info.retryAfterSeconds &&
      info.retryAfterSeconds > 0
    ) {
      setCooldownSeconds((prev) =>
        Math.max(prev, info.retryAfterSeconds ?? 0),
      );
    }
  }, []);

  const getDetailLoader = useCallback((): BookingDetailLoader => {
    if (!detailLoaderRef.current) {
      detailLoaderRef.current = createBookingDetailLoader({
        fetchDetail: (id, options) => getProviderBookingDetail(id, options),
        classifyError: (err) => classifyProviderError(err, "get-booking"),
        onStateChange: setDetailState,
        onDetailLoaded: (targetIdentity, detail) => {
          setListState((current) =>
            current.identity === targetIdentity && current.status === "ready"
              ? {
                  ...current,
                  bookings: mergeUpdatedBooking(current.bookings, detail),
                }
              : current,
          );
        },
        onErrorInfo: applyCooldown,
        onProfileNotFound: markNotFound,
        initialIdentity: currentIdentityRef.current,
        initialCanFetch: canFetchRef.current,
      });
    }
    return detailLoaderRef.current;
  }, [applyCooldown, markNotFound]);

  // Manage <Activity mode="hidden"> cleanup and automatic same-identity recovery
  // when returning to <Activity mode="visible"> after a transient 503 revalidate.
  useEffect(() => {
    const loader = getDetailLoader();
    void loader.syncSession({
      identity: currentIdentityRef.current,
      canFetch: canFetchRef.current,
      selectedBookingId: selectedBookingIdRef.current,
      profileNotFound: profileStatusRef.current === "not-found",
    });
    return () => {
      loader.interruptForHide();
      listControllerRef.current?.abort();
      listControllerRef.current = null;
      mutationControllerRef.current?.abort();
      mutationControllerRef.current = null;
    };
  }, [getDetailLoader]);

  // Keep detail loader synchronized with reactive session/selection transitions.
  useEffect(() => {
    const loader = getDetailLoader();
    void loader.syncSession({
      identity,
      canFetch: canFetchPrivate,
      selectedBookingId,
      profileNotFound: profileStatus === "not-found",
    });
  }, [
    canFetchPrivate,
    getDetailLoader,
    identity,
    profileStatus,
    selectedBookingId,
  ]);

  // Purge all private state asynchronously on 401/logout/role change/identity switch.
  // On same-identity session revalidate error (resetPrivateState === false),
  // preserve date filters, selected booking, action draft & reason in memory.
  useEffect(() => {
    if (!resetPrivateState) return;
    listRequestIdRef.current++;
    listControllerRef.current?.abort();
    detailLoaderRef.current?.resetPrivate();
    mutationControllerRef.current?.abort();
    listControllerRef.current = null;
    mutationControllerRef.current = null;
    submittingRef.current = false;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setListState(EMPTY_LIST);
      setSelectionState(EMPTY_SELECTION);
      setDetailState(EMPTY_DETAIL);
      setDraftState(EMPTY_DRAFT);
      setPendingUnknownState(EMPTY_PENDING_UNKNOWN_BOOKINGS);
      setFeedbackState(EMPTY_FEEDBACK);
      setDateFilterState(EMPTY_DATE_FILTERS);
      setCooldownSeconds(0);
    });
    return () => {
      cancelled = true;
    };
  }, [resetPrivateState]);

  const fetchBookingsList = useCallback(
    async (mode: "initial" | "refresh"): Promise<ProviderBooking[] | null> => {
      const targetIdentity = currentIdentityRef.current;
      if (!canFetchRef.current || !targetIdentity) return null;

      const controller = new AbortController();
      listControllerRef.current?.abort();
      listControllerRef.current = controller;
      const requestId = ++listRequestIdRef.current;

      if (mode === "refresh") {
        setListState((current) =>
          current.identity === targetIdentity
            ? { ...current, reloading: true, refreshError: null }
            : {
                identity: targetIdentity,
                status: "loading",
                bookings: [],
                error: null,
                reloading: true,
                refreshError: null,
              },
        );
      }

      try {
        const bookings = await listProviderBookings({
          signal: controller.signal,
        });
        if (
          controller.signal.aborted ||
          listRequestIdRef.current !== requestId ||
          currentIdentityRef.current !== targetIdentity
        ) {
          return null;
        }
        setListState({
          identity: targetIdentity,
          status: "ready",
          bookings,
          error: null,
          reloading: false,
          refreshError: null,
        });
        return bookings;
      } catch (err) {
        if (
          isRequestCancelled(err) ||
          controller.signal.aborted ||
          listRequestIdRef.current !== requestId ||
          currentIdentityRef.current !== targetIdentity
        ) {
          if (
            currentIdentityRef.current === targetIdentity &&
            listRequestIdRef.current === requestId
          ) {
            setListState((current) =>
              current.identity === targetIdentity
                ? {
                    ...current,
                    status:
                      current.status === "loading" ? "idle" : current.status,
                    reloading: false,
                  }
                : current,
            );
          }
          return null;
        }
        const info = classifyProviderError(err, "list-bookings");
        applyCooldown(info);
        if (info.outcome === "session-ended") {
          setListState(EMPTY_LIST);
          return null;
        }
        if (info.code === "PROVIDER_PROFILE_NOT_FOUND") {
          markNotFound();
          setListState({
            identity: targetIdentity,
            status: "idle",
            bookings: [],
            error: info,
            reloading: false,
            refreshError: null,
          });
          return null;
        }
        setListState((current) =>
          current.identity === targetIdentity && current.status === "ready"
            ? { ...current, reloading: false, refreshError: info }
            : {
                identity: targetIdentity,
                status: "error",
                bookings: [],
                error: info,
                reloading: false,
                refreshError: null,
              },
        );
        return null;
      } finally {
        if (listControllerRef.current === controller) {
          listControllerRef.current = null;
        }
      }
    },
    [applyCooldown, markNotFound],
  );

  // Initial list fetch when an owner session is ready and profile is not missing.
  useEffect(() => {
    if (!canFetchPrivate || !identity || profileStatus === "not-found") {
      listControllerRef.current?.abort();
      listControllerRef.current = null;
      return;
    }

    const controller = new AbortController();
    listControllerRef.current?.abort();
    listControllerRef.current = controller;
    const requestId = ++listRequestIdRef.current;
    const targetIdentity = identity;

    listProviderBookings({ signal: controller.signal }).then(
      (bookings) => {
        if (
          controller.signal.aborted ||
          listRequestIdRef.current !== requestId ||
          currentIdentityRef.current !== targetIdentity
        ) {
          return;
        }
        setListState({
          identity: targetIdentity,
          status: "ready",
          bookings,
          error: null,
          reloading: false,
          refreshError: null,
        });
      },
      (err) => {
        if (
          isRequestCancelled(err) ||
          controller.signal.aborted ||
          listRequestIdRef.current !== requestId ||
          currentIdentityRef.current !== targetIdentity
        ) {
          return;
        }
        const info = classifyProviderError(err, "list-bookings");
        applyCooldown(info);
        if (info.outcome === "session-ended") {
          setListState(EMPTY_LIST);
          return;
        }
        if (info.code === "PROVIDER_PROFILE_NOT_FOUND") {
          markNotFound();
          setListState({
            identity: targetIdentity,
            status: "idle",
            bookings: [],
            error: info,
            reloading: false,
            refreshError: null,
          });
          return;
        }
        setListState((current) =>
          current.identity === targetIdentity && current.status === "ready"
            ? { ...current, reloading: false, refreshError: info }
            : {
                identity: targetIdentity,
                status: "error",
                bookings: [],
                error: info,
                reloading: false,
                refreshError: null,
              },
        );
      },
    );

    return () => {
      controller.abort();
      if (listControllerRef.current === controller) {
        listControllerRef.current = null;
      }
    };
  }, [canFetchPrivate, identity, profileStatus, markNotFound, applyCooldown]);

  const fetchBookingDetail = useCallback(
    (bookingId: string): Promise<FetchBookingDetailResult> => {
      return getDetailLoader().load(bookingId);
    },
    [getDetailLoader],
  );

  const openBooking = useCallback(
    (bookingId: string) => {
      const targetIdentity = currentIdentityRef.current;
      if (!targetIdentity || lockActionsRef.current) return;
      selectedBookingIdRef.current = bookingId;
      setSelectionState({ identity: targetIdentity, bookingId });
      setFeedbackState(EMPTY_FEEDBACK);
      const preservedUnknown = getPendingUnknownBooking(
        pendingUnknownRef.current,
        targetIdentity,
        bookingId,
      );
      setDraftState((current) => {
        if (preservedUnknown) return preservedUnknown;
        return current.identity === targetIdentity &&
          current.bookingId === bookingId
          ? current
          : {
              identity: targetIdentity,
              bookingId,
              action: null,
              reason: "",
              openedAtMs: null,
              phase: "idle",
              error: null,
              reconcileError: null,
            };
      });
      void getDetailLoader().selectAndLoad(targetIdentity, bookingId);
    },
    [getDetailLoader],
  );

  const closeBooking = useCallback(() => {
    if (submittingRef.current) return;
    selectedBookingIdRef.current = null;
    detailLoaderRef.current?.closeSelection();
    setSelectionState(EMPTY_SELECTION);
    setDetailState(EMPTY_DETAIL);
    // R2: preserve any unknown draft in pendingUnknownState; only clear non-unknown active draft.
    setDraftState((current) =>
      current.phase === "unknown" ? current : EMPTY_DRAFT,
    );
  }, []);

  const beginAction = useCallback((bookingId: string, action: ProviderBookingAction) => {
    const targetIdentity = currentIdentityRef.current;
    if (!targetIdentity || submittingRef.current || lockActionsRef.current) return;
    setDraftState({
      identity: targetIdentity,
      bookingId,
      action,
      reason: "",
      openedAtMs: Date.now(),
      phase: "idle",
      error: null,
      reconcileError: null,
    });
  }, []);

  const cancelAction = useCallback(() => {
    if (submittingRef.current) return;
    const targetIdentity = currentIdentityRef.current;
    setDraftState((current) => ({
      identity: targetIdentity,
      bookingId: current.bookingId,
      action: null,
      reason: "",
      openedAtMs: null,
      phase: "idle",
      error: null,
      reconcileError: null,
    }));
  }, []);

  const updateReason = useCallback((nextReason: string) => {
    setDraftState((current) => ({
      ...current,
      reason: nextReason,
      error: null,
    }));
  }, []);

  const setDateRange = useCallback((fromDate: string, toDate: string) => {
    const targetIdentity = currentIdentityRef.current;
    setDateFilterState({
      identity: targetIdentity,
      fromDate,
      toDate,
    });
  }, []);

  const submitAction = useCallback(
    async (bookingId: string, action: ProviderBookingAction, reason: string) => {
      const targetIdentity = currentIdentityRef.current;
      if (
        !targetIdentity ||
        !canFetchRef.current ||
        lockActionsRef.current ||
        submittingRef.current
      ) {
        return;
      }

      submittingRef.current = true;
      const controller = new AbortController();
      mutationControllerRef.current?.abort();
      mutationControllerRef.current = controller;

      setDraftState((current) => ({
        identity: targetIdentity,
        bookingId,
        action,
        reason,
        openedAtMs: current.openedAtMs ?? Date.now(),
        phase: "submitting",
        error: null,
        reconcileError: null,
      }));

      const operation =
        action === "confirm"
          ? "confirm-booking"
          : action === "reject"
            ? "reject-booking"
            : action === "complete"
              ? "complete-booking"
              : "no-show-booking";

      try {
        let updated: ProviderBooking;
        if (action === "confirm") {
          updated = await confirmProviderBooking(bookingId, {
            signal: controller.signal,
          });
        } else if (action === "reject") {
          updated = await rejectProviderBooking(
            bookingId,
            buildReasonPayload(reason),
            { signal: controller.signal },
          );
        } else if (action === "complete") {
          updated = await completeProviderBooking(bookingId, {
            signal: controller.signal,
          });
        } else {
          updated = await noShowProviderBooking(
            bookingId,
            buildReasonPayload(reason),
            { signal: controller.signal },
          );
        }

        const liveIdentity = providerSessionIdentityKey(snapshot());
        if (
          liveIdentity !== targetIdentity ||
          currentIdentityRef.current !== targetIdentity
        ) {
          return;
        }
        if (controller.signal.aborted) {
          const fallbackError = classifyProviderError(
            new ApiError("network"),
            operation,
          );
          const recovered: BookingDraftState = {
            identity: targetIdentity,
            bookingId,
            action,
            reason,
            openedAtMs: Date.now(),
            phase: "unknown",
            error: fallbackError,
            reconcileError: null,
          };
          setDraftState((current) =>
            recoverAbortedBookingDraft(
              current,
              targetIdentity,
              liveIdentity,
              fallbackError,
            ),
          );
          setPendingUnknownState((map) =>
            storePendingUnknownBooking(map, recovered),
          );
          return;
        }

        setListState((current) =>
          current.identity === targetIdentity
            ? {
                ...current,
                bookings: mergeUpdatedBooking(current.bookings, updated),
              }
            : current,
        );
        setPendingUnknownState((map) =>
          clearPendingUnknownBooking(map, targetIdentity, bookingId),
        );
        setDraftState({
          identity: targetIdentity,
          bookingId,
          action: null,
          reason: "",
          openedAtMs: null,
          phase: "idle",
          error: null,
          reconcileError: null,
        });
        setFeedbackState({
          identity: targetIdentity,
          feedback: {
            bookingId,
            tone: "success",
            message: formatMessage(vi.provider.bookings.feedback.statusUpdated, {
              bookingId: updated.id,
              status: BOOKING_STATUS_LABELS[updated.status],
            }),
          },
        });

        await Promise.all([
          fetchBookingDetail(bookingId),
          fetchBookingsList("refresh"),
        ]);
      } catch (err) {
        if (isRequestCancelled(err) || controller.signal.aborted) {
          const liveIdentity = providerSessionIdentityKey(snapshot());
          const fallbackError = classifyProviderError(
            new ApiError("network"),
            operation,
          );
          if (liveIdentity !== targetIdentity) {
            setDraftState(EMPTY_DRAFT);
            setPendingUnknownState(EMPTY_PENDING_UNKNOWN_BOOKINGS);
            return;
          }
          const recoveredSnapshot: BookingDraftState = {
            identity: targetIdentity,
            bookingId,
            action,
            reason,
            openedAtMs: Date.now(),
            phase: "unknown",
            error: fallbackError,
            reconcileError: null,
          };
          setDraftState((current) =>
            recoverAbortedBookingDraft(
              current,
              targetIdentity,
              liveIdentity,
              fallbackError,
            ),
          );
          setPendingUnknownState((map) =>
            storePendingUnknownBooking(map, recoveredSnapshot),
          );
          return;
        }
        if (
          providerSessionIdentityKey(snapshot()) !== targetIdentity ||
          currentIdentityRef.current !== targetIdentity
        ) {
          return;
        }
        const info = classifyProviderError(err, operation);
        applyCooldown(info);

        if (info.outcome === "session-ended") {
          setDraftState(EMPTY_DRAFT);
          setPendingUnknownState(EMPTY_PENDING_UNKNOWN_BOOKINGS);
          return;
        }

        if (info.outcome === "unknown") {
          // NEVER auto-retry POST; preserve reason draft and require explicit server reconciliation.
          const unknownSnapshot: BookingDraftState = {
            identity: targetIdentity,
            bookingId,
            action,
            reason,
            openedAtMs: Date.now(),
            phase: "unknown",
            error: info,
            reconcileError: null,
          };
          setDraftState((current) => ({
            identity: targetIdentity,
            bookingId,
            action,
            reason,
            openedAtMs: current.openedAtMs,
            phase: "unknown",
            error: info,
            reconcileError: null,
          }));
          setPendingUnknownState((map) =>
            storePendingUnknownBooking(map, unknownSnapshot),
          );
          return;
        }

        if (info.code === "PROVIDER_CONFIRM_FORBIDDEN") {
          setDraftState({
            identity: targetIdentity,
            bookingId,
            action: null,
            reason: "",
            openedAtMs: null,
            phase: "idle",
            error: null,
            reconcileError: null,
          });
          setFeedbackState({
            identity: targetIdentity,
            feedback: {
              bookingId,
              tone: "error",
              message: getProviderErrorMessage(info),
            },
          });
          await Promise.all([
            reloadProfile(),
            fetchBookingDetail(bookingId),
            fetchBookingsList("refresh"),
          ]);
          return;
        }

        if (info.code === "PROVIDER_PROFILE_NOT_FOUND") {
          markNotFound();
          setDraftState(EMPTY_DRAFT);
          return;
        }

        if (isBookingConflictOrNotFoundCode(info.code)) {
          // Auto-reconcile both detail and list on 409 / 404 (e.g., customer just cancelled).
          const [detailResult] = await Promise.all([
            fetchBookingDetail(bookingId),
            fetchBookingsList("refresh"),
          ]);
          if (currentIdentityRef.current !== targetIdentity) return;

          const baseMessage = getProviderErrorMessage(info);
          const stillInSourceStatus =
            detailResult.ok &&
            detailResult.detail.status === ACTION_SOURCE_STATUS[action];

          if (stillInSourceStatus) {
            setDraftState((current) => ({
              identity: targetIdentity,
              bookingId,
              action,
              reason,
              openedAtMs: current.openedAtMs,
              phase: "idle",
              error: info,
              reconcileError: null,
            }));
          } else {
            setDraftState({
              identity: targetIdentity,
              bookingId,
              action: null,
              reason: "",
              openedAtMs: null,
              phase: "idle",
              error: null,
              reconcileError: null,
            });
            setFeedbackState({
              identity: targetIdentity,
              feedback: {
                bookingId,
                tone: "error",
                message: formatMessage(
                  vi.provider.bookings.feedback.conflictSynced,
                  { message: baseMessage },
                ),
              },
            });
          }
          return;
        }

        setDraftState((current) => ({
          identity: targetIdentity,
          bookingId,
          action,
          reason,
          openedAtMs: current.openedAtMs,
          phase: "idle",
          error: info,
          reconcileError: null,
        }));
      } finally {
        if (mutationControllerRef.current === controller) {
          mutationControllerRef.current = null;
        }
        submittingRef.current = false;
      }
    },
    [applyCooldown, fetchBookingDetail, fetchBookingsList, markNotFound, reloadProfile],
  );

  const reconcileUnknown = useCallback(async () => {
    const targetIdentity = currentIdentityRef.current;
    if (
      !targetIdentity ||
      !canFetchRef.current ||
      lockActionsRef.current ||
      submittingRef.current
    ) {
      return;
    }
    const targetBookingId = draftState.bookingId;
    const targetAction = draftState.action;
    if (!targetBookingId || !targetAction) return;

    submittingRef.current = true;
    setDraftState((current) => ({
      ...current,
      phase: "reconciling",
      reconcileError: null,
    }));

    try {
      const [detailResult] = await Promise.all([
        fetchBookingDetail(targetBookingId),
        fetchBookingsList("refresh"),
        reloadProfile(),
      ]);

      const liveIdentity = providerSessionIdentityKey(snapshot());
      if (
        liveIdentity !== targetIdentity ||
        currentIdentityRef.current !== targetIdentity
      ) {
        return;
      }

      if (!detailResult.ok) {
        if (detailResult.aborted) {
          const fallbackError = classifyProviderError(
            new ApiError("network"),
            "get-booking",
          );
          setDraftState((current) =>
            recoverAbortedBookingDraft(
              current,
              targetIdentity,
              liveIdentity,
              current.error ?? fallbackError,
            ),
          );
          return;
        }
        if (detailResult.notFound) {
          setPendingUnknownState((map) =>
            clearPendingUnknownBooking(map, targetIdentity, targetBookingId),
          );
          setDraftState({
            identity: targetIdentity,
            bookingId: targetBookingId,
            action: null,
            reason: "",
            openedAtMs: null,
            phase: "idle",
            error: null,
            reconcileError: null,
          });
          setFeedbackState({
            identity: targetIdentity,
            feedback: {
              bookingId: targetBookingId,
              tone: "error",
              message: formatMessage(vi.provider.bookings.unknown.notFound, {
                bookingId: targetBookingId,
              }),
            },
          });
          return;
        }
        setDraftState((current) => ({
          ...current,
          phase: "unknown",
          reconcileError: detailResult.error,
        }));
        setPendingUnknownState((map) => {
          const existing = getPendingUnknownBooking(
            map,
            targetIdentity,
            targetBookingId,
          );
          if (!existing) return map;
          return storePendingUnknownBooking(map, {
            ...existing,
            reconcileError: detailResult.error,
          });
        });
        return;
      }

      const outcome = reconcileUnknownMutation(
        detailResult.detail.status,
        targetAction,
      );
      const statusLabel = BOOKING_STATUS_LABELS[detailResult.detail.status];
      setPendingUnknownState((map) =>
        clearPendingUnknownBooking(map, targetIdentity, targetBookingId),
      );

      if (outcome === "applied") {
        setDraftState({
          identity: targetIdentity,
          bookingId: targetBookingId,
          action: null,
          reason: "",
          openedAtMs: null,
          phase: "idle",
          error: null,
          reconcileError: null,
        });
        setFeedbackState({
          identity: targetIdentity,
          feedback: {
            bookingId: targetBookingId,
            tone: "success",
            message: formatMessage(vi.provider.bookings.unknown.applied, {
              bookingId: targetBookingId,
              status: statusLabel,
            }),
          },
        });
      } else if (outcome === "changed-elsewhere") {
        setDraftState({
          identity: targetIdentity,
          bookingId: targetBookingId,
          action: null,
          reason: "",
          openedAtMs: null,
          phase: "idle",
          error: null,
          reconcileError: null,
        });
        setFeedbackState({
          identity: targetIdentity,
          feedback: {
            bookingId: targetBookingId,
            tone: "warning",
            message: formatMessage(
              vi.provider.bookings.unknown.changedElsewhere,
              {
                bookingId: targetBookingId,
                status: statusLabel,
              },
            ),
          },
        });
      } else {
        // Still in source status: unlock submit while preserving reason draft!
        setDraftState((current) => ({
          ...current,
          phase: "idle",
          error: null,
          reconcileError: null,
        }));
        setFeedbackState({
          identity: targetIdentity,
          feedback: {
            bookingId: targetBookingId,
            tone: "warning",
            message: formatMessage(vi.provider.bookings.unknown.notApplied, {
              bookingId: targetBookingId,
              status: statusLabel,
            }),
          },
        });
      }
    } finally {
      submittingRef.current = false;
    }
  }, [draftState.action, draftState.bookingId, fetchBookingDetail, fetchBookingsList, reloadProfile]);

  const reloadAll = useCallback(async () => {
    if (cooldownSeconds > 0 || lockActionsRef.current) return;
    await Promise.all([reloadProfile(), fetchBookingsList("refresh")]);
  }, [cooldownSeconds, fetchBookingsList, reloadProfile]);

  const matchesVisibleIdentity =
    !hidePrivateData &&
    !resetPrivateState &&
    identity !== null &&
    listState.identity === identity;

  const listStatus: "idle" | "loading" | "ready" | "error" =
    hidePrivateData || resetPrivateState
      ? "idle"
      : !matchesVisibleIdentity || listState.status === "idle"
        ? profileStatus === "not-found"
          ? "idle"
          : "loading"
        : listState.status;

  const bookings =
    matchesVisibleIdentity && listState.status === "ready"
      ? listState.bookings
      : [];

  const activeDraft: BookingDraftState =
    preservedIdentity && draftState.identity === identity
      ? draftState
      : EMPTY_DRAFT;

  const activeDetail: BookingDetailLoadState =
    !hidePrivateData &&
    !resetPrivateState &&
    identity !== null &&
    detailState.identity === identity
      ? detailState
      : EMPTY_DETAIL;

  const activeFeedback =
    matchesVisibleIdentity && feedbackState.identity === identity
      ? feedbackState.feedback
      : null;

  const activeDateFilters =
    preservedIdentity && dateFilterState.identity === identity
      ? { fromDate: dateFilterState.fromDate, toDate: dateFilterState.toDate }
      : { fromDate: "", toDate: "" };

  // Unmount <dialog> whenever private data is hidden (including same-identity revalidate error)
  // to release top-layer backdrop while keeping selectedBookingId & draft preserved in memory.
  const showDetailDialog =
    Boolean(selectedBookingId) &&
    !sessionBoundary.closeDialog &&
    !sessionBoundary.hidePrivateData &&
    profileState.status !== "not-found";

  return {
    profileState,
    sessionBoundary,
    listStatus,
    bookings,
    listError: matchesVisibleIdentity ? listState.error : null,
    refreshError: matchesVisibleIdentity ? listState.refreshError : null,
    reloading: matchesVisibleIdentity ? listState.reloading : false,
    cooldownSeconds,
    selectedBookingId,
    showDetailDialog,
    detailState: activeDetail,
    draftState: activeDraft,
    feedback: activeFeedback,
    dateFilters: activeDateFilters,
    setDateRange,
    reloadAll,
    retryList: () => void fetchBookingsList("refresh"),
    openBooking,
    closeBooking,
    retryDetail: (id: string) => void fetchBookingDetail(id),
    beginAction,
    cancelAction,
    updateReason,
    submitAction,
    reconcileUnknown,
  };
}
