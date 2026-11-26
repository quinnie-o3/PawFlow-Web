import { formatMessage, vi } from "../../lib/locale";
import { matchesSearch, normalizeSearch } from "../../lib/search";
import { validId } from "../public-catalog/query";
import {
  normalizeOptionalText,
  type CreateServiceInput,
  type ProviderApprovalStatus,
  type ProviderService,
  type ProviderServiceCategoryRef,
  type ServiceCategoryOption,
  type UpdateServiceInput,
} from "../provider-workspace/liveApi";
import type {
  ExpectedCreateServicePayload,
  ExpectedUpdateServicePatch,
  ServiceCategoryFilterOption,
  ServiceDraft,
  ServiceFilters,
  ServiceValidationErrors,
} from "./types";

export const SERVICE_NAME_MIN = 1;
export const SERVICE_NAME_MAX = 200;
export const SERVICE_DURATION_MIN = 1;
export const SERVICE_DURATION_MAX = 2147483647;
export const SERVICE_MAX_PRICE = 9999999999.99;
const SERVICE_MAX_PRICE_CENTS = BigInt("999999999999");
const BIGINT_ZERO = BigInt(0);
const BIGINT_HUNDRED = BigInt(100);

const PRICE_INPUT_PATTERN = /^\d+(?:\.\d{1,2})?$/;
const INTEGER_INPUT_PATTERN = /^\d+$/;
const PRICE_DISPLAY_PATTERN = /^(\d+)(?:\.(\d{1,2}))?$/;

const VI_INTEGER_FORMATTER = new Intl.NumberFormat("vi-VN");

export type ParsedPrice = Readonly<{
  numeric: number;
  /** Exact NUMERIC(12,2) representation, e.g. "150000.00". */
  canonical: string;
}>;

/**
 * Parses price text with exact BigInt cents bounds (0 .. 9999999999.99, max 2 decimals)
 * and matches liveApi.ts's IEEE-754 cent-precision check so edge prices fail cleanly
 * at field validation rather than throwing INVALID_INPUT during API dispatch.
 */
export function parsePriceInput(raw: string): ParsedPrice | null {
  const trimmed = raw.trim();
  if (!PRICE_INPUT_PATTERN.test(trimmed)) return null;

  const dotIndex = trimmed.indexOf(".");
  const rawInt = dotIndex === -1 ? trimmed : trimmed.slice(0, dotIndex);
  const rawFrac = dotIndex === -1 ? "" : trimmed.slice(dotIndex + 1);
  const normalizedInt = rawInt.replace(/^0+(?=\d)/, "");
  if (normalizedInt.length > 10) return null;

  const paddedFrac = rawFrac.padEnd(2, "0");
  const cents = BigInt(normalizedInt) * BIGINT_HUNDRED + BigInt(paddedFrac);
  if (cents < BIGINT_ZERO || cents > SERVICE_MAX_PRICE_CENTS) return null;

  const canonical = `${normalizedInt}.${paddedFrac}`;
  const numeric = Number(canonical);
  if (
    !Number.isFinite(numeric) ||
    numeric < 0 ||
    numeric > SERVICE_MAX_PRICE
  ) {
    return null;
  }
  if (Math.abs(Math.round(numeric * 100) - numeric * 100) >= 1e-6) {
    return null;
  }

  return { numeric, canonical };
}

export function parseDurationMinutesInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!INTEGER_INPUT_PATTERN.test(trimmed)) return null;
  const normalized = trimmed.replace(/^0+(?=\d)/, "");
  if (normalized.length > 10) return null;
  const value = Number(normalized);
  if (
    !Number.isSafeInteger(value) ||
    value < SERVICE_DURATION_MIN ||
    value > SERVICE_DURATION_MAX
  ) {
    return null;
  }
  return value;
}

export function formatPrice(price: string): string {
  const match = PRICE_DISPLAY_PATTERN.exec(price.trim());
  if (!match) return `${price} ₫`;
  const normalizedInt = match[1].replace(/^0+(?=\d)/, "");
  const formattedInt = VI_INTEGER_FORMATTER.format(BigInt(normalizedInt));
  const trimmedFrac = (match[2] ?? "").replace(/0+$/, "");
  return trimmedFrac.length > 0
    ? `${formattedInt},${trimmedFrac} ₫`
    : `${formattedInt} ₫`;
}

