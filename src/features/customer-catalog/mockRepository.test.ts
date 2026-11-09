import test from "node:test";
import assert from "node:assert/strict";
import { createMockRepository, LatestRequest, mockDelay } from "./mockRepository";
import { defaultQuery } from "../customer-discovery/queryState";
import { MOCK_NOW } from "./data/catalogMock";

test("Repository cancels an in-flight request and rejects pre-aborted requests", async () => {
  const controller = new AbortController(); const waiting = mockDelay({ signal: controller.signal, delayMs: 5000 }); controller.abort();
  await assert.rejects(waiting, { name: "AbortError" }); await assert.rejects(mockDelay({ signal: controller.signal }), { name: "AbortError" });
});
test("A cancelled older response cannot replace the latest result even if its loader ignores abort", async () => {
  const gate = new LatestRequest(); let shown = ""; let finishOld!: () => void;
  const old = gate.start(); const pending = new Promise<void>(resolve => { finishOld = resolve; }).then(() => { if (gate.isCurrent(old)) shown = "old"; });
  gate.cancel(old); const newest = gate.start(); if (gate.isCurrent(newest)) shown = "new";
  finishOld(); await pending; assert.equal(shown, "new"); gate.cancel(newest); assert.equal(gate.isCurrent(newest), false);
});
test("Retry after a simulated failure returns the same shared catalog", async () => {
  const repo = createMockRepository(); const signal = new AbortController().signal;
  await assert.rejects(repo.search(defaultQuery, MOCK_NOW, { signal, delayMs: 0, fail: true }), /Không tải/);
  const result = await repo.search(defaultQuery, MOCK_NOW, { signal, delayMs: 0 });
  const card = result.cards[0]; const detail = await repo.detail(card.provider.id, { signal, delayMs: 0 });
  assert.deepEqual(detail?.services.find(s => s.id === card.service.id), card.service);
});
test("Detail remains available without pets or slots and unavailable providers stay non-public", async () => {
  const repo = createMockRepository(); const options = { signal: new AbortController().signal, delayMs: 0 };
  assert.ok(await repo.detail("7", options)); assert.deepEqual(await repo.availability("7", options), []);
  assert.equal(await repo.detail("8", options), null); assert.equal(await repo.detail("9", options), null); assert.equal(await repo.detail("does-not-exist", options), null);
});
test("Caller changes to detail do not mutate repository fixtures", async () => {
  const repo = createMockRepository(); const options = { signal: new AbortController().signal, delayMs: 0 };
  const detail = await repo.detail("1", options); detail!.services[0].price = "1.00";
  assert.equal((await repo.detail("1", options))!.services[0].price, "250000.00");
});
