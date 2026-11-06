import assert from "node:assert/strict";
import test from "node:test";
import { formatMessage, formatMessageParts } from "./locale";

test("named values preserve Vietnamese, zero, repetition and sentence order", () => {
  assert.equal(formatMessage("{name} · {count} / {total} lịch · {name}", { name: "Hà Linh", count: 0, total: 12 }), "Hà Linh · 0 / 12 lịch · Hà Linh");
});

test("values containing braces or markup are not interpreted as templates", () => {
  assert.equal(formatMessage("Hồ sơ {name}", { name: "<Miu> {count}" }), "Hồ sơ <Miu> {count}");
});

test("missing values fail immediately instead of displaying raw placeholders", () => {
  assert.throws(() => formatMessage("{count} lịch", {}), /Missing locale placeholder: count/);
  assert.throws(() => formatMessage("{toString}", {}), /Missing locale placeholder: toString/);
});

test("rich parts preserve the supplied node and surrounding spaces", () => {
  const node = { name: "count-node" };
  assert.deepEqual(formatMessageParts("Hiển thị {count} khách hàng.", { count: node }), ["Hiển thị ", node, " khách hàng."]);
});

test("a message without variables remains exact", () => {
  assert.equal(formatMessage("Đang đăng nhập...", {}), "Đang đăng nhập...");
});