export function formatDuration(durationMinutes: number): string {
  return formatMessage(vi.provider.services.duration.minutes, {
    count: durationMinutes,
  });
}

export function priceStringToDraftInput(price: string): string {
  const trimmed = price.trim();
  if (!PRICE_DISPLAY_PATTERN.test(trimmed)) return trimmed;
  return trimmed.replace(/\.00$/, "");
}

export function serviceToDraft(service?: ProviderService): ServiceDraft {
  if (!service) {
    return {
      categoryId: "",
      name: "",
      price: "",
      durationMinutes: "",
      description: "",
    };
  }
  return {
    categoryId: service.categoryId,
    name: service.name,
    price: priceStringToDraftInput(service.price),
    durationMinutes: String(service.durationMinutes),
    description: service.description ?? "",
  };
}

export function getServiceCategoryName(
  service: ProviderService,
  activeCategories: readonly ServiceCategoryOption[] = [],
): string {
  if (service.category?.name) return service.category.name;
  const matched = activeCategories.find(
    (category) => category.id === service.categoryId,
  );
  if (matched) return matched.name;
  return formatMessage(vi.provider.services.card.unknownCategory, {
    categoryId: service.categoryId,
  });
}

export function isServiceCategoryInactive(
  service: ProviderService,
  activeCategories: readonly ServiceCategoryOption[],
  categoriesLoaded: boolean,
): boolean {
  if (service.category?.status === "INACTIVE") return true;
  if (
    categoriesLoaded &&
    !activeCategories.some((category) => category.id === service.categoryId)
  ) {
    return true;
  }
  return false;
}

export function buildCategoryFilterOptions(
  services: readonly ProviderService[],
  activeCategories: readonly ServiceCategoryOption[],
  categoriesLoaded: boolean,
): ServiceCategoryFilterOption[] {
  const byId = new Map<string, ServiceCategoryFilterOption>();
  for (const category of activeCategories) {
    byId.set(category.id, {
      id: category.id,
      name: category.name,
      inactive: false,
    });
  }
  for (const service of services) {
    if (!byId.has(service.categoryId)) {
      byId.set(service.categoryId, {
        id: service.categoryId,
        name: getServiceCategoryName(service, activeCategories),
        inactive: isServiceCategoryInactive(
          service,
          activeCategories,
          categoriesLoaded,
        ),
      });
    }
  }
  return Array.from(byId.values()).sort((a, b) => {
    if (a.inactive !== b.inactive) return a.inactive ? 1 : -1;
    const byName = a.name.localeCompare(b.name, "vi");
    if (byName !== 0) return byName;
    return a.id.localeCompare(b.id);
  });
}

export function validateServiceDraft(
  draft: ServiceDraft,
  activeCategories: readonly ServiceCategoryOption[],
  existing?: ProviderService,
): ServiceValidationErrors {
  const errors: ServiceValidationErrors = {};

  const trimmedName = draft.name.trim();
  if (trimmedName.length < SERVICE_NAME_MIN) {
    errors.name = vi.provider.services.errors.nameRequired;
  } else if (trimmedName.length > SERVICE_NAME_MAX) {
    errors.name = vi.provider.services.errors.nameTooLong;
  }

  const categoryId = draft.categoryId.trim();
  if (!categoryId) {
    errors.categoryId = vi.provider.services.errors.categoryRequired;
  } else if (!validId(categoryId)) {
    errors.categoryId = vi.provider.services.errors.categoryUnavailable;
  } else {
    const keepingExistingCategory =
      existing !== undefined && categoryId === existing.categoryId;
    const isActiveCategory = activeCategories.some(
      (category) => category.id === categoryId,
    );
    if (!keepingExistingCategory && !isActiveCategory) {
      errors.categoryId = vi.provider.services.errors.categoryUnavailable;
    }
  }

  if (parsePriceInput(draft.price) === null) {
    errors.price = vi.provider.services.errors.priceInvalid;
  }

  if (parseDurationMinutesInput(draft.durationMinutes) === null) {
    errors.durationMinutes = vi.provider.services.errors.durationInvalid;
  }

  return errors;
}

