"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isRequestCancelled } from "@/lib/api/errors";
import { queryKeys } from "@/lib/api/queryCache";
import { privateCache } from "@/features/session/client";
import {
  classifyProviderError,
  listActiveServiceCategories,
  listMyServices,
  type ProviderApiErrorInfo,
  type ProviderService,
  type ServiceCategoryOption,
} from "@/features/provider-workspace/liveApi";

export type ServicesLoadStatus = "idle" | "loading" | "ready" | "error";
export type CategoriesLoadStatus = "idle" | "loading" | "ready" | "error";

export type ReloadServicesResult =
  | Readonly<{ ok: true; services: ProviderService[] }>
  | Readonly<{ ok: false; error: ProviderApiErrorInfo; aborted?: false }>
  | Readonly<{ ok: false; aborted: true }>;

export type ReloadCategoriesResult =
  | Readonly<{ ok: true; categories: ServiceCategoryOption[] }>
  | Readonly<{ ok: false; error: ProviderApiErrorInfo; aborted?: false }>
  | Readonly<{ ok: false; aborted: true }>;

type FetchedServicesState = Readonly<{
  identity: string | null;
  status: "ready" | "error" | null;
  items: ProviderService[];
  error: ProviderApiErrorInfo | null;
  reloading: boolean;
  refreshError: ProviderApiErrorInfo | null;
}>;

type FetchedCategoriesState = Readonly<{
  status: CategoriesLoadStatus;
  items: ServiceCategoryOption[];
  error: ProviderApiErrorInfo | null;
}>;

const EMPTY_SERVICES: FetchedServicesState = {
  identity: null,
  status: null,
  items: [],
  error: null,
  reloading: false,
  refreshError: null,
};

const EMPTY_CATEGORIES: FetchedCategoriesState = {
  status: "idle",
  items: [],
  error: null,
};

export type UseProviderServicesParams = Readonly<{
  identity: string | null;
  canFetchPrivate: boolean;
  hidePrivateData: boolean;
  resetPrivateState: boolean;
  profileReady: boolean;
  onProfileNotFound?: () => void;
}>;

export type UseProviderServicesResult = Readonly<{
  servicesStatus: ServicesLoadStatus;
  services: ProviderService[];
  servicesError: ProviderApiErrorInfo | null;
  servicesRefreshError: ProviderApiErrorInfo | null;
  servicesReloading: boolean;
  reloadServices: () => Promise<ReloadServicesResult>;
  applyServicesLocally: (
    updater: (current: readonly ProviderService[]) => ProviderService[],
  ) => void;
  categoriesStatus: CategoriesLoadStatus;
  categories: ServiceCategoryOption[];
  categoriesError: ProviderApiErrorInfo | null;
  reloadCategories: () => Promise<ReloadCategoriesResult>;
}>;

