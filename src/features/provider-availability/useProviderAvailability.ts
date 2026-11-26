"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isRequestCancelled } from "@/lib/api/errors";
import { queryKeys } from "@/lib/api/queryCache";
import { privateCache } from "@/features/session/client";
import {
  classifyProviderError,
  listMyAvailabilitySlots,
  listMyServices,
  listWorkingHours,
  type ProviderApiErrorInfo,
  type ProviderAvailabilitySlot,
  type ProviderService,
  type ProviderWorkingHour,
} from "@/features/provider-workspace/liveApi";
import type { AvailabilityLoadStatus } from "./types";

export type ReloadWorkingHoursResult =
  | Readonly<{ ok: true; workingHours: ProviderWorkingHour[] }>
  | Readonly<{ ok: false; error: ProviderApiErrorInfo; aborted?: false }>
  | Readonly<{ ok: false; aborted: true }>;

export type ReloadSlotsResult =
  | Readonly<{ ok: true; slots: ProviderAvailabilitySlot[] }>
  | Readonly<{ ok: false; error: ProviderApiErrorInfo; aborted?: false }>
  | Readonly<{ ok: false; aborted: true }>;

export type ReloadServicesResult =
  | Readonly<{ ok: true; services: ProviderService[] }>
  | Readonly<{ ok: false; error: ProviderApiErrorInfo; aborted?: false }>
  | Readonly<{ ok: false; aborted: true }>;

type FetchedCollection<T> = Readonly<{
  identity: string | null;
  status: "ready" | "error" | null;
  items: T[];
  error: ProviderApiErrorInfo | null;
  reloading: boolean;
  refreshError: ProviderApiErrorInfo | null;
}>;

function emptyCollection<T>(): FetchedCollection<T> {
  return {
    identity: null,
    status: null,
    items: [],
    error: null,
    reloading: false,
    refreshError: null,
  };
}

export type UseProviderAvailabilityParams = Readonly<{
  identity: string | null;
  canFetchPrivate: boolean;
  hidePrivateData: boolean;
  resetPrivateState: boolean;
  profileReady: boolean;
  onProfileNotFound?: () => void;
}>;

export type UseProviderAvailabilityResult = Readonly<{
  workingHoursStatus: AvailabilityLoadStatus;
  workingHours: ProviderWorkingHour[];
  workingHoursError: ProviderApiErrorInfo | null;
  workingHoursRefreshError: ProviderApiErrorInfo | null;
  workingHoursReloading: boolean;
  reloadWorkingHours: () => Promise<ReloadWorkingHoursResult>;
  applyWorkingHoursLocally: (
    updater: (current: readonly ProviderWorkingHour[]) => ProviderWorkingHour[],
  ) => void;
  slotsStatus: AvailabilityLoadStatus;
  slots: ProviderAvailabilitySlot[];
  slotsError: ProviderApiErrorInfo | null;
  slotsRefreshError: ProviderApiErrorInfo | null;
  slotsReloading: boolean;
  reloadSlots: () => Promise<ReloadSlotsResult>;
  applySlotsLocally: (
    updater: (
      current: readonly ProviderAvailabilitySlot[],
    ) => ProviderAvailabilitySlot[],
  ) => void;
  servicesStatus: AvailabilityLoadStatus;
  services: ProviderService[];
  servicesError: ProviderApiErrorInfo | null;
  servicesReloading: boolean;
  reloadServices: () => Promise<ReloadServicesResult>;
}>;

