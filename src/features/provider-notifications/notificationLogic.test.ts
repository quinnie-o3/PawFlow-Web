import { test } from "node:test";
import { strict as assert } from "node:assert";
import { createNotificationsMockData, notificationsMockNow, notificationsMockScope } from "./data/providerNotificationsMock";
import { createNotificationsState, formatNotificationDateTime, notificationsReducer, selectNotifications } from "./notificationLogic";
import type { NotificationCommand, NotificationScope, NotificationsState, ProviderNotification } from "./types";

function loaded(source = createNotificationsMockData()) {
  return notificationsReducer(createNotificationsState(), { type: "loaded", source, scope: notificationsMockScope });
}
function execute(state: NotificationsState, command: NotificationCommand, simulateFailure = false, scope: NotificationScope = notificationsMockScope) {
  const pending = notificationsReducer(state, { type: "submit", command, simulateFailure });
  return notificationsReducer(pending, { type: "resolve", scope, now: notificationsMockNow });
}
function unread(state: NotificationsState) {
  return selectNotifications(state.notifications, notificationsMockScope, "all").unreadCount;
}

test("Both recipient and facility constrain list and unread count from the same source", () => {
  const source = createNotificationsMockData();
  const selection = selectNotifications(source, notificationsMockScope, "all");
  assert.equal(source.length, 10);
  assert.equal(selection.all.length, 7);
  assert.equal(selection.unreadCount, 3);
  assert.ok(selection.visible.every((item) => !item.id.startsWith("OTHER-")));
  assert.deepEqual(selectNotifications(source, { ownerId: "another-owner", facilityId: "MOCK-PAWCARE" }, "all").all.map((item) => item.id), ["OTHER-OWNER"]);
  assert.deepEqual(selectNotifications(source, { ownerId: "owner-demo", facilityId: "MOCK-OTHER" }, "all").all.map((item) => item.id), ["OTHER-FACILITY"]);
});

test("Read and unread filters partition scoped data without changing the full unread count", () => {
  const source = createNotificationsMockData();
  const all = selectNotifications(source, notificationsMockScope, "all");
  const read = selectNotifications(source, notificationsMockScope, "read");
  const unread = selectNotifications(source, notificationsMockScope, "unread");
  assert.equal(read.visible.length, 4);
  assert.equal(unread.visible.length, 3);
  assert.equal(read.visible.length + unread.visible.length, all.all.length);
  assert.equal(read.unreadCount, 3);
  assert.equal(unread.unreadCount, 3);
});

test("Loading strips out-of-scope fixtures before storing them and clones records", () => {
  const source = createNotificationsMockData();
  const state = loaded(source);
  assert.equal(state.loadStatus, "ready");
  assert.equal(state.loadRequest, null);
  assert.equal(state.notifications.length, 7);
  assert.notEqual(state.notifications[0], source[0]);
  state.notifications[0].body = "changed";
  assert.notEqual(state.notifications[0].body, source[0].body);
});

test("No operation is accepted before successful loading", () => {
  const initial = createNotificationsState();
  assert.equal(notificationsReducer(initial, { type: "submit", command: { type: "open", id: "NOT-001" }, simulateFailure: false }), initial);
  assert.equal(initial.selectedId, null);
  assert.equal(initial.notifications.length, 0);
});

test("Opening detail is atomic: pending leaves counts untouched and success marks only that item", () => {
  const state = loaded();
  const pending = notificationsReducer(state, { type: "submit", command: { type: "open", id: "NOT-001" }, simulateFailure: false });
  assert.equal(pending.notifications, state.notifications);
  assert.equal(pending.selectedId, null);
  assert.equal(pending.feedback, null);
  assert.equal(unread(pending), 3);
  const result = notificationsReducer(pending, { type: "resolve", scope: notificationsMockScope, now: notificationsMockNow });
  assert.equal(result.selectedId, "NOT-001");
  assert.equal(result.notifications[0].readAt, notificationsMockNow);
  assert.equal(unread(result), 2);
  assert.equal(result.feedback?.outcome, "success");
  assert.equal(state.notifications[0].readAt, null);
  assert.equal(result.notifications[1], state.notifications[1]);
});

