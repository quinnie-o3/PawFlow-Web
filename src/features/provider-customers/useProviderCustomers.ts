"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isRequestCancelled } from "@/lib/api/errors";
import { useDebouncedSearch } from "@/hooks/useDebouncedSearch";
import {
  classifyProviderError,
  listProviderBookings,
  type ProviderApiErrorInfo,
  type ProviderBooking,
} from "../provider-workspace/liveApi";
import { useProviderProfile } from "../provider-workspace/useProviderProfile";
import {
  buildLiveCustomerRecords,
  filterLiveCustomers,
  getPresetCustomerRange,
  summarizeLiveCustomers,
} from "./customerLogic";
import type {
  CustomerFilters,
  CustomerPeriodPreset,
  CustomersPeriodMode,
  ReportingRange,
} from "./types";

type BookingsLoadState = Readonly<{
  identity: string | null;
  status: "idle" | "loading" | "ready" | "error";
  bookings: readonly ProviderBooking[];
  error: ProviderApiErrorInfo | null;
  reloading: boolean;
  refreshError: ProviderApiErrorInfo | null;
}>;

type ScopedUiState = Readonly<{
  identity: string | null;
  periodMode: CustomersPeriodMode;
  preset: CustomerPeriodPreset;
  range: ReportingRange;
  filters: CustomerFilters;
  selectedId: string | null;
  dialogOpen: boolean;
}>;

const EMPTY_LOAD: BookingsLoadState = {
  identity: null,
  status: "idle",
  bookings: [],
  error: null,
  reloading: false,
  refreshError: null,
};

function createDefaultUiState(nowMs: number): ScopedUiState {
  return {
    identity: null,
    periodMode: "range",
    preset: "30d",
    range: getPresetCustomerRange("30d", nowMs),
    filters: { query: "", group: "all" },
    selectedId: null,
    dialogOpen: false,
  };
}