export function useProviderAvailability({
  identity,
  canFetchPrivate,
  hidePrivateData,
  resetPrivateState,
  profileReady,
  onProfileNotFound,
}: UseProviderAvailabilityParams): UseProviderAvailabilityResult {
  const [fetchedHours, setFetchedHours] = useState<
    FetchedCollection<ProviderWorkingHour>
  >(() => emptyCollection<ProviderWorkingHour>());
  const [fetchedSlots, setFetchedSlots] = useState<
    FetchedCollection<ProviderAvailabilitySlot>
  >(() => emptyCollection<ProviderAvailabilitySlot>());
  const [fetchedServices, setFetchedServices] = useState<
    FetchedCollection<ProviderService>
  >(() => emptyCollection<ProviderService>());

  const hoursControllerRef = useRef<AbortController | null>(null);
  const hoursRequestIdRef = useRef(0);
  const slotsControllerRef = useRef<AbortController | null>(null);
  const slotsRequestIdRef = useRef(0);
  const servicesControllerRef = useRef<AbortController | null>(null);
  const servicesRequestIdRef = useRef(0);

  const currentIdentityRef = useRef<string | null>(null);
  const canFetchRef = useRef(false);
  const profileReadyRef = useRef(false);
  const onProfileNotFoundRef = useRef(onProfileNotFound);

  useEffect(() => {
    currentIdentityRef.current = identity;
    canFetchRef.current = canFetchPrivate;
    profileReadyRef.current = profileReady;
    onProfileNotFoundRef.current = onProfileNotFound;
  }, [identity, canFetchPrivate, profileReady, onProfileNotFound]);

  // Purge all private availability data asynchronously on 401/logout/identity switch.
  useEffect(() => {
    if (!resetPrivateState) return;
    hoursRequestIdRef.current++;
    slotsRequestIdRef.current++;
    servicesRequestIdRef.current++;
    hoursControllerRef.current?.abort();
    hoursControllerRef.current = null;
    slotsControllerRef.current?.abort();
    slotsControllerRef.current = null;
    servicesControllerRef.current?.abort();
    servicesControllerRef.current = null;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setFetchedHours(emptyCollection<ProviderWorkingHour>());
      setFetchedSlots(emptyCollection<ProviderAvailabilitySlot>());
      setFetchedServices(emptyCollection<ProviderService>());
    });
    return () => {
      cancelled = true;
    };
  }, [resetPrivateState]);

  // Load GET /providers/working-hours
  useEffect(() => {
    if (!canFetchPrivate || !identity || !profileReady) {
      hoursControllerRef.current?.abort();
      hoursControllerRef.current = null;
      return;
    }

    const controller = new AbortController();
    hoursControllerRef.current?.abort();
    hoursControllerRef.current = controller;
    const requestId = ++hoursRequestIdRef.current;
    const targetIdentity = identity;

    const cached = privateCache.read<ProviderWorkingHour[]>(
      queryKeys.provider.workingHours(),
    );
    if (cached) {
      Promise.resolve().then(() => {
        if (
          controller.signal.aborted ||
          hoursRequestIdRef.current !== requestId ||
          currentIdentityRef.current !== targetIdentity
        ) {
          return;
        }
        setFetchedHours({
          identity: targetIdentity,
          status: "ready",
          items: cached,
          error: null,
          reloading: false,
          refreshError: null,
        });
      });
    }

    listWorkingHours({ signal: controller.signal }).then(
      (items) => {
        if (
          controller.signal.aborted ||
          hoursRequestIdRef.current !== requestId ||
          currentIdentityRef.current !== targetIdentity
        ) {
          return;
        }
        setFetchedHours({
          identity: targetIdentity,
          status: "ready",
          items,
          error: null,
          reloading: false,
          refreshError: null,
        });
      },
      (err) => {
        if (
          isRequestCancelled(err) ||
          controller.signal.aborted ||
          hoursRequestIdRef.current !== requestId ||
          currentIdentityRef.current !== targetIdentity
        ) {
          return;
        }
        const info = classifyProviderError(err, "list-working-hours");
        if (info.outcome === "session-ended") {
          setFetchedHours(emptyCollection<ProviderWorkingHour>());
          return;
        }
        if (info.code === "PROVIDER_PROFILE_NOT_FOUND") {
          setFetchedHours(emptyCollection<ProviderWorkingHour>());
          onProfileNotFoundRef.current?.();
          return;
        }
        setFetchedHours((current) =>
          current.identity === targetIdentity && current.status === "ready"
            ? { ...current, reloading: false, refreshError: info }
            : {
                identity: targetIdentity,
                status: "error",
                items: [],
                error: info,
                reloading: false,
                refreshError: null,
              },
        );
      },
    );

    return () => {
      controller.abort();
      if (hoursControllerRef.current === controller) {
        hoursControllerRef.current = null;
      }
    };
  }, [canFetchPrivate, identity, profileReady]);

  // Load GET /availability/mine
  useEffect(() => {
    if (!canFetchPrivate || !identity || !profileReady) {
      slotsControllerRef.current?.abort();
      slotsControllerRef.current = null;
      return;
    }

    const controller = new AbortController();
    slotsControllerRef.current?.abort();
    slotsControllerRef.current = controller;
    const requestId = ++slotsRequestIdRef.current;
    const targetIdentity = identity;

    const cached = privateCache.read<ProviderAvailabilitySlot[]>(
      queryKeys.provider.availability(),
    );
    if (cached) {
      Promise.resolve().then(() => {
        if (
          controller.signal.aborted ||
          slotsRequestIdRef.current !== requestId ||
          currentIdentityRef.current !== targetIdentity
        ) {
          return;
        }
        setFetchedSlots({
          identity: targetIdentity,
          status: "ready",
          items: cached,
          error: null,
          reloading: false,
          refreshError: null,
        });
      });
    }

    listMyAvailabilitySlots({ signal: controller.signal }).then(
      (items) => {
        if (
          controller.signal.aborted ||
          slotsRequestIdRef.current !== requestId ||
          currentIdentityRef.current !== targetIdentity
        ) {
          return;
        }
        setFetchedSlots({
          identity: targetIdentity,
          status: "ready",
          items,
          error: null,
          reloading: false,
          refreshError: null,
        });
      },
      (err) => {
        if (
          isRequestCancelled(err) ||
          controller.signal.aborted ||
          slotsRequestIdRef.current !== requestId ||
          currentIdentityRef.current !== targetIdentity
        ) {
          return;
        }
        const info = classifyProviderError(err, "list-availability");
        if (info.outcome === "session-ended") {
          setFetchedSlots(emptyCollection<ProviderAvailabilitySlot>());
          return;
        }
        if (info.code === "PROVIDER_PROFILE_NOT_FOUND") {
          setFetchedSlots(emptyCollection<ProviderAvailabilitySlot>());
          onProfileNotFoundRef.current?.();
          return;
        }
        setFetchedSlots((current) =>
          current.identity === targetIdentity && current.status === "ready"
            ? { ...current, reloading: false, refreshError: info }
            : {
                identity: targetIdentity,
                status: "error",
                items: [],
                error: info,
                reloading: false,
                refreshError: null,
              },
        );
      },
    );

    return () => {
      controller.abort();
      if (slotsControllerRef.current === controller) {
        slotsControllerRef.current = null;
      }
    };
  }, [canFetchPrivate, identity, profileReady]);

  // Load GET /services/mine
  useEffect(() => {
    if (!canFetchPrivate || !identity || !profileReady) {
      servicesControllerRef.current?.abort();
      servicesControllerRef.current = null;
      return;
    }

    const controller = new AbortController();
    servicesControllerRef.current?.abort();
    servicesControllerRef.current = controller;
    const requestId = ++servicesRequestIdRef.current;
    const targetIdentity = identity;

    const cached = privateCache.read<ProviderService[]>(
      queryKeys.provider.services(),
    );
    if (cached) {
      Promise.resolve().then(() => {
        if (
          controller.signal.aborted ||
          servicesRequestIdRef.current !== requestId ||
          currentIdentityRef.current !== targetIdentity
        ) {
          return;
        }
        setFetchedServices({
          identity: targetIdentity,
          status: "ready",
          items: cached,
          error: null,
          reloading: false,
          refreshError: null,
        });
      });
    }

    listMyServices({ signal: controller.signal }).then(
      (items) => {
        if (
          controller.signal.aborted ||
          servicesRequestIdRef.current !== requestId ||
          currentIdentityRef.current !== targetIdentity
        ) {
          return;
        }
        setFetchedServices({
          identity: targetIdentity,
          status: "ready",
          items,
          error: null,
          reloading: false,
          refreshError: null,
        });
      },
      (err) => {
        if (
          isRequestCancelled(err) ||
          controller.signal.aborted ||
          servicesRequestIdRef.current !== requestId ||
          currentIdentityRef.current !== targetIdentity
        ) {
          return;
        }
        const info = classifyProviderError(err, "list-services");
        if (info.outcome === "session-ended") {
          setFetchedServices(emptyCollection<ProviderService>());
          return;
        }
        if (info.code === "PROVIDER_PROFILE_NOT_FOUND") {
          setFetchedServices(emptyCollection<ProviderService>());
          onProfileNotFoundRef.current?.();
          return;
        }
        setFetchedServices((current) =>
          current.identity === targetIdentity && current.status === "ready"
            ? { ...current, reloading: false, refreshError: info }
            : {
                identity: targetIdentity,
                status: "error",
                items: [],
                error: info,
                reloading: false,
                refreshError: null,
              },
        );
      },
    );

    return () => {
      controller.abort();
      if (servicesControllerRef.current === controller) {
        servicesControllerRef.current = null;
      }
    };
  }, [canFetchPrivate, identity, profileReady]);

  const reloadWorkingHours =
    useCallback(async (): Promise<ReloadWorkingHoursResult> => {
      const targetIdentity = currentIdentityRef.current;
      if (!canFetchRef.current || !profileReadyRef.current || !targetIdentity) {
        return { ok: false, aborted: true };
      }

      const controller = new AbortController();
      hoursControllerRef.current?.abort();
      hoursControllerRef.current = controller;
      const requestId = ++hoursRequestIdRef.current;

      setFetchedHours((current) =>
        current.identity === targetIdentity
          ? { ...current, reloading: true, refreshError: null }
          : {
              identity: targetIdentity,
              status: null,
              items: [],
              error: null,
              reloading: true,
              refreshError: null,
            },
      );

      try {
        const items = await listWorkingHours({ signal: controller.signal });
        if (
          controller.signal.aborted ||
          hoursRequestIdRef.current !== requestId ||
          currentIdentityRef.current !== targetIdentity
        ) {
          return { ok: false, aborted: true };
        }
        setFetchedHours({
          identity: targetIdentity,
          status: "ready",
          items,
          error: null,
          reloading: false,
          refreshError: null,
        });
        return { ok: true, workingHours: items };
      } catch (err) {
        if (
          isRequestCancelled(err) ||
          controller.signal.aborted ||
          hoursRequestIdRef.current !== requestId ||
          currentIdentityRef.current !== targetIdentity
        ) {
          return { ok: false, aborted: true };
        }
        const info = classifyProviderError(err, "list-working-hours");
        if (info.outcome === "session-ended") {
          setFetchedHours(emptyCollection<ProviderWorkingHour>());
          return { ok: false, error: info };
        }
        if (info.code === "PROVIDER_PROFILE_NOT_FOUND") {
          setFetchedHours(emptyCollection<ProviderWorkingHour>());
          onProfileNotFoundRef.current?.();
          return { ok: false, error: info };
        }
        setFetchedHours((current) =>
          current.identity === targetIdentity && current.status === "ready"
            ? { ...current, reloading: false, refreshError: info }
            : {
                identity: targetIdentity,
                status: "error",
                items: [],
                error: info,
                reloading: false,
                refreshError: null,
              },
        );
        return { ok: false, error: info };
      } finally {
        if (hoursControllerRef.current === controller) {
          hoursControllerRef.current = null;
        }
      }
    }, []);

  const reloadSlots = useCallback(async (): Promise<ReloadSlotsResult> => {
    const targetIdentity = currentIdentityRef.current;
    if (!canFetchRef.current || !profileReadyRef.current || !targetIdentity) {
      return { ok: false, aborted: true };
    }

    const controller = new AbortController();
    slotsControllerRef.current?.abort();
    slotsControllerRef.current = controller;
    const requestId = ++slotsRequestIdRef.current;

    setFetchedSlots((current) =>
      current.identity === targetIdentity
        ? { ...current, reloading: true, refreshError: null }
        : {
            identity: targetIdentity,
            status: null,
            items: [],
            error: null,
            reloading: true,
            refreshError: null,
          },
    );

    try {
      const items = await listMyAvailabilitySlots({
        signal: controller.signal,
      });
      if (
        controller.signal.aborted ||
        slotsRequestIdRef.current !== requestId ||
        currentIdentityRef.current !== targetIdentity
      ) {
        return { ok: false, aborted: true };
      }
      setFetchedSlots({
        identity: targetIdentity,
        status: "ready",
        items,
        error: null,
        reloading: false,
        refreshError: null,
      });
      return { ok: true, slots: items };
    } catch (err) {
      if (
        isRequestCancelled(err) ||
        controller.signal.aborted ||
        slotsRequestIdRef.current !== requestId ||
        currentIdentityRef.current !== targetIdentity
      ) {
        return { ok: false, aborted: true };
      }
      const info = classifyProviderError(err, "list-availability");
      if (info.outcome === "session-ended") {
        setFetchedSlots(emptyCollection<ProviderAvailabilitySlot>());
        return { ok: false, error: info };
      }
      if (info.code === "PROVIDER_PROFILE_NOT_FOUND") {
        setFetchedSlots(emptyCollection<ProviderAvailabilitySlot>());
        onProfileNotFoundRef.current?.();
        return { ok: false, error: info };
      }
      setFetchedSlots((current) =>
        current.identity === targetIdentity && current.status === "ready"
          ? { ...current, reloading: false, refreshError: info }
          : {
              identity: targetIdentity,
              status: "error",
              items: [],
              error: info,
              reloading: false,
              refreshError: null,
            },
      );
      return { ok: false, error: info };
    } finally {
      if (slotsControllerRef.current === controller) {
        slotsControllerRef.current = null;
      }
    }
  }, []);

  const reloadServices = useCallback(async (): Promise<ReloadServicesResult> => {
    const targetIdentity = currentIdentityRef.current;
    if (!canFetchRef.current || !profileReadyRef.current || !targetIdentity) {
      return { ok: false, aborted: true };
    }

    const controller = new AbortController();
    servicesControllerRef.current?.abort();
    servicesControllerRef.current = controller;
    const requestId = ++servicesRequestIdRef.current;

    setFetchedServices((current) =>
      current.identity === targetIdentity
        ? { ...current, reloading: true, refreshError: null }
        : {
            identity: targetIdentity,
            status: null,
            items: [],
            error: null,
            reloading: true,
            refreshError: null,
          },
    );

    try {
      const items = await listMyServices({ signal: controller.signal });
      if (
        controller.signal.aborted ||
        servicesRequestIdRef.current !== requestId ||
        currentIdentityRef.current !== targetIdentity
      ) {
        return { ok: false, aborted: true };
      }
      setFetchedServices({
        identity: targetIdentity,
        status: "ready",
        items,
        error: null,
        reloading: false,
        refreshError: null,
      });
      return { ok: true, services: items };
    } catch (err) {
      if (
        isRequestCancelled(err) ||
        controller.signal.aborted ||
        servicesRequestIdRef.current !== requestId ||
        currentIdentityRef.current !== targetIdentity
      ) {
        return { ok: false, aborted: true };
      }
      const info = classifyProviderError(err, "list-services");
      if (info.outcome === "session-ended") {
        setFetchedServices(emptyCollection<ProviderService>());
        return { ok: false, error: info };
      }
      if (info.code === "PROVIDER_PROFILE_NOT_FOUND") {
        setFetchedServices(emptyCollection<ProviderService>());
        onProfileNotFoundRef.current?.();
        return { ok: false, error: info };
      }
      setFetchedServices((current) =>
        current.identity === targetIdentity && current.status === "ready"
          ? { ...current, reloading: false, refreshError: info }
          : {
              identity: targetIdentity,
              status: "error",
              items: [],
              error: info,
              reloading: false,
              refreshError: null,
            },
      );
      return { ok: false, error: info };
    } finally {
      if (servicesControllerRef.current === controller) {
        servicesControllerRef.current = null;
      }
    }
  }, []);

  const applyWorkingHoursLocally = useCallback(
    (
      updater: (
        current: readonly ProviderWorkingHour[],
      ) => ProviderWorkingHour[],
    ) => {
      const targetIdentity = currentIdentityRef.current;
      if (!targetIdentity) return;
      setFetchedHours((current) => {
        const base = current.identity === targetIdentity ? current.items : [];
        return {
          identity: targetIdentity,
          status: "ready",
          items: updater(base),
          error: null,
          reloading: false,
          refreshError: current.refreshError,
        };
      });
    },
    [],
  );

  const applySlotsLocally = useCallback(
    (
      updater: (
        current: readonly ProviderAvailabilitySlot[],
      ) => ProviderAvailabilitySlot[],
    ) => {
      const targetIdentity = currentIdentityRef.current;
      if (!targetIdentity) return;
      setFetchedSlots((current) => {
        const base = current.identity === targetIdentity ? current.items : [];
        return {
          identity: targetIdentity,
          status: "ready",
          items: updater(base),
          error: null,
          reloading: false,
          refreshError: current.refreshError,
        };
      });
    },
    [],
  );

  const canExpose =
    !hidePrivateData && !resetPrivateState && profileReady && identity !== null;

  const hoursMatch = canExpose && fetchedHours.identity === identity;
  const slotsMatch = canExpose && fetchedSlots.identity === identity;
  const servicesMatch = canExpose && fetchedServices.identity === identity;

  const workingHoursStatus: AvailabilityLoadStatus = !canExpose
    ? "idle"
    : !hoursMatch || fetchedHours.status === null
      ? "loading"
      : fetchedHours.status;
  const slotsStatus: AvailabilityLoadStatus = !canExpose
    ? "idle"
    : !slotsMatch || fetchedSlots.status === null
      ? "loading"
      : fetchedSlots.status;
  const servicesStatus: AvailabilityLoadStatus = !canExpose
    ? "idle"
    : !servicesMatch || fetchedServices.status === null
      ? "loading"
      : fetchedServices.status;

  return {
    workingHoursStatus,
    workingHours:
      hoursMatch && fetchedHours.status === "ready" ? fetchedHours.items : [],
    workingHoursError: hoursMatch ? fetchedHours.error : null,
    workingHoursRefreshError: hoursMatch ? fetchedHours.refreshError : null,
    workingHoursReloading: hoursMatch ? fetchedHours.reloading : false,
    reloadWorkingHours,
    applyWorkingHoursLocally,
    slotsStatus,
    slots:
      slotsMatch && fetchedSlots.status === "ready" ? fetchedSlots.items : [],
    slotsError: slotsMatch ? fetchedSlots.error : null,
    slotsRefreshError: slotsMatch ? fetchedSlots.refreshError : null,
    slotsReloading: slotsMatch ? fetchedSlots.reloading : false,
    reloadSlots,
    applySlotsLocally,
    servicesStatus,
    services:
      servicesMatch && fetchedServices.status === "ready"
        ? fetchedServices.items
        : [],
    servicesError: servicesMatch ? fetchedServices.error : null,
    servicesReloading: servicesMatch ? fetchedServices.reloading : false,
    reloadServices,
  };
}
