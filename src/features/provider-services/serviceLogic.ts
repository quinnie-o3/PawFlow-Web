import type { ProviderService, ServiceCommand, ServiceDraft, ServiceDuration, ServiceFilters, ServicesState } from "./types";

export function formatPrice(price: number) {
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 20 }).format(price)} ₫`;
}

export function formatDuration(duration: ServiceDuration) {
  return duration.unit === "day" ? "1 ngày" : `${duration.value} phút`;
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
  if (!draft.name.trim()) return "Nhập tên dịch vụ, không chỉ gồm khoảng trắng.";
  if (!draft.category.trim()) return "Chọn hoặc tạo danh mục cho dịch vụ.";
  if (!categories.includes(draft.category)) return "Danh mục chưa có trong danh sách. Hãy tạo danh mục trước khi lưu.";
  if (!positiveNumber(draft.price)) return "Giá dịch vụ phải là số hợp lệ lớn hơn 0. Nhập số, không kèm dấu phân cách hàng nghìn.";
  // The existing one-day service keeps its duration; no minutes conversion is inferred.
  if (existing?.duration.unit !== "day" && !positiveNumber(draft.durationMinutes)) return "Thời lượng phải là số phút hợp lệ lớn hơn 0.";
  return null;
}

export function categoryError(categories: readonly string[], name: string): string | null {
  if (!name.trim()) return "Nhập tên danh mục, không chỉ gồm khoảng trắng.";
  if (categories.some((category) => category.toLocaleLowerCase("vi-VN") === name.trim().toLocaleLowerCase("vi-VN"))) return "Danh mục đã tồn tại. Hãy chọn danh mục trong danh sách.";
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
    if (!command.id.trim() || current) return "Không thể tạo dịch vụ này. Hãy đóng form và thử lại.";
    return validateServiceDraft(command.draft, state.categories);
  }
  if (!current) return "Không tìm thấy dịch vụ. Hãy mở lại danh sách.";
  if (command.expectedVersion !== current.version) return "Dịch vụ đã thay đổi. Hãy đóng và mở lại chi tiết trước khi thử lại.";
  if (command.type === "setActive") {
    if (command.active === current.active) return "Dịch vụ đã ở trạng thái này.";
    return null;
  }
  const error = validateServiceDraft(command.draft, state.categories, current);
  if (error) return error;
  const conflicts = affectedSlots(state, current, command.draft);
  if (conflicts.length) return `Chưa thể đổi thời lượng vì các khung giờ sau bị ảnh hưởng:\n${conflicts.map((slot) => `${slot.id} · ${slot.label} · ${slot.durationMinutes} phút`).join("\n")}\nHãy xử lý các khung giờ liên quan tại Lịch khả dụng trước. Các khung giờ và lịch đã đặt được giữ nguyên.`;
  return null;
}

/** Atomic synchronous mock command: validate against current state, then replace one collection. */
export function applyServiceCommand(state: ServicesState, command: ServiceCommand, simulateFailure = false): ServicesState {
  const error = serviceCommandError(state, command) || (simulateFailure ? "Chưa lưu được thay đổi. Dữ liệu đã nhập vẫn được giữ, hãy thử lại." : null);
  if (error) return { ...state, feedback: { outcome: "error", message: error } };
  if (command.type === "createCategory") return { ...state, categories: [...state.categories, command.name.trim()], feedback: { outcome: "success", message: "Đã tạo danh mục." } };
  if (command.type === "setActive") return {
    ...state,
    services: state.services.map((service) => service.id === command.id ? { ...service, active: command.active, version: service.version + 1 } : service),
    feedback: { outcome: "success", message: command.active ? "Đã hiển thị lại dịch vụ và bật nhận lịch mới theo khung giờ khả dụng." : "Đã tạm ẩn dịch vụ và ngừng nhận lịch mới. Lịch đã đặt được giữ nguyên." },
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
    feedback: { outcome: "success", message: command.type === "create" ? "Đã tạo dịch vụ và hiển thị với khách." : "Đã lưu thay đổi dịch vụ. Giá và thời lượng của lịch đã đặt được giữ nguyên." },
  };
}