export function useProviderCustomers() {
  const profileState = useProviderProfile();
  const {
    sessionBoundary,
    status: profileStatus,
    markNotFound,
    reload: reloadProfile,
  } = profileState;
  const { canFetchPrivate, identity, resetPrivateState, hidePrivateData } =
    sessionBoundary;

  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [loadState, setLoadState] = useState<BookingsLoadState>(EMPTY_LOAD);
  const [uiState, setUiState] = useState<ScopedUiState>(() =>
    createDefaultUiState(nowMs),
  );
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  const controllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const currentIdentityRef = useRef<string | null>(identity);
  const canFetchRef = useRef(canFetchPrivate);
  const lockActionsRef = useRef(sessionBoundary.lockActions);

  useEffect(() => {
    currentIdentityRef.current = identity;
    canFetchRef.current = canFetchPrivate;
    lockActionsRef.current = sessionBoundary.lockActions;
  }, [identity, canFetchPrivate, sessionBoundary.lockActions]);

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

  // Purge private customer data & filters asynchronously on 401/logout/identity switch.
  // Keep filters/period/selection in memory on same-identity session-error revalidate.
  useEffect(() => {
    if (!resetPrivateState) return;
    requestIdRef.current++;
    controllerRef.current?.abort();
    controllerRef.current = null;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      const freshNow = Date.now();
      setNowMs(freshNow);
      setLoadState(EMPTY_LOAD);
      setUiState(createDefaultUiState(freshNow));
      setCooldownSeconds(0);
    });
    return () => {
      cancelled = true;
    };
  }, [resetPrivateState]);

  useEffect(() => {
    if (!canFetchPrivate || !identity || profileStatus === "not-found") {
      controllerRef.current?.abort();
      controllerRef.current = null;
      return;
    }

    const controller = new AbortController();
    controllerRef.current?.abort();
    controllerRef.current = controller;
    const requestId = ++requestIdRef.current;
    const targetIdentity = identity;

    listProviderBookings({ signal: controller.signal }).then(
      (bookings) => {
        if (
          controller.signal.aborted ||
          requestIdRef.current !== requestId ||
          currentIdentityRef.current !== targetIdentity
        ) {
          return;
        }
        setNowMs(Date.now());
        setLoadState({
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
          requestIdRef.current !== requestId ||
          currentIdentityRef.current !== targetIdentity
        ) {
          return;
        }
        const info = classifyProviderError(err, "list-bookings");
        applyCooldown(info);
        if (info.outcome === "session-ended") {
          setLoadState(EMPTY_LOAD);
          return;
        }
        if (info.code === "PROVIDER_PROFILE_NOT_FOUND") {
          markNotFound();
          setLoadState({
            identity: targetIdentity,
            status: "idle",
            bookings: [],
            error: info,
            reloading: false,
            refreshError: null,
          });
          return;
        }
        setLoadState((current) =>
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
      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
    };
  }, [canFetchPrivate, identity, profileStatus, markNotFound, applyCooldown]);

  const reloadBookings = useCallback(async () => {
    const targetIdentity = currentIdentityRef.current;
    if (
      !canFetchRef.current ||
      !targetIdentity ||
      lockActionsRef.current ||
      cooldownSeconds > 0
    ) {
      return;
    }

    const controller = new AbortController();
    controllerRef.current?.abort();
    controllerRef.current = controller;
    const requestId = ++requestIdRef.current;

    setLoadState((current) =>
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

    try {
      const [bookings] = await Promise.all([
        listProviderBookings({ signal: controller.signal }),
        reloadProfile(),
      ]);
      if (
        controller.signal.aborted ||
        requestIdRef.current !== requestId ||
        currentIdentityRef.current !== targetIdentity
      ) {
        return;
      }
      setNowMs(Date.now());
      setLoadState({
        identity: targetIdentity,
        status: "ready",
        bookings,
        error: null,
        reloading: false,
        refreshError: null,
      });
    } catch (err) {
      if (
        isRequestCancelled(err) ||
        controller.signal.aborted ||
        requestIdRef.current !== requestId ||
        currentIdentityRef.current !== targetIdentity
      ) {
        return;
      }
      const info = classifyProviderError(err, "list-bookings");
      applyCooldown(info);
      if (info.outcome === "session-ended") {
        setLoadState(EMPTY_LOAD);
        return;
      }
      if (info.code === "PROVIDER_PROFILE_NOT_FOUND") {
        markNotFound();
        setLoadState({
          identity: targetIdentity,
          status: "idle",
          bookings: [],
          error: info,
          reloading: false,
          refreshError: null,
        });
        return;
      }
      setLoadState((current) =>
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
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
    }
  }, [applyCooldown, cooldownSeconds, markNotFound, reloadProfile]);

  const preservedIdentity = !resetPrivateState && identity !== null;
  const activeUi: ScopedUiState =
    preservedIdentity &&
    (uiState.identity === null || uiState.identity === identity)
      ? uiState
      : createDefaultUiState(nowMs);

  const activeRange: ReportingRange | null =
    activeUi.periodMode === "all-time" ? null : activeUi.range;

  const matchesVisibleIdentity =
    !hidePrivateData &&
    !resetPrivateState &&
    identity !== null &&
    loadState.identity === identity;

  const listStatus: "idle" | "loading" | "ready" | "error" =
    hidePrivateData || resetPrivateState
      ? "idle"
      : !matchesVisibleIdentity || loadState.status === "idle"
        ? profileStatus === "not-found"
          ? "idle"
          : "loading"
        : loadState.status;

  const bookings = useMemo(
    () =>
      matchesVisibleIdentity && loadState.status === "ready"
        ? loadState.bookings
        : [],
    [matchesVisibleIdentity, loadState.status, loadState.bookings],
  );

  const records = useMemo(
    () => buildLiveCustomerRecords(bookings, activeRange, nowMs),
    [bookings, activeRange, nowMs],
  );

  const report = useMemo(
    () => summarizeLiveCustomers(records, activeRange),
    [records, activeRange],
  );

  const debouncedQuery = useDebouncedSearch(activeUi.filters.query);

  const visibleRecords = useMemo(
    () =>
      filterLiveCustomers(records, {
        group: activeUi.filters.group,
        query: debouncedQuery,
      }),
    [records, activeUi.filters.group, debouncedQuery],
  );

  const selected =
    records.find((record) => record.customer.id === activeUi.selectedId) ??
    records[0] ??
    null;

  const setRange = useCallback((nextRange: ReportingRange) => {
    const targetIdentity = currentIdentityRef.current;
    setUiState((current) => ({
      ...current,
      identity: targetIdentity,
      periodMode: "range",
      range: nextRange,
    }));
  }, []);

  const selectPreset = useCallback((preset: CustomerPeriodPreset) => {
    const targetIdentity = currentIdentityRef.current;
    const freshNow = Date.now();
    setNowMs(freshNow);
    if (preset === "allTime") {
      setUiState((current) => ({
        ...current,
        identity: targetIdentity,
        periodMode: "all-time",
        preset: "allTime",
      }));
      return;
    }
    setUiState((current) => ({
      ...current,
      identity: targetIdentity,
      periodMode: "range",
      preset,
      range: getPresetCustomerRange(preset, freshNow),
    }));
  }, []);

  const setFilters = useCallback((nextFilters: CustomerFilters) => {
    const targetIdentity = currentIdentityRef.current;
    setUiState((current) => ({
      ...current,
      identity: targetIdentity,
      filters: nextFilters,
    }));
  }, []);

  const openCustomer = useCallback((customerId: string) => {
    const targetIdentity = currentIdentityRef.current;
    if (!targetIdentity || lockActionsRef.current) return;
    setUiState((current) => ({
      ...current,
      identity: targetIdentity,
      selectedId: customerId,
      dialogOpen: true,
    }));
  }, []);

  const closeDialog = useCallback(() => {
    setUiState((current) => ({
      ...current,
      dialogOpen: false,
    }));
  }, []);

  // Unmount <dialog> whenever private data is hidden (including same-identity revalidate error)
  // to release native top-layer backdrop while keeping filters/selection preserved in memory.
  const showDialog =
    activeUi.dialogOpen &&
    selected !== null &&
    !sessionBoundary.closeDialog &&
    !sessionBoundary.hidePrivateData &&
    profileStatus !== "not-found";

  return {
    profileState,
    sessionBoundary,
    listStatus,
    listError: matchesVisibleIdentity ? loadState.error : null,
    refreshError: matchesVisibleIdentity ? loadState.refreshError : null,
    reloading: matchesVisibleIdentity ? loadState.reloading : false,
    cooldownSeconds,
    periodMode: activeUi.periodMode,
    preset: activeUi.preset,
    range: activeUi.range,
    filters: activeUi.filters,
    records,
    visibleRecords,
    report,
    selected,
    showDialog,
    setRange,
    selectPreset,
    setFilters,
    openCustomer,
    closeDialog,
    reload: reloadBookings,
  };
}
