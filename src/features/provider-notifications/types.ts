/** Frontend mock models only; not an API or authorization contract. */
export type NotificationKind = "newBooking" | "upcomingBooking" | "bookingCancelled" | "newReview" | "profileApproved" | "bookingCompleted";
export type NotificationScope = { ownerId: string; facilityId: string };
export type ProviderNotification = {
  id: string;
  recipientOwnerId: string;
  facilityId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  bookingId?: string;
};
export type NotificationFilter = "all" | "unread" | "read";
export type NotificationCommand = { type: "open" | "read"; id: string } | { type: "readAll" };
export type NotificationFeedback = { outcome: "success" | "error"; message: string };
export type NotificationsState = {
  notifications: ProviderNotification[];
  loadStatus: "loading" | "ready" | "error";
  loadRequest: { empty: boolean; longContent: boolean; simulateFailure: boolean } | null;
  pending: { command: NotificationCommand; simulateFailure: boolean } | null;
  failedCommand: NotificationCommand | null;
  selectedId: string | null;
  feedback: NotificationFeedback | null;
};
export type NotificationsAction =
  | { type: "load"; empty?: boolean; longContent?: boolean; simulateFailure?: boolean }
  | { type: "loaded"; source: readonly ProviderNotification[]; scope: NotificationScope }
  | { type: "submit"; command: NotificationCommand; simulateFailure: boolean }
  | { type: "resolve"; scope: NotificationScope; now: string }
  | { type: "close" };