export function useProviderServices({
  identity,
  canFetchPrivate,
  hidePrivateData,
  resetPrivateState,
  profileReady,
  onProfileNotFound,
}: UseProviderServicesParams): UseProviderServicesResult {
  const [fetchedServices, setFetchedServices] =
    useState<FetchedServicesState>(EMPTY_SERVICES);
  const [fetchedCategories, setFetchedCategories] =
    useState<FetchedCategoriesState>(EMPTY_CATEGORIES);

  const servicesControllerRef = useRef<AbortController | null>(null);
  const servicesRequestIdRef = useRef(0);
  const categoriesControllerRef = useRef<AbortController | null>(null);
  const categoriesRequestIdRef = useRef(0);

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

  // Purge private service list asynchronously on 401/logout/identity switch.
  useEffect(() => {
    if (!resetPrivateState) return;
    servicesRequestIdRef.current++;
    servicesControllerRef.current?.abort();
    servicesControllerRef.current = null;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) setFetchedServices(EMPTY_SERVICES);
    });
    return () => {
      cancelled = true;
    };
  }, [resetPrivateState]);

  // Load GET /services/mine whenever the authenticated owner has a valid profile.
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
          setFetchedServices(EMPTY_SERVICES);
          return;
        }
        if (info.code === "PROVIDER_PROFILE_NOT_FOUND") {
          setFetchedServices(EMPTY_SERVICES);
          onProfileNotFoundRef.current?.();
          return;
        }
        setFetchedServices((current) =>
          current.identity === targetIdentity && current.status === "ready"
            ? {
                ...current,
                reloading: false,
                refreshError: info,
              }
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

  // Load public active categories GET /service-categories when the workspace is active.
  useEffect(() => {
    if (!profileReady || hidePrivateData) return;

    const controller = new AbortController();
    categoriesControllerRef.current?.abort();
    categoriesControllerRef.current = controller;
    const requestId = ++categoriesRequestIdRef.current;

    listActiveServiceCategories({ signal: controller.signal }).then(
      (items) => {
        if (
          controller.signal.aborted ||
          categoriesRequestIdRef.current !== requestId
        ) {
          return;
        }
        setFetchedCategories({
          status: "ready",
          items,
          error: null,
        });
      },
      (err) => {
        if (
          isRequestCancelled(err) ||
          controller.signal.aborted ||
          categoriesRequestIdRef.current !== requestId
        ) {
          return;
        }
        const info = classifyProviderError(err, "list-categories");
        setFetchedCategories((current) => ({
          status: "error",
          items: current.items,
          error: info,
        }));
      },
    );

    return () => {
      controller.abort();
      if (categoriesControllerRef.current === controller) {
        categoriesControllerRef.current = null;
      }
    };
  }, [profileReady, hidePrivateData]);

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
        setFetchedServices(EMPTY_SERVICES);
        return { ok: false, error: info };
      }
      if (info.code === "PROVIDER_PROFILE_NOT_FOUND") {
        setFetchedServices(EMPTY_SERVICES);
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

  const reloadCategories =
    useCallback(async (): Promise<ReloadCategoriesResult> => {
      const controller = new AbortController();
      categoriesControllerRef.current?.abort();
      categoriesControllerRef.current = controller;
      const requestId = ++categoriesRequestIdRef.current;

      setFetchedCategories((current) => ({
        status: "loading",
        items: current.items,
        error: null,
      }));

      try {
        const items = await listActiveServiceCategories({
          signal: controller.signal,
        });
        if (
          controller.signal.aborted ||
          categoriesRequestIdRef.current !== requestId
        ) {
          return { ok: false, aborted: true };
        }
        setFetchedCategories({
          status: "ready",
          items,
          error: null,
        });
        return { ok: true, categories: items };
      } catch (err) {
        if (
          isRequestCancelled(err) ||
          controller.signal.aborted ||
          categoriesRequestIdRef.current !== requestId
        ) {
          return { ok: false, aborted: true };
        }
        const info = classifyProviderError(err, "list-categories");
        setFetchedCategories((current) => ({
          status: "error",
          items: current.items,
          error: info,
        }));
        return { ok: false, error: info };
      } finally {
        if (categoriesControllerRef.current === controller) {
          categoriesControllerRef.current = null;
        }
      }
    }, []);

  const applyServicesLocally = useCallback(
    (updater: (current: readonly ProviderService[]) => ProviderService[]) => {
      const targetIdentity = currentIdentityRef.current;
      if (!targetIdentity) return;
      setFetchedServices((current) => {
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

  const matchesIdentity =
    !hidePrivateData &&
    !resetPrivateState &&
    profileReady &&
    identity !== null &&
    fetchedServices.identity === identity;

  const servicesStatus: ServicesLoadStatus =
    hidePrivateData || resetPrivateState || !profileReady
      ? "idle"
      : !matchesIdentity || fetchedServices.status === null
        ? "loading"
        : fetchedServices.status;

  const services =
    matchesIdentity && fetchedServices.status === "ready"
      ? fetchedServices.items
      : [];
  const servicesError = matchesIdentity ? fetchedServices.error : null;
  const servicesRefreshError = matchesIdentity
    ? fetchedServices.refreshError
    : null;
  const servicesReloading = matchesIdentity ? fetchedServices.reloading : false;

  const categoriesStatus: CategoriesLoadStatus =
    !profileReady || hidePrivateData
      ? "idle"
      : fetchedCategories.status === "idle"
        ? "loading"
        : fetchedCategories.status;

  return {
    servicesStatus,
    services,
    servicesError,
    servicesRefreshError,
    servicesReloading,
    reloadServices,
    applyServicesLocally,
    categoriesStatus,
    categories: fetchedCategories.items,
    categoriesError: fetchedCategories.error,
    reloadCategories,
  };
}
