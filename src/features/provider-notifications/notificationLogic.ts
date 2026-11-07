import { vi, formatMessage } from "../../lib/locale";
import type { NotificationFilter, NotificationScope, NotificationsAction, NotificationsState, ProviderNotification } from "./types";

export function belongsToScope(item: ProviderNotification, scope: NotificationScope) {
  return item.recipientOwnerId === scope.ownerId && item.facilityId === scope.facilityId;
}

export function selectNotifications(source: readonly ProviderNotification[], scope: NotificationScope, filter: NotificationFilter) {
  const all = source.filter((item) => belongsToScope(item, scope));
  return {
    all,
    visible: all.filter((item) => filter === "all" || (filter === "unread" ? item.readAt === null : item.readAt !== null)),
    unreadCount: all.filter((item) => item.readAt === null).length,
  };
}

export function formatNotificationDateTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value));
}

export function createNotificationsState(): NotificationsState {
  return { notifications: [], loadStatus: "loading", loadRequest: { empty: false, longContent: false, simulateFailure: false }, pending: null, failedCommand: null, selectedId: null, feedback: null };
}

export function notificationsReducer(state: NotificationsState, action: NotificationsAction): NotificationsState {
  switch (action.type) {
    case "load":
      if (state.pending || state.loadRequest) return state;
      return { ...state, loadStatus: "loading", loadRequest: { empty: !!action.empty, longContent: !!action.longContent, simulateFailure: !!action.simulateFailure }, selectedId: null, failedCommand: null, feedback: null };
    case "loaded": {
      if (!state.loadRequest) return state;
      if (state.loadRequest.simulateFailure) return { ...state, loadStatus: "error", loadRequest: null, feedback: { outcome: "error", message: vi.provider.notifications.errors.loadFailed } };
      const scoped = selectNotifications(action.source, action.scope, "all").all;
      return { ...state, notifications: scoped.map((item) => ({ ...item })), loadStatus: "ready", loadRequest: null, feedback: null };
    }
    case "submit":
      if (state.loadStatus !== "ready" || state.pending) return state;
      return { ...state, pending: { command: action.command, simulateFailure: action.simulateFailure }, failedCommand: null, feedback: null };
    case "resolve": {
      if (!state.pending) return state;
      const { command, simulateFailure } = state.pending;
      const scoped = selectNotifications(state.notifications, action.scope, "all");
      const target = command.type === "readAll" ? null : scoped.all.find((item) => item.id === command.id);
      if (command.type !== "readAll" && !target) return { ...state, pending: null, failedCommand: null, feedback: { outcome: "error", message: vi.provider.notifications.errors.notFound } };
      if (simulateFailure) return { ...state, pending: null, failedCommand: command, feedback: { outcome: "error", message: command.type === "open" ? vi.provider.notifications.errors.openFailed : vi.provider.notifications.errors.updateFailed } };
      const notifications = state.notifications.map((item) => belongsToScope(item, action.scope) && item.readAt === null && (command.type === "readAll" || item.id === command.id) ? { ...item, readAt: action.now } : item);
      const message = command.type === "readAll"
        ? formatMessage(vi.provider.notifications.feedback.allRead, { count: scoped.unreadCount })
        : command.type === "open" ? target?.readAt === null ? vi.provider.notifications.feedback.openedAndRead : vi.provider.notifications.feedback.opened : vi.provider.notifications.feedback.read;
      return { ...state, notifications, pending: null, failedCommand: null, selectedId: command.type === "open" ? command.id : state.selectedId, feedback: { outcome: "success", message } };
    }
    case "close":
      return { ...state, selectedId: null };
  }
}
