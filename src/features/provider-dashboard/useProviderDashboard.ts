"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isRequestCancelled } from "@/lib/api/errors";
import {
  classifyProviderError,
  getProviderDashboard,
  listMyAvailabilitySlots,
  listMyServices,
  listProviderBookings,
  type ProviderApiErrorInfo,
  type ProviderAvailabilitySlot,
  type ProviderBooking,
  type ProviderDashboard,
  type ProviderService,
} from "../provider-workspace/liveApi";
import { useProviderProfile } from "../provider-workspace/useProviderProfile";
import {
  buildBookingRequestsPreview,
  buildDashboardMetricCards,
  buildPrioritySummary,
  buildStatusSeriesFromBookings,
  createPresetDateRange,
  getVietnamTodayDate,
  localizeDssAlert,
} from "./data/dashboardAnalytics";
import type {
  DashboardRangePreset,
  DateRange,
  SetupHintsCounts,
} from "./types";

type DashboardLoadState = Readonly<{
  identity: string | null;
  periodKey: string | null;
  status: "idle" | "loading" | "ready" | "error";
  data: ProviderDashboard | null;
  error: ProviderApiErrorInfo | null;
  reloading: boolean;
}>;

type BookingsLoadState = Readonly<{
  identity: string | null;
  status: "idle" | "loading" | "ready" | "error";
  bookings: readonly ProviderBooking[];
  error: ProviderApiErrorInfo | null;
  reloading: boolean;
}>;

type SetupLookupState = Readonly<{
  identity: string | null;
  services: readonly ProviderService[];
  slots: readonly ProviderAvailabilitySlot[];
  loaded: boolean;
}>;

type ScopedRangeState = Readonly<{
  identity: string | null;
  preset: DashboardRangePreset;
  range: DateRange;
}>;

const EMPTY_DASHBOARD: DashboardLoadState = {
  identity: null,
  periodKey: null,
  status: "idle",
  data: null,
  error: null,
  reloading: false,
};

const EMPTY_BOOKINGS: BookingsLoadState = {
  identity: null,
  status: "idle",
  bookings: [],
  error: null,
  reloading: false,
};

const EMPTY_SETUP: SetupLookupState = {
  identity: null,
  services: [],
  slots: [],
  loaded: false,
};

function createDefaultRangeState(nowMs: number): ScopedRangeState {
  return {
    identity: null,
    preset: "30d",
    range: createPresetDateRange("30d", nowMs),
  };
}