test("Failed open leaves detail closed and unread data untouched; exact command retries successfully", () => {
  const state = loaded();
  const command: NotificationCommand = { type: "open", id: "NOT-001" };
  const failed = execute(state, command, true);
  assert.equal(failed.notifications, state.notifications);
  assert.equal(failed.selectedId, null);
  assert.equal(unread(failed), 3);
  assert.equal(failed.feedback?.outcome, "error");
  assert.deepEqual(failed.failedCommand, command);
  const retried = execute(failed, failed.failedCommand!);
  assert.equal(retried.selectedId, "NOT-001");
  assert.equal(unread(retried), 2);
  assert.equal(retried.failedCommand, null);
  assert.equal(retried.feedback?.outcome, "success");
});

test("Marking one read never opens detail or changes another record", () => {
  const state = loaded();
  const result = execute(state, { type: "read", id: "NOT-002" });
  assert.equal(unread(result), 2);
  assert.equal(result.selectedId, null);
  assert.equal(result.notifications[1].readAt, notificationsMockNow);
  assert.equal(result.notifications[0], state.notifications[0]);
});

test("Single-read failure preserves counts and supports retry without optimistic success", () => {
  const state = loaded();
  const failed = execute(state, { type: "read", id: "NOT-002" }, true);
  assert.equal(failed.notifications, state.notifications);
  assert.equal(unread(failed), 3);
  assert.equal(failed.feedback?.outcome, "error");
  assert.equal(unread(execute(failed, failed.failedCommand!)), 2);
});

test("Read-all updates the whole scoped source even when the active view contains only read items", () => {
  const state = loaded();
  const visible = selectNotifications(state.notifications, notificationsMockScope, "read").visible;
  assert.ok(visible.every((item) => item.readAt !== null));
  const result = execute(state, { type: "readAll" });
  assert.equal(unread(result), 0);
  assert.equal(selectNotifications(result.notifications, notificationsMockScope, "read").visible.length, 7);
  assert.match(result.feedback!.message, /3 thông báo/);
  assert.match(result.feedback!.message, /toàn bộ danh sách.*ngoài bộ lọc/);
  assert.equal(result.notifications[3].readAt, state.notifications[3].readAt);
});

test("Read-all is scoped even if foreign data is passed to the mutation layer", () => {
  const state = { ...loaded(), notifications: createNotificationsMockData() };
  const result = execute(state, { type: "readAll" });
  assert.equal(unread(result), 0);
  const foreign = result.notifications.filter((item) => item.id.startsWith("OTHER-"));
  assert.equal(foreign.length, 3);
  assert.ok(foreign.every((item) => item.readAt === null));
});

test("Bulk failure is atomic and retry updates every scoped unread notification", () => {
  const state = loaded();
  const failed = execute(state, { type: "readAll" }, true);
  assert.equal(failed.notifications, state.notifications);
  assert.equal(unread(failed), 3);
  assert.equal(failed.feedback?.outcome, "error");
  const retried = execute(failed, failed.failedCommand!);
  assert.equal(unread(retried), 0);
  assert.equal(retried.feedback?.outcome, "success");
});

test("Foreign and unknown IDs cannot open detail or mark a notification read", () => {
  const state = { ...loaded(), notifications: createNotificationsMockData() };
  for (const id of ["OTHER-OWNER", "OTHER-FACILITY", "OTHER-BOTH", "missing"]) {
    for (const type of ["open", "read"] as const) {
      const result = execute(state, { type, id });
      assert.equal(result.selectedId, null);
      assert.equal(result.notifications, state.notifications);
      assert.equal(result.feedback?.outcome, "error");
      assert.equal(unread(result), 3);
    }
  }
});

