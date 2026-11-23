import type { InboxNotification, NotificationTarget } from "./model";
import type { ProviderNotification } from "../provider-notifications/types";

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid notification response");
  return value as Record<string, unknown>;
}
function id(value: unknown): string {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) throw new Error("Invalid id");
  return value;
}
function timestamp(value: unknown): string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) throw new Error("Invalid timestamp");
  return value;
}
/** Contract: PawFlow-API notifications DTO. This decoder performs no request. */
export function decodeNotification(value: unknown): InboxNotification {
  const item = record(value);
  if (typeof item.type !== "string" || !item.type || typeof item.title !== "string" || !item.title.trim() ||
    typeof item.body !== "string" || typeof item.isRead !== "boolean") throw new Error("Invalid notification");
  const readAt = item.readAt === null ? null : timestamp(item.readAt);
  if (item.isRead !== (readAt !== null)) throw new Error("Inconsistent read state");
  let target: NotificationTarget | null = null;
  if (item.target !== null) {
    const raw = record(item.target);
    if (!["BOOKING", "COMPLAINT", "REVIEW", "PROVIDER"].includes(String(raw.type))) throw new Error("Invalid target");
    target = { type: raw.type as NotificationTarget["type"], id: id(raw.id) };
  }
  return { id: id(item.id), type: item.type, title: item.title, body: item.body, readAt, createdAt: timestamp(item.createdAt), target };
}

export type InboxPage = { items: InboxNotification[]; meta: { page: number; limit: number; totalItems: number; totalPages: number; hasNextPage: boolean; hasPreviousPage: boolean }; query: { status: "all" | "unread" | "read"; maxId: string | null } };
export function decodeInboxPage(value: unknown): InboxPage {
  const body = record(value), meta = record(body.meta), query = record(body.query);
  if (!Array.isArray(body.items) || !["all", "unread", "read"].includes(String(query.status))) throw new Error("Invalid inbox page");
  for (const key of ["page", "limit", "totalItems", "totalPages"]) if (!Number.isSafeInteger(meta[key]) || Number(meta[key]) < (key === "page" || key === "limit" ? 1 : 0)) throw new Error("Invalid pagination");
  if (typeof meta.hasNextPage !== "boolean" || typeof meta.hasPreviousPage !== "boolean") throw new Error("Invalid pagination");
  return { items: body.items.map(decodeNotification), meta: meta as InboxPage["meta"], query: { status: query.status as InboxPage["query"]["status"], maxId: query.maxId === null ? null : id(query.maxId) } };
}

/** Optional migration adapter; existing Provider UI/store are deliberately unchanged. */
export function fromProviderNotification(item: ProviderNotification): InboxNotification {
  const types = { newBooking: "BOOKING_CREATED", upcomingBooking: "SYSTEM_ANNOUNCEMENT", bookingCancelled: "BOOKING_CANCELLED", newReview: "REVIEW_RECEIVED", profileApproved: "PROVIDER_APPROVED", bookingCompleted: "BOOKING_COMPLETED" };
  return { id: item.id, type: types[item.kind] ?? "SYSTEM_ANNOUNCEMENT", title: item.title,
    body: item.body, createdAt: item.createdAt, readAt: item.readAt,
    target: item.bookingId ? { type: "BOOKING", id: item.bookingId } : null };
}