export function useProviderDashboard() {
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
  const [rangeState, setRangeState] = useState<ScopedRangeState>(() =>
    createDefaultRangeState(nowMs),
  );
  const [dashboardState, setDashboardState] =
    useState<DashboardLoadState>(EMPTY_DASHBOARD);
  const [bookingsState, setBookingsState] =
    useState<BookingsLoadState>(EMPTY_BOOKINGS);
  const [setupState, setSetupState] = useState<SetupLookupState>(EMPTY_SETUP);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  const dashboardControllerRef = useRef<AbortController | null>(null);
  const bookingsControllerRef = useRef<AbortController | null>(null);
  const setupControllerRef = useRef<AbortController | null>(null);
  const dashboardRequestIdRef = useRef(0);
  const bookingsRequestIdRef = useRef(0);
  const setupRequestIdRef = useRef(0);
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

  // Purge all private dashboard state asynchronously on 401/logout/identity switch.
  // Preserve selected period & preset in memory on same-identity revalidate error.
  useEffect(() => {
    if (!resetPrivateState) return;
    dashboardRequestIdRef.current++;
    bookingsRequestIdRef.current++;
    setupRequestIdRef.current++;
    dashboardControllerRef.current?.abort();
    bookingsControllerRef.current?.abort();
    setupControllerRef.current?.abort();
    dashboardControllerRef.current = null;
    bookingsControllerRef.current = null;
    setupControllerRef.current = null;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      const freshNow = Date.now();
      setNowMs(freshNow);
      setRangeState(createDefaultRangeState(freshNow));
      setDashboardState(EMPTY_DASHBOARD);
      setBookingsState(EMPTY_BOOKINGS);
      setSetupState(EMPTY_SETUP);
      setCooldownSeconds(0);
    });
    return () => {
      cancelled = true;
    };
  }, [resetPrivateState]);

  const preservedIdentity = !resetPrivateState && identity !== null;
  const activeRangeState =
    preservedIdentity &&
    (rangeState.identity === null || rangeState.identity === identity)
      ? rangeState
      : createDefaultRangeState(nowMs);
  const activeRange = activeRangeState.range;
  const activePeriodKey = `${activeRange.start}:${activeRange.end}`;

  // Source 1: GET /dashboard/provider?from&to (isolated block for 6 KPIs & 5 DSS alerts).
  useEffect(() => {
    if (!canFetchPrivate || !identity || profileStatus === "not-found") {
      dashboardControllerRef.current?.abort();
      dashboardControllerRef.current = null;
      return;
    }

    const controller = new AbortController();
    dashboardControllerRef.current?.abort();
    dashboardControllerRef.current = controller;
    const requestId = ++dashboardRequestIdRef.current;
    const targetIdentity = identity;
    const targetPeriodKey = activePeriodKey;

    getProviderDashboard(
      { from: activeRange.start, to: activeRange.end },
      { signal: controller.signal },
    ).then(
      (data) => {
        if (
          controller.signal.aborted ||
          dashboardRequestIdRef.current !== requestId ||
          currentIdentityRef.current !== targetIdentity
        ) {
          return;
        }
        setDashboardState({
          identity: targetIdentity,
          periodKey: targetPeriodKey,
          status: "ready",
          data,
          error: null,
          reloading: false,
        });
      },
      (err) => {
        if (
          isRequestCancelled(err) ||
          controller.signal.aborted ||
          dashboardRequestIdRef.current !== requestId ||
          currentIdentityRef.current !== targetIdentity
        ) {
          return;
        }
        const info = classifyProviderError(err, "get-dashboard");
        applyCooldown(info);
        if (info.outcome === "session-ended") {
          setDashboardState(EMPTY_DASHBOARD);
          return;
        }
        if (info.code === "PROVIDER_PROFILE_NOT_FOUND") {
          markNotFound();
          setDashboardState({
            identity: targetIdentity,
            periodKey: targetPeriodKey,
            status: "idle",
            data: null,
            error: info,
            reloading: false,
          });
          return;
        }
        setDashboardState({
          identity: targetIdentity,
          periodKey: targetPeriodKey,
          status: "error",
          data: null,
          error: info,
          reloading: false,
        });
      },
    );

    return () => {
      controller.abort();
      if (dashboardControllerRef.current === controller) {
        dashboardControllerRef.current = null;
      }
    };
  }, [
    canFetchPrivate,
    identity,
    profileStatus,
    activeRange.start,
    activeRange.end,
    activePeriodKey,
    markNotFound,
    applyCooldown,
  ]);

  // Source 2: GET /bookings/provider (isolated block for PriorityStrip, Preview, Chart).
  useEffect(() => {
    if (!canFetchPrivate || !identity || profileStatus === "not-found") {
      bookingsControllerRef.current?.abort();
      bookingsControllerRef.current = null;
      return;
    }

    const controller = new AbortController();
    bookingsControllerRef.current?.abort();
    bookingsControllerRef.current = controller;
    const requestId = ++bookingsRequestIdRef.current;
    const targetIdentity = identity;

    listProviderBookings({ signal: controller.signal }).then(
      (bookings) => {
        if (
          controller.signal.aborted ||
          bookingsRequestIdRef.current !== requestId ||
          currentIdentityRef.current !== targetIdentity
        ) {
          return;
        }
        setNowMs(Date.now());
        setBookingsState({
          identity: targetIdentity,
          status: "ready",
          bookings,
          error: null,
          reloading: false,
        });
      },
      (err) => {
        if (
          isRequestCancelled(err) ||
          controller.signal.aborted ||
          bookingsRequestIdRef.current !== requestId ||
          currentIdentityRef.current !== targetIdentity
        ) {
          return;
        }
        const info = classifyProviderError(err, "list-bookings");
        applyCooldown(info);
        if (info.outcome === "session-ended") {
          setBookingsState(EMPTY_BOOKINGS);
          return;
        }
        if (info.code === "PROVIDER_PROFILE_NOT_FOUND") {
          markNotFound();
          setBookingsState({
            identity: targetIdentity,
            status: "idle",
            bookings: [],
            error: info,
            reloading: false,
          });
          return;
        }
        setBookingsState({
          identity: targetIdentity,
          status: "error",
          bookings: [],
          error: info,
          reloading: false,
        });
      },
    );

    return () => {
      controller.abort();
      if (bookingsControllerRef.current === controller) {
        bookingsControllerRef.current = null;
      }
    };
  }, [canFetchPrivate, identity, profileStatus, markNotFound, applyCooldown]);

  // Best-effort non-blocking fetch of services & availability slots for DSS service-name
  // enrichment and PriorityStrip setup hints (never blocks or masks errors of core blocks).
  useEffect(() => {
    if (!canFetchPrivate || !identity || profileStatus === "not-found") {
      setupControllerRef.current?.abort();
      setupControllerRef.current = null;
      return;
    }

    const controller = new AbortController();
    setupControllerRef.current?.abort();
    setupControllerRef.current = controller;
    const requestId = ++setupRequestIdRef.current;
    const targetIdentity = identity;

    Promise.allSettled([
      listMyServices({ signal: controller.signal }),
      listMyAvailabilitySlots({ signal: controller.signal }),
    ]).then(([servicesResult, slotsResult]) => {
      if (
        controller.signal.aborted ||
        setupRequestIdRef.current !== requestId ||
        currentIdentityRef.current !== targetIdentity
      ) {
        return;
      }
      const services =
        servicesResult.status === "fulfilled" ? servicesResult.value : [];
      const slots = slotsResult.status === "fulfilled" ? slotsResult.value : [];
      const loaded =
        servicesResult.status === "fulfilled" &&
        slotsResult.status === "fulfilled";
      setSetupState({
        identity: targetIdentity,
        services,
        slots,
        loaded,
      });
    });

    return () => {
      controller.abort();
      if (setupControllerRef.current === controller) {
        setupControllerRef.current = null;
      }
    };
  }, [canFetchPrivate, identity, profileStatus]);

  const retryDashboard = useCallback(async () => {
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
    dashboardControllerRef.current?.abort();
    dashboardControllerRef.current = controller;
    const requestId = ++dashboardRequestIdRef.current;
    const periodKey = `${activeRange.start}:${activeRange.end}`;

    setDashboardState((current) => ({
      ...current,
      identity: targetIdentity,
      periodKey,
      reloading: true,
    }));

    try {
      const data = await getProviderDashboard(
        { from: activeRange.start, to: activeRange.end },
        { signal: controller.signal },
      );
      if (
        controller.signal.aborted ||
        dashboardRequestIdRef.current !== requestId ||
        currentIdentityRef.current !== targetIdentity
      ) {
        return;
      }
      setDashboardState({
        identity: targetIdentity,
        periodKey,
        status: "ready",
        data,
        error: null,
        reloading: false,
      });
    } catch (err) {
      if (
        isRequestCancelled(err) ||
        controller.signal.aborted ||
        dashboardRequestIdRef.current !== requestId ||
        currentIdentityRef.current !== targetIdentity
      ) {
        return;
      }
      const info = classifyProviderError(err, "get-dashboard");
      applyCooldown(info);
      if (info.outcome === "session-ended") {
        setDashboardState(EMPTY_DASHBOARD);
        return;
      }
      if (info.code === "PROVIDER_PROFILE_NOT_FOUND") {
        markNotFound();
        return;
      }
      setDashboardState({
        identity: targetIdentity,
        periodKey,
        status: "error",
        data: null,
        error: info,
        reloading: false,
      });
    } finally {
      if (dashboardControllerRef.current === controller) {
        dashboardControllerRef.current = null;
      }
    }
  }, [
    activeRange.start,
    activeRange.end,
    applyCooldown,
    cooldownSeconds,
    markNotFound,
  ]);

  const retryBookings = useCallback(async () => {
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
    bookingsControllerRef.current?.abort();
    bookingsControllerRef.current = controller;
    const requestId = ++bookingsRequestIdRef.current;

    setBookingsState((current) => ({
      ...current,
      identity: targetIdentity,
      reloading: true,
    }));

    try {
      const bookings = await listProviderBookings({
        signal: controller.signal,
      });
      if (
        controller.signal.aborted ||
        bookingsRequestIdRef.current !== requestId ||
        currentIdentityRef.current !== targetIdentity
      ) {
        return;
      }
      setNowMs(Date.now());
      setBookingsState({
        identity: targetIdentity,
        status: "ready",
        bookings,
        error: null,
        reloading: false,
      });
    } catch (err) {
      if (
        isRequestCancelled(err) ||
        controller.signal.aborted ||
        bookingsRequestIdRef.current !== requestId ||
        currentIdentityRef.current !== targetIdentity
      ) {
        return;
      }
      const info = classifyProviderError(err, "list-bookings");
      applyCooldown(info);
      if (info.outcome === "session-ended") {
        setBookingsState(EMPTY_BOOKINGS);
        return;
      }
      if (info.code === "PROVIDER_PROFILE_NOT_FOUND") {
        markNotFound();
        return;
      }
      setBookingsState({
        identity: targetIdentity,
        status: "error",
        bookings: [],
        error: info,
        reloading: false,
      });
    } finally {
      if (bookingsControllerRef.current === controller) {
        bookingsControllerRef.current = null;
      }
    }
  }, [applyCooldown, cooldownSeconds, markNotFound]);

  const refreshAll = useCallback(async () => {
    if (cooldownSeconds > 0 || lockActionsRef.current) return;
    await Promise.all([reloadProfile(), retryDashboard(), retryBookings()]);
  }, [cooldownSeconds, reloadProfile, retryBookings, retryDashboard]);

  const selectPreset = useCallback(
    (preset: Exclude<DashboardRangePreset, "custom">) => {
      const targetIdentity = currentIdentityRef.current;
      const freshNow = Date.now();
      setNowMs(freshNow);
      setRangeState({
        identity: targetIdentity,
        preset,
        range: createPresetDateRange(preset, freshNow),
      });
    },
    [],
  );

  const applyCustomRange = useCallback((range: DateRange) => {
    const targetIdentity = currentIdentityRef.current;
    setRangeState({
      identity: targetIdentity,
      preset: "custom",
      range,
    });
  }, []);

  const dashboardMatches =
    !hidePrivateData &&
    !resetPrivateState &&
    identity !== null &&
    dashboardState.identity === identity &&
    dashboardState.periodKey === activePeriodKey;

  const dashboardStatus: "idle" | "loading" | "ready" | "error" =
    hidePrivateData || resetPrivateState
      ? "idle"
      : profileStatus === "not-found"
        ? "idle"
        : !dashboardMatches || dashboardState.status === "idle"
          ? "loading"
          : dashboardState.status;

  const dashboardData =
    dashboardMatches && dashboardState.status === "ready"
      ? dashboardState.data
      : null;

  const bookingsMatches =
    !hidePrivateData &&
    !resetPrivateState &&
    identity !== null &&
    bookingsState.identity === identity;

  const bookingsStatus: "idle" | "loading" | "ready" | "error" =
    hidePrivateData || resetPrivateState
      ? "idle"
      : profileStatus === "not-found"
        ? "idle"
        : !bookingsMatches || bookingsState.status === "idle"
          ? "loading"
          : bookingsState.status;

  const bookings = useMemo(
    () =>
      bookingsMatches && bookingsState.status === "ready"
        ? bookingsState.bookings
        : [],
    [bookingsMatches, bookingsState.status, bookingsState.bookings],
  );

  const todayDate = useMemo(() => getVietnamTodayDate(nowMs), [nowMs]);

  const setupCounts: SetupHintsCounts | null = useMemo(() => {
    if (
      hidePrivateData ||
      resetPrivateState ||
      identity === null ||
      setupState.identity !== identity ||
      !setupState.loaded
    ) {
      return null;
    }
    const activeServices = setupState.services.filter(
      (service) => service.status === "ACTIVE",
    ).length;
    const upcomingOpenSlots = setupState.slots.filter(
      (slot) => slot.status === "OPEN" && slot.slotDate >= todayDate,
    ).length;
    return { activeServices, upcomingOpenSlots };
  }, [hidePrivateData, resetPrivateState, identity, setupState, todayDate]);

  const lookups = useMemo(() => {
    const serviceNames = new Map<string, string>();
    if (setupState.identity === identity) {
      for (const service of setupState.services) {
        serviceNames.set(service.id, service.name);
      }
    }
    if (dashboardData) {
      for (const popular of dashboardData.popularServices) {
        if (!serviceNames.has(popular.serviceId)) {
          serviceNames.set(popular.serviceId, popular.serviceName);
        }
      }
    }
    const customerNames = new Map<string, string>();
    for (const booking of bookings) {
      if (!serviceNames.has(booking.service.id)) {
        serviceNames.set(booking.service.id, booking.service.name);
      }
      if (!customerNames.has(booking.customer.id)) {
        customerNames.set(booking.customer.id, booking.customer.fullName);
      }
    }
    return {
      facilityName: profileState.profile?.businessName ?? null,
      serviceNames,
      customerNames,
    };
  }, [
    setupState.identity,
    setupState.services,
    identity,
    dashboardData,
    bookings,
    profileState.profile?.businessName,
  ]);

  const metrics = useMemo(
    () => (dashboardData ? buildDashboardMetricCards(dashboardData) : []),
    [dashboardData],
  );

  const alerts = useMemo(
    () =>
      dashboardData
        ? dashboardData.alerts.map((alert) => localizeDssAlert(alert, lookups))
        : [],
    [dashboardData, lookups],
  );

  const hasAnalyticsData = Boolean(
    dashboardData &&
      (dashboardData.bookingVolumeByStatus.total > 0 ||
        dashboardData.averageRating.reviewCount > 0 ||
        dashboardData.alerts.length > 0),
  );

  const priority = useMemo(
    () => buildPrioritySummary(bookings, todayDate, setupCounts),
    [bookings, todayDate, setupCounts],
  );

  const pendingPreview = useMemo(
    () => buildBookingRequestsPreview(bookings, 5),
    [bookings],
  );

  const chartSeries = useMemo(
    () => buildStatusSeriesFromBookings(bookings, activeRange),
    [bookings, activeRange],
  );

  const allowDialogs =
    !sessionBoundary.closeDialog &&
    !sessionBoundary.hidePrivateData &&
    profileStatus !== "not-found";

  return {
    profileState,
    sessionBoundary,
    cooldownSeconds,
    preset: activeRangeState.preset,
    range: activeRange,
    allowDialogs,
    dashboardStatus,
    dashboardError: dashboardMatches ? dashboardState.error : null,
    dashboardReloading: dashboardMatches ? dashboardState.reloading : false,
    bookingsStatus,
    bookingsError: bookingsMatches ? bookingsState.error : null,
    bookingsReloading: bookingsMatches ? bookingsState.reloading : false,
    metrics,
    alerts,
    hasAnalyticsData,
    priority,
    pendingPreview,
    chartSeries,
    selectPreset,
    applyCustomRange,
    retryDashboard,
    retryBookings,
    refreshAll,
  };
}