test("Scope is rechecked when an in-flight operation resolves", () => {
  const state = loaded();
  const result = execute(state, { type: "open", id: "NOT-001" }, false, { ownerId: "another-owner", facilityId: notificationsMockScope.facilityId });
  assert.equal(result.notifications, state.notifications);
  assert.equal(result.selectedId, null);
  assert.equal(result.feedback?.outcome, "error");
});

test("Concurrent submissions and duplicate resolutions cannot double-apply updates", () => {
  const state = loaded();
  const pending = notificationsReducer(state, { type: "submit", command: { type: "read", id: "NOT-001" }, simulateFailure: false });
  assert.equal(notificationsReducer(pending, { type: "submit", command: { type: "readAll" }, simulateFailure: false }), pending);
  assert.equal(notificationsReducer(pending, { type: "load" }), pending);
  const result = notificationsReducer(pending, { type: "resolve", scope: notificationsMockScope, now: notificationsMockNow });
  assert.equal(unread(result), 2);
  assert.equal(notificationsReducer(result, { type: "resolve", scope: notificationsMockScope, now: notificationsMockNow }), result);
});

test("Reopening a read notification preserves its original read timestamp and count", () => {
  const state = loaded();
  const originalReadAt = state.notifications[3].readAt;
  const opened = execute(state, { type: "open", id: "NOT-004" });
  assert.equal(opened.notifications[3].readAt, originalReadAt);
  assert.equal(unread(opened), 3);
  assert.equal(opened.selectedId, "NOT-004");
  assert.equal(notificationsReducer(opened, { type: "close" }).selectedId, null);
});

test("Load failure never reports success, hides detail and can be retried", () => {
  const state = execute(loaded(), { type: "open", id: "NOT-001" });
  const request = notificationsReducer(state, { type: "load", simulateFailure: true });
  assert.equal(request.selectedId, null);
  const failed = notificationsReducer(request, { type: "loaded", source: createNotificationsMockData(), scope: notificationsMockScope });
  assert.equal(failed.loadStatus, "error");
  assert.equal(failed.feedback?.outcome, "error");
  assert.equal(failed.notifications, state.notifications);
  assert.equal(notificationsReducer(failed, { type: "submit", command: { type: "readAll" }, simulateFailure: false }), failed);
  const retry = notificationsReducer(failed, { type: "load" });
  const result = notificationsReducer(retry, { type: "loaded", source: createNotificationsMockData(), scope: notificationsMockScope });
  assert.equal(result.loadStatus, "ready");
  assert.equal(result.feedback, null);
  assert.equal(unread(result), 3);
});

test("Empty data and a filter with no results are distinguishable", () => {
  const empty = selectNotifications(createNotificationsMockData(true), notificationsMockScope, "all");
  assert.equal(empty.all.length, 0);
  assert.equal(empty.unreadCount, 0);
  const noUnread = selectNotifications(execute(loaded(), { type: "readAll" }).notifications, notificationsMockScope, "unread");
  assert.equal(noUnread.all.length, 7);
  assert.equal(noUnread.visible.length, 0);
});

test("Time formatting uses Vietnam time across UTC day and year boundaries", () => {
  const result = formatNotificationDateTime("2026-12-31T18:05:00Z");
  assert.match(result, /01:05/);
  assert.match(result, /01\/01\/2027/);
  assert.match(formatNotificationDateTime("2026-09-29T07:55:00Z"), /14:55/);
});

test("Fresh fixtures reset read state and preserve full long content and booking identity", () => {
  const source = createNotificationsMockData();
  source[0].readAt = notificationsMockNow;
  source[0].body = "changed";
  const fresh = createNotificationsMockData();
  assert.equal(fresh[0].readAt, null);
  assert.equal(fresh[0].bookingId, "PF-2084");
  assert.match(fresh[0].body, /Hà Linh/);
  const long = createNotificationsMockData(false, true);
  const state = execute(loaded(long), { type: "open", id: "NOT-005" });
  const detail = state.notifications.find((item) => item.id === state.selectedId) as ProviderNotification;
  assert.ok(detail.body.length > 2000);
  assert.ok(detail.body.endsWith("Kết thúc nội dung dài mô phỏng."));
});
