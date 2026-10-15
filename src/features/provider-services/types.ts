/** Internal mock models, not an API contract. No cross-module synchronization. */
export type ServiceDuration = { unit: "minutes"; value: number } | { unit: "day"; value: 1 };
export type ProviderService = {
  id: string;
  version: number;
  name: string;
  category: string;
  description: string;
  price: number;
  duration: ServiceDuration;
  active: boolean;
  completedCount: number;
};
export type ServiceDraft = {
  name: string;
  category: string;
  description: string;
  price: string;
  durationMinutes: string;
};
export type ServiceFilters = { query: string; status: "all" | "visible" | "hidden" };
/** Independent fixtures for proving service edits never rewrite saved bookings/slots. */
export type ServiceBookingSnapshot = {
  readonly id: string;
  readonly serviceId: string;
  readonly price: number;
  readonly duration: ServiceDuration;
  readonly status: "confirmed" | "completed";
};
export type ServiceSlotSnapshot = {
  readonly id: string;
  readonly serviceId: string;
  readonly label: string;
  readonly durationMinutes: number;
};
export type ServiceFeedback = { outcome: "success" | "error"; message: string };
export type ServicesState = {
  services: ProviderService[];
  categories: string[];
  bookings: readonly ServiceBookingSnapshot[];
  slots: readonly ServiceSlotSnapshot[];
  feedback: ServiceFeedback | null;
};
export type ServiceCommand =
  | { type: "create"; id: string; draft: ServiceDraft }
  | { type: "update"; id: string; expectedVersion: number; draft: ServiceDraft }
  | { type: "setActive"; id: string; expectedVersion: number; active: boolean }
  | { type: "createCategory"; name: string };
