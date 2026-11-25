import test from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "../../lib/api/errors";
import { createPublicApi, decodePage, decodeProvider, decodeService, decodeSlot } from "./api";
import { parseSearch, serializeSearch, searchWire, initialQuery, keywordValid, validId, exclusivePrice, pageWindow, publicDetailHref, publicReturnTo } from "./query";
import { publicCache, publicKey, PublicRequest, PublicTimeout } from "./resource";

const provider = { id: "9007199254740993", businessName: "Cơ sở", address: "Quận 3", description: null, ratingAvg: "0.00", ratingCount: 0, serviceCount: 1, minPrice: "0.00", maxPrice: "300000.00" };
const service = { id: "2", name: "Tắm", description: null, price: "0.00", durationMinutes: 60, category: { id: "3", name: "Tắm", description: null }, provider };
const meta = { page: 1, limit: 4, totalItems: 1, totalPages: 1, hasNextPage: false, hasPreviousPage: false };
const echo = { q: null, categoryId: null, minPrice: null, maxPrice: null, minRating: null, location: null, sort: "newest" };
const params = (s: string) => parseSearch(new URLSearchParams(s));
const defer = <T>() => { let resolve!: (v: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; };

test("keyword uses 100 Unicode characters and at most 8 distinct whitespace terms; no accent folding", () => {
  assert(keywordValid("😀".repeat(100))); assert(!keywordValid("a".repeat(101))); assert(keywordValid(" a A a ")); assert(keywordValid("1 2 3 4 5 6 7 8")); assert(!keywordValid("1 2 3 4 5 6 7 8 9")); assert(!keywordValid("a\0"));
  assert.equal(params("q=%20T%E1%BA%AFm%20ch%C3%B3%20").query.q, "Tắm chó");
});
test("IDs keep full BIGINT precision and reject fixture slugs, overflow and zero", () => {
  assert(validId(provider.id)); assert(validId("9223372036854775807"));
  for (const x of ["9223372036854775808", "0", "01", "bath", 1]) assert(!validId(x));
});
test("query/URL roundtrip and legacy sort/location mapping retain filters", () => {
  const p = params("q=Spa&categoryId=7&area=q3&maxPrice=300000&minRating=4.5&sort=price-desc&page=2&unused=x");
  assert.equal(p.issues.length, 0); assert.equal(p.query.location, "Quận 3"); assert.equal(p.query.sort, "price_desc");
  assert.deepEqual(params(serializeSearch(p.query)).query, p.query);
  const wire = new URLSearchParams(searchWire(p.query)); assert.equal(wire.get("maxPrice"), "299999.99"); assert.equal(wire.get("limit"), "4"); assert.equal(wire.get("page"), "2"); assert(!wire.has("area"));
});
test("unsupported, duplicate and invalid conditions block rather than broaden results", () => {
  for (const [s, issue] of [["available=1", "available"], ["q=x&q=y", "duplicate"], ["categoryId=bath", "category"], ["page=1001", "page"], ["page=-1", "page"], ["minRating=5.1", "rating"], ["maxPrice=1e3", "price"], ["catalog=demo", "source"], ["sort=__proto__", "sort"]]) {
    const parsed = params(s); assert(parsed.issues.includes(issue)); assert.equal(parsed.canonical, s);
  }
});
test("exclusive currency boundary is exact, including zero and fractional thresholds", () => {
  assert.equal(exclusivePrice("300000"), "299999.99"); assert.equal(exclusivePrice("0.01"), "0.00"); assert.equal(exclusivePrice("0"), null); assert(params("maxPrice=0").emptyPrice); assert.throws(() => searchWire({ ...initialQuery, maxPrice: "0" }));
});
test("pagination remains bounded for large datasets and return URLs never switch data source", () => {
  assert(pageWindow(500, 90000).length <= 5); assert.equal(pageWindow(1000, 90000).at(-1), 1000); assert.deepEqual(pageWindow(1, 0), []);
  for (const value of ["//evil.test", "https://evil.test/discover", "/discover?catalog=demo", "/discover/../login", "/discover\\x"]) assert.equal(publicReturnTo(value), "/discover");
  const href = publicDetailHref(provider.id, "/discover?q=spa&page=2"); const url = new URL(href, "https://test.invalid"); assert(!url.searchParams.has("serviceId")); assert(!url.searchParams.has("catalog")); assert.equal(url.searchParams.get("returnTo"), "/discover?q=spa&page=2");
});
test("decoders preserve numeric strings/null and reject unsafe types or inconsistent data", () => {
  assert.equal(decodeProvider(provider).id, provider.id); assert.equal(decodeService(service).price, "0.00"); assert.equal(decodeProvider({ ...provider, serviceCount: 0, minPrice: null, maxPrice: null }).minPrice, null);
  for (const patch of [{ id: 1 }, { ratingAvg: "5.01" }, { minPrice: 0 }, { serviceCount: 0 }, { minPrice: "300001.00" }]) assert.throws(() => decodeProvider({ ...provider, ...patch }));
  assert.throws(() => decodeService({ ...service, durationMinutes: "60" }));
  assert.throws(() => decodeSlot({ id: "1", slotDate: "2026-12-01", startTime: "09:00:00", endTime: "10:00:00", capacity: 1, bookedCount: 1, service, provider }));
  assert.throws(() => decodeSlot({ id: "1", slotDate: "2026-02-30", startTime: "09:00:00", endTime: "10:00:00", capacity: 2, bookedCount: 1, service, provider }));
});
test("public rate-limit cooldown honours long Retry-After without changing private transport policy", async () => {
  const api = createPublicApi({ apiUrl: "https://api.test/api", fetchImpl: async () => new Response(JSON.stringify({ code: "RATE_LIMITED", retryAfterSeconds: 3600 }), { status: 429, headers: { "Retry-After": "3600" } }) });
  await assert.rejects(api.provider("1", new AbortController().signal), e => e instanceof ApiError && e.retryAfterSeconds === 3600);
  await assert.rejects(api.provider("../auth/me", new AbortController().signal), e => e instanceof ApiError && e.status === 400);
});

test("query echo enforces string IDs/text and numeric filters even when coercion would compare equal", () => {
  for (const [key, expected, wrong] of [["q", "123", 123], ["categoryId", "9007199254740993", 9007199254740992], ["providerId", "1", 1], ["minPrice", "0", "0"], ["maxPrice", "150000", "150000"], ["minRating", "4.5", "4.5"]] as const) {
    const wire = new URLSearchParams({ [key]: expected, page: "1", limit: "4" });
    assert.throws(() => decodePage({ items: [provider], meta, query: { [key]: wrong } }, decodeProvider, wire, [key]));
  }
});
test("public adapter omits credentials/auth and validates response echo, page and ownership", async () => {
  let body: unknown = { items: [provider], meta, query: echo };
  const api = createPublicApi({ apiUrl: "https://api.test/api", fetchImpl: async (url, init) => { assert(url.startsWith("https://api.test/api/")); assert.equal(init.credentials, "omit"); assert(!Object.keys(init.headers ?? {}).some(k => k.toLowerCase() === "authorization")); return new Response(JSON.stringify(body)); } });
  assert.equal((await api.providers(searchWire(initialQuery), new AbortController().signal)).items[0].id, provider.id);
  for (const wrong of [{ ...echo, q: "old" }, { ...echo, sort: null }]) { body = { items: [provider], meta, query: wrong }; await assert.rejects(api.providers(searchWire(initialQuery), new AbortController().signal), e => e instanceof ApiError && e.kind === "invalid-response"); }
  body = { items: [provider], meta: { ...meta, page: 2 }, query: echo }; await assert.rejects(api.providers(searchWire(initialQuery), new AbortController().signal));
  body = service; await assert.rejects(api.service("123", service.id, new AbortController().signal));
});
test("cancelled HTTP body arriving late cannot decode/render/cache", async () => {
  const body = defer<string>(), cache = publicCache(), owner = new PublicRequest(); let decoded = false;
  const api = createPublicApi({ apiUrl: "https://api.test/api", fetchImpl: async () => ({ status: 200, ok: true, headers: new Headers(), text: () => body.promise }) as Response });
  const old = owner.run(cache, publicKey("provider", "old"), async signal => { const p = await api.provider(provider.id, signal); decoded = true; return p; }, () => true);
  owner.cancel(); await assert.rejects(old, { name: "AbortError" }); body.resolve(JSON.stringify(provider)); await new Promise(r => setTimeout(r, 0));
  assert(!decoded); assert.equal(cache.read(publicKey("provider", "old")), undefined);
});
test("newest request wins even when old loader ignores abort; stale response cannot fill cache", async () => {
  const cache = publicCache(), owner = new PublicRequest(), slow = defer<string>();
  const old = owner.run(cache, publicKey("providers", "q=old"), () => slow.promise, () => true); const rejected = assert.rejects(old, { name: "AbortError" });
  const latest = await owner.run(cache, publicKey("providers", "q=new"), async () => "new", () => true); slow.resolve("old"); await rejected;
  assert.equal(latest, "new"); assert.equal(cache.read(publicKey("providers", "q=old")), undefined); assert.equal(cache.read(publicKey("providers", "q=new")), "new");
});
test("cache boundedness, expiry, retry invalidation and late writes use foundation guards", async () => {
  const cache = publicCache(), owner = new PublicRequest();
  for (let i = 0; i < 101; i++) await owner.run(cache, publicKey("providers", String(i)), async () => i, () => true);
  assert.equal(cache.read(publicKey("providers", "0")), undefined);
  assert.equal(cache.read(publicKey("providers", "100"), Date.now() + 31000), undefined);
  const slow = defer<string>(), key = publicKey("providers", "retry"), ticket = cache.ticket(key); cache.invalidate(key); assert(!cache.write(ticket, "late", 30000));
  const pending = owner.run(cache, key, () => slow.promise, () => false); slow.resolve("stale"); await assert.rejects(pending, { name: "AbortError" }); assert.equal(cache.read(key), undefined);
});
test("timeout is distinct from intentional cancellation; availability and failures are never fresh cached", async () => {
  const cache = publicCache(), owner = new PublicRequest(), key = publicKey("availability", "serviceId=2");
  await assert.rejects(owner.run(cache, key, () => new Promise(() => {}), () => true, 0, 5), PublicTimeout);
  await owner.run(cache, key, async () => "slots", () => true, 0); assert.equal(cache.read(key), undefined);
  await assert.rejects(owner.run(cache, key, async () => { throw new ApiError("http", 429, "RATE_LIMITED", null, 2); }, () => true)); assert.equal(cache.read(key), undefined);
});

test("public cache freshness is exactly 30 seconds and canonical key dimensions never collide", async () => {
  const cache = publicCache(), owner = new PublicRequest(), originalNow = Date.now;
  let now = 1_000_000, calls = 0;
  Date.now = () => now;
  try {
    const key = publicKey("providers", searchWire(initialQuery)), loader = async () => ++calls;
    assert.equal(await owner.run(cache, key, loader, () => true), 1);
    now += 29_999; assert.equal(await owner.run(cache, key, loader, () => true), 1); assert.equal(calls, 1);
    now++; assert.equal(await owner.run(cache, key, loader, () => true), 2); assert.equal(calls, 2);
    const keys = [key, ...[{ q: "QA" }, { categoryId: "7" }, { location: "Quận 3" }, { maxPrice: "300000" }, { minRating: "4.5" }, { sort: "price_desc" }, { page: 2 }].map(patch => publicKey("providers", searchWire({ ...initialQuery, ...patch }))), publicKey("providers", searchWire(initialQuery, 20)), publicKey("services", searchWire(initialQuery))];
    assert.equal(new Set(keys.map(k => JSON.stringify(k))).size, keys.length);
    assert(keys.every(k => k[2] === "live"));
  } finally { Date.now = originalNow; }
});

test("late post-body decoder completion and unmount cannot overwrite UI or populate cache", async () => {
  const cache = publicCache(), owner = new PublicRequest(), decode = defer<string>(), key = publicKey("provider", "1");
  let shown = "new", mounted = true;
  const old = owner.run(cache, key, async () => { const body = await decode.promise; return body.toUpperCase(); }, () => mounted).then(value => { shown = value; });
  const rejected = assert.rejects(old, { name: "AbortError" }); mounted = false; owner.cancel(); decode.resolve("old"); await rejected;
  assert.equal(shown, "new"); assert.equal(cache.read(key), undefined);
});

test("HTTP errors and malformed successful responses do not cache or auto-retry", async () => {
  for (const scenario of [{ status: 400, body: '{}' }, { status: 404, body: '{}' }, { status: 429, body: '{"code":"RATE_LIMITED","retryAfterSeconds":1}' }, { status: 503, body: '{"code":"RATE_LIMIT_UNAVAILABLE","retryAfterSeconds":5}' }, { status: 200, body: '{' }, { status: 200, body: '{}' }]) {
    let calls = 0;
    const api = createPublicApi({ apiUrl: "https://api.test/api", fetchImpl: async () => { calls++; return new Response(scenario.body, { status: scenario.status }); } }), cache = publicCache(), owner = new PublicRequest(), key = publicKey("provider", "1");
    await assert.rejects(owner.run(cache, key, signal => api.provider("1", signal), () => true), e => e instanceof ApiError && (scenario.status === 200 ? e.kind === "invalid-response" : e.status === scenario.status));
    assert.equal(calls, 1); assert.equal(cache.read(key), undefined);
  }
});
