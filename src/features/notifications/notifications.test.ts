import test from "node:test";
import assert from "node:assert/strict";
import { MockInbox, inboxDelay, inboxFixtures } from "../customer-notifications/mockInbox";
import { notificationDestination, unreadCount, inboxReturnHref } from "./model";
import { decodeNotification, decodeInboxPage } from "./adapter";

const immediate = async () => {};
function deferred() {
  let release = () => {};
  return { wait: () => new Promise<void>(resolve => { release = resolve; }), resolve: () => release() };
}

test("read one is idempotent and count/list derive from the same source", async () => {
  const inbox = new MockInbox(immediate); await inbox.load();
  assert.equal(unreadCount(inbox.getSnapshot().items), 3);
  await inbox.read("104");
  const readAt = inbox.getSnapshot().items.find(item => item.id === "104")?.readAt;
  await inbox.read("104");
  assert.equal(unreadCount(inbox.getSnapshot().items), 2);
  assert.equal(inbox.getSnapshot().items.find(item => item.id === "104")?.readAt, readAt);
});

test("read-all captures start IDs, blocks duplicate and preserves concurrent arrival", async () => {
  const delay = deferred(); const inbox = new MockInbox(delay.wait);
  const loading = inbox.load(); delay.resolve(); await loading;
  const reading = inbox.read(); assert.equal(await inbox.read(), false);
  inbox.arrive(); const newId = inbox.getSnapshot().items[0].id;
  delay.resolve(); assert.equal(await reading, true);
  assert.equal(unreadCount(inbox.getSnapshot().items), 1);
  assert.equal(inbox.getSnapshot().items.find(item => item.id === newId)?.readAt, null);
  assert.ok(inbox.getSnapshot().items.filter(item => item.readAt).every(item => Date.parse(item.readAt!) >= Date.parse(item.createdAt)));
});

test("mutation failure preserves reads, retry succeeds; load failure is retryable", async () => {
  const inbox = new MockInbox(immediate); await inbox.load();
  inbox.setFailure("update", true);
  assert.equal(await inbox.read(), false); assert.equal(unreadCount(inbox.getSnapshot().items), 3);
  assert.equal(inbox.getSnapshot().notice, null); assert.ok(inbox.getSnapshot().error);
  await inbox.retry(); assert.equal(unreadCount(inbox.getSnapshot().items), 0);
  inbox.setFailure("load", true); await inbox.load(); assert.equal(inbox.getSnapshot().status, "error");
  await inbox.retry(); assert.equal(inbox.getSnapshot().status, "ready");
});

test("cancel/dispose suppress failures and late mutation; a new operation remains independent", async () => {
  const delay = deferred(); const inbox = new MockInbox(delay.wait);
  const first = inbox.load(); inbox.cancel(); delay.resolve(); await first;
  assert.equal(inbox.getSnapshot().error, null); assert.equal(inbox.getSnapshot().status, "idle");
  const second = inbox.load(); delay.resolve(); await second;
  const read = inbox.read(); inbox.dispose(); delay.resolve(); await read;
  assert.equal(unreadCount(inbox.getSnapshot().items), 3); assert.equal(inbox.getSnapshot().error, null);
});

test("real mock timer cancellation rejects promptly", async () => {
  const controller = new AbortController(); const promise = inboxDelay(controller.signal, 1000); controller.abort();
  await assert.rejects(promise, { name: "AbortError" });
});

test("deep links use only verified route IDs, no target grants access", () => {
  const verified = { providerIds: new Set(["1"]), bookingIds: new Set(["PF-DEMO-1"]) };
  assert.deepEqual(notificationDestination({ type: "PROVIDER", id: "1" }, verified), { kind: "available", href: "/providers/1?catalog=demo" });
  assert.deepEqual(notificationDestination({ type: "BOOKING", id: "PF-DEMO-1" }, verified), { kind: "available", href: "/bookings/PF-DEMO-1" });
  assert.deepEqual(notificationDestination({ type: "BOOKING", id: "foreign" }, verified), { kind: "missing" });
  assert.deepEqual(notificationDestination({ type: "REVIEW", id: "1" }, verified), { kind: "unsupported" });
  assert.deepEqual(notificationDestination(null, verified), { kind: "none" });
});

const dto = { id: "15", type: "BOOKING_CONFIRMED", title: "Title", body: "Body", payload: {},
  target: { type: "BOOKING", id: "42" }, isRead: false, readAt: null, createdAt: "2026-11-17T03:00:00Z" };
test("API adapter validates projection, paging anchor and inconsistent read state", () => {
  assert.equal(decodeNotification(dto).target?.id, "42");
  assert.throws(() => decodeNotification({ ...dto, isRead: true }));
  assert.throws(() => decodeNotification({ ...dto, id: 15 }));
  assert.throws(() => decodeNotification({ ...dto, target: { type: "BOOKING", id: "//evil" } }));
  assert.throws(() => decodeNotification({ ...dto, createdAt: "bad-date" }));
  const page = decodeInboxPage({ items: [dto], meta: { page: 1, limit: 20, totalItems: 1, totalPages: 1, hasNextPage: false, hasPreviousPage: false }, query: { status: "all", maxId: "15" } });
  assert.equal(page.query.maxId, "15");
  assert.throws(() => decodeInboxPage({ items: [], meta: {}, query: {} }));
});


test("failed read-all retries the original snapshot, leaving later arrivals unread", async () => {
  const delay = deferred(); const inbox = new MockInbox(delay.wait);
  const loading = inbox.load(); delay.resolve(); await loading;
  inbox.setFailure("update", true);
  const reading = inbox.read(); inbox.arrive(); delay.resolve(); await reading;
  assert.equal(unreadCount(inbox.getSnapshot().items), 4);
  const retry = inbox.retry(); delay.resolve(); await retry;
  assert.equal(unreadCount(inbox.getSnapshot().items), 1);
  assert.equal(inbox.getSnapshot().items[0].readAt, null);
});


test("fixed inbox return survives an expired mock notification without granting target access", () => {
  const items = inboxFixtures();
  assert.equal(inboxReturnHref("105", "/bookings/PF-DEMO-1", items), "/notifications");
  assert.equal(inboxReturnHref("105", "/providers/1", items), "/notifications");
  assert.equal(inboxReturnHref("104", "/providers/1", items), "/notifications");
  assert.equal(inboxReturnHref("104", "/bookings/foreign", items), null);
  assert.equal(inboxReturnHref("101", "/providers/1", items), null);
  for (const value of [null, "", "0", "//external.test", "https://external.test"]) assert.equal(inboxReturnHref(value, "/bookings/missing", items), null);
  for (const path of ["/admin", "/providers/1/extra", "//external.test", "https://external.test"]) assert.equal(inboxReturnHref("105", path, items), null);
  assert.deepEqual(notificationDestination({ type: "BOOKING", id: "PF-DEMO-1" }, { providerIds: new Set(), bookingIds: new Set() }), { kind: "missing" });
});