export function buildCreateServicePayload(
  draft: ServiceDraft,
): Readonly<{
  input: CreateServiceInput;
  expected: ExpectedCreateServicePayload;
}> | null {
  const categoryId = draft.categoryId.trim();
  const name = draft.name.trim();
  const parsedPrice = parsePriceInput(draft.price);
  const durationMinutes = parseDurationMinutesInput(draft.durationMinutes);
  if (
    !validId(categoryId) ||
    name.length < SERVICE_NAME_MIN ||
    name.length > SERVICE_NAME_MAX ||
    parsedPrice === null ||
    durationMinutes === null
  ) {
    return null;
  }
  const description = normalizeOptionalText(draft.description);
  return {
    input: {
      categoryId,
      name,
      price: parsedPrice.numeric,
      durationMinutes,
      description,
    },
    expected: {
      categoryId,
      name,
      canonicalPrice: parsedPrice.canonical,
      durationMinutes,
      description,
    },
  };
}

export function buildUpdateServicePatch(
  existing: ProviderService,
  draft: ServiceDraft,
): Readonly<{
  input: UpdateServiceInput;
  expected: ExpectedUpdateServicePatch;
}> {
  const input: {
    categoryId?: string;
    name?: string;
    price?: number;
    durationMinutes?: number;
    description?: string | null;
  } = {};
  const expected: {
    categoryId?: string;
    name?: string;
    canonicalPrice?: string;
    durationMinutes?: number;
    description?: string | null;
  } = {};

  const nextCategoryId = draft.categoryId.trim();
  if (nextCategoryId !== existing.categoryId) {
    input.categoryId = nextCategoryId;
    expected.categoryId = nextCategoryId;
  }

  const nextName = draft.name.trim();
  if (nextName !== existing.name) {
    input.name = nextName;
    expected.name = nextName;
  }

  const parsedPrice = parsePriceInput(draft.price);
  if (parsedPrice !== null && parsedPrice.canonical !== existing.price) {
    input.price = parsedPrice.numeric;
    expected.canonicalPrice = parsedPrice.canonical;
  }

  const parsedDuration = parseDurationMinutesInput(draft.durationMinutes);
  if (
    parsedDuration !== null &&
    parsedDuration !== existing.durationMinutes
  ) {
    input.durationMinutes = parsedDuration;
    expected.durationMinutes = parsedDuration;
  }

  const nextDescription = normalizeOptionalText(draft.description);
  if (nextDescription !== existing.description) {
    input.description = nextDescription;
    expected.description = nextDescription;
  }

  return { input, expected };
}

export function hasServiceDraftChanges(
  existing: ProviderService,
  draft: ServiceDraft,
): boolean {
  if (draft.categoryId.trim() !== existing.categoryId) return true;
  if (draft.name.trim() !== existing.name) return true;
  if (normalizeOptionalText(draft.description) !== existing.description) {
    return true;
  }

  const parsedPrice = parsePriceInput(draft.price);
  if (parsedPrice === null) {
    if (draft.price.trim() !== priceStringToDraftInput(existing.price)) {
      return true;
    }
  } else if (parsedPrice.canonical !== existing.price) {
    return true;
  }

  const parsedDuration = parseDurationMinutesInput(draft.durationMinutes);
  if (parsedDuration === null) {
    if (draft.durationMinutes.trim() !== String(existing.durationMinutes)) {
      return true;
    }
  } else if (parsedDuration !== existing.durationMinutes) {
    return true;
  }

  return false;
}

export function filterServices(
  services: readonly ProviderService[],
  filters: ServiceFilters,
  activeCategories: readonly ServiceCategoryOption[] = [],
): ProviderService[] {
  const query = normalizeSearch(filters.query);
  return services.filter((service) => {
    if (filters.status !== "ALL" && service.status !== filters.status) {
      return false;
    }
    if (filters.categoryId && service.categoryId !== filters.categoryId) {
      return false;
    }
    return matchesSearch(query, [
      service.name,
      getServiceCategoryName(service, activeCategories),
      service.description ?? "",
    ]);
  });
}

export type ReconcileCreateResult =
  | Readonly<{ outcome: "created"; service: ProviderService }>
  | Readonly<{
      outcome: "forbidden-lifecycle";
      approvalStatus: "REJECTED" | "SUSPENDED";
    }>
  | Readonly<{ outcome: "not-created" }>;

