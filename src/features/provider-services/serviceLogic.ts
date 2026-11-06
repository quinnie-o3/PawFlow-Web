import { vi, formatMessage } from "../../lib/locale";
import type { ProviderService, ServiceCommand, ServiceDraft, ServiceDuration, ServiceFilters, ServicesState } from "./types";

export function formatPrice(price: number) {
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 20 }).format(price)} ₫`;
}

export function formatDuration(duration: ServiceDuration) {
  return duration.unit === "day" ? vi.provider.services.duration.oneDay : formatMessage(vi.provider.services.duration.minutes, { count: duration.value });
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().trim();
}

export function filterServices(services: ProviderService[], filters: ServiceFilters) {
  const query = normalize(filters.query);
  return services.filter((service) =>
    (filters.status === "all" || service.active === (filters.status === "visible")) &&
    normalize(`${service.name} ${service.category} ${service.description}`).includes(query));
}

export function serviceToDraft(service?: ProviderService): ServiceDraft {
  return {
    name: service?.name ?? "",
    category: service?.category ?? "",
    description: service?.description ?? "",
    price: service ? String(service.price) : "",
    durationMinutes: service?.duration.unit === "minutes" ? String(service.duration.value) : "",
  };
}

/** Reject empty, non-decimal, non-finite, non-positive and unsafe values. */
function positiveNumber(value: string) {
  const text = value.trim();
  if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(text)) return false;
  const number = Number(text);
  return Number.isFinite(number) && number > 0 && number <= Number.MAX_SAFE_INTEGER;
}

export function validateServiceDraft(draft: ServiceDraft, categories: readonly string[], existing?: ProviderService): string | null {
  if (!draft.name.trim()) return vi.provider.services.errors.nameRequired;
  if (!draft.category.trim()) return vi.provider.services.errors.categoryRequired;
  if (!categories.includes(draft.category)) return vi.provider.services.errors.categoryMissing;
  if (!positiveNumber(draft.price)) return vi.provider.services.errors.priceInvalid;
  // The existing one-day service keeps its duration; no minutes conversion is inferred.
  if (existing?.duration.unit !== "day" && !positiveNumber(draft.durationMinutes)) return vi.provider.services.errors.durationInvalid;
  return null;
}

export function categoryError(categories: readonly string[], name: string): string | null {
  if (!name.trim()) return vi.provider.services.errors.categoryNameRequired;
  if (categories.some((category) => category.toLocaleLowerCase("vi-VN") === name.trim().toLocaleLowerCase("vi-VN"))) return vi.provider.services.errors.categoryExists;
  return null;
}

export function affectedSlots(state: ServicesState, service: ProviderService, draft: ServiceDraft) {
  if (service.duration.unit === "day" || Number(draft.durationMinutes) === service.duration.value) return [];
  return state.slots.filter((slot) => slot.serviceId === service.id && slot.durationMinutes !== Number(draft.durationMinutes));
}

/** This is the service-level gate only; real booking also needs slot/time/capacity checks. */
export function serviceAcceptsNewBookings(service: ProviderService) {
  return service.active;
}

export function serviceCommandError(state: ServicesState, command: ServiceCommand): string | null {
  if (command.type === "createCategory") return categoryError(state.categories, command.name);
  const current = state.services.find((service) => service.id === command.id);
  if (command.type === "create") {
    if (!command.id.trim() || current) return vi.provider.services.errors.createUnavailable;
    return validateServiceDraft(command.draft, state.categories);
  }
  if (!current) return vi.provider.services.errors.serviceMissing;
  if (command.expectedVersion !== current.version) return vi.provider.services.errors.versionChanged;
  if (command.type === "setActive") {
    if (command.active === current.active) return vi.provider.services.errors.statusUnchanged;
    return null;
  }
  const error = validateServiceDraft(command.draft, state.categories, current);
  if (error) return error;
  const conflicts = affectedSlots(state, current, command.draft);
  if (conflicts.length) return formatMessage(vi.provider.services.errors.durationConflicts, { conflicts: conflicts.map((slot) => formatMessage(vi.provider.services.errors.slotDescription, { slotId: slot.id, slotLabel: slot.label, count: slot.durationMinutes })).join("\n") });
  return null;
}

/** Atomic synchronous mock command: validate against current state, then replace one collection. */
export function applyServiceCommand(state: ServicesState, command: ServiceCommand, simulateFailure = false): ServicesState {
  const error = serviceCommandError(state, command) || (simulateFailure ? vi.provider.services.errors.saveFailed : null);
  if (error) return { ...state, feedback: { outcome: "error", message: error } };
  if (command.type === "createCategory") return { ...state, categories: [...state.categories, command.name.trim()], feedback: { outcome: "success", message: vi.provider.services.feedback.categoryCreated } };
  if (command.type === "setActive") return {
    ...state,
    services: state.services.map((service) => service.id === command.id ? { ...service, active: command.active, version: service.version + 1 } : service),
    feedback: { outcome: "success", message: command.active ? vi.provider.services.feedback.serviceShown : vi.provider.services.feedback.serviceHidden },
  };
  const current = state.services.find((service) => service.id === command.id);
  const service: ProviderService = {
    id: command.id,
    version: (current?.version ?? 0) + 1,
    name: command.draft.name.trim(),
    category: command.draft.category.trim(),
    description: command.draft.description.trim(),
    price: Number(command.draft.price),
    duration: current?.duration.unit === "day" ? current.duration : { unit: "minutes", value: Number(command.draft.durationMinutes) },
    active: current?.active ?? true,
    completedCount: current?.completedCount ?? 0,
  };
  return {
    ...state,
    services: command.type === "create" ? [...state.services, service] : state.services.map((item) => item.id === service.id ? service : item),
    feedback: { outcome: "success", message: command.type === "create" ? vi.provider.services.feedback.serviceCreated : vi.provider.services.feedback.serviceUpdated },
  };
}