export function reconcileServiceCreate(
  expected: ExpectedCreateServicePayload,
  preSubmitIds: readonly string[],
  serverServices: readonly ProviderService[],
  approvalStatus?: ProviderApprovalStatus,
): ReconcileCreateResult {
  const existingIds = new Set(preSubmitIds);
  const matched = serverServices.find(
    (service) =>
      !existingIds.has(service.id) &&
      service.status === "ACTIVE" &&
      service.categoryId === expected.categoryId &&
      service.name === expected.name &&
      service.price === expected.canonicalPrice &&
      service.durationMinutes === expected.durationMinutes &&
      service.description === expected.description,
  );
  if (matched) {
    return { outcome: "created", service: matched };
  }
  if (approvalStatus === "REJECTED" || approvalStatus === "SUSPENDED") {
    return { outcome: "forbidden-lifecycle", approvalStatus };
  }
  return { outcome: "not-created" };
}

export type ReconcileUpdateResult =
  | Readonly<{ outcome: "saved"; service: ProviderService }>
  | Readonly<{ outcome: "not-found" }>
  | Readonly<{
      outcome: "forbidden-lifecycle";
      approvalStatus: "REJECTED" | "SUSPENDED";
    }>
  | Readonly<{ outcome: "not-saved"; service: ProviderService }>;

export function reconcileServiceUpdate(
  serviceId: string,
  expected: ExpectedUpdateServicePatch,
  serverServices: readonly ProviderService[],
  approvalStatus?: ProviderApprovalStatus,
): ReconcileUpdateResult {
  const current = serverServices.find((service) => service.id === serviceId);
  if (!current) {
    return { outcome: "not-found" };
  }

  const hasExpectedField =
    expected.categoryId !== undefined ||
    expected.name !== undefined ||
    expected.canonicalPrice !== undefined ||
    expected.durationMinutes !== undefined ||
    expected.description !== undefined ||
    expected.status !== undefined;

  const matchesAll =
    hasExpectedField &&
    (expected.categoryId === undefined ||
      current.categoryId === expected.categoryId) &&
    (expected.name === undefined || current.name === expected.name) &&
    (expected.canonicalPrice === undefined ||
      current.price === expected.canonicalPrice) &&
    (expected.durationMinutes === undefined ||
      current.durationMinutes === expected.durationMinutes) &&
    (expected.description === undefined ||
      current.description === expected.description) &&
    (expected.status === undefined || current.status === expected.status);

  if (matchesAll) {
    return { outcome: "saved", service: current };
  }
  if (approvalStatus === "REJECTED" || approvalStatus === "SUSPENDED") {
    return { outcome: "forbidden-lifecycle", approvalStatus };
  }
  return { outcome: "not-saved", service: current };
}

function resolveCategoryRef(
  categoryId: string,
  incoming: ProviderServiceCategoryRef | null,
  previous: ProviderService | undefined,
  activeCategories: readonly ServiceCategoryOption[],
): ProviderServiceCategoryRef | null {
  if (incoming && incoming.id === categoryId) return incoming;
  if (previous?.category && previous.category.id === categoryId) {
    return previous.category;
  }
  const active = activeCategories.find((item) => item.id === categoryId);
  if (active) {
    return {
      id: active.id,
      name: active.name,
      description: active.description,
      status: "ACTIVE",
    };
  }
  return null;
}

export type LocalServiceMutation =
  | Readonly<{ kind: "create"; service: ProviderService }>
  | Readonly<{ kind: "update"; service: ProviderService }>
  | Readonly<{ kind: "deactivate"; serviceId: string }>;

/**
 * Fallback local projection used only when a confirmed mutation's follow-up
 * GET /services/mine refresh fails transiently.
 */
export function applyLocalServiceMutation(
  services: readonly ProviderService[],
  mutation: LocalServiceMutation,
  activeCategories: readonly ServiceCategoryOption[],
): ProviderService[] {
  if (mutation.kind === "deactivate") {
    return services.map((item) =>
      item.id === mutation.serviceId ? { ...item, status: "INACTIVE" } : item,
    );
  }
  if (mutation.kind === "create") {
    const hydrated: ProviderService = {
      ...mutation.service,
      category: resolveCategoryRef(
        mutation.service.categoryId,
        mutation.service.category,
        undefined,
        activeCategories,
      ),
    };
    const rest = services.filter((item) => item.id !== hydrated.id);
    return [hydrated, ...rest];
  }
  const previous = services.find((item) => item.id === mutation.service.id);
  const hydrated: ProviderService = {
    ...mutation.service,
    category: resolveCategoryRef(
      mutation.service.categoryId,
      mutation.service.category,
      previous,
      activeCategories,
    ),
  };
  if (!previous) return [hydrated, ...services];
  return services.map((item) => (item.id === hydrated.id ? hydrated : item));
}
