import test from "node:test";
import assert from "node:assert/strict";
import { createCatalogMock, MOCK_NOW } from "../customer-catalog/data/catalogMock";
import { defaultQuery, changeCriteria, detailHref, discoveryHref, parseDiscoveryQuery, presetActive, safeReturnTo, serializeQuery, togglePreset } from "./queryState";
import { searchCatalog } from "./searchLogic";
import type { DiscoveryQuery } from "../customer-catalog/types";

function search(patch: Partial<DiscoveryQuery> = {}) { return searchCatalog(createCatalogMock(), { ...defaultQuery, ...patch }, MOCK_NOW); }
test("Fixture ordering, provider cards and four-item pagination are deterministic", () => {
  assert.deepEqual(search().cards.map(c => c.provider.id), ["1", "2", "3", "4"]);
  assert.equal(search().total, 7); assert.equal(search().pages, 2); assert.deepEqual(search({ page: 2 }).cards.map(c => c.provider.id), ["5", "6", "7"]);
  assert.equal(search({ page: 999 }).page, 2);
});
test("Only approved providers and active services/categories are discoverable", () => {
  const data = createCatalogMock(); data.providers.forEach(p => { p.approval = "PENDING"; });
  assert.equal(searchCatalog(data, defaultQuery, MOCK_NOW).total, 0);
  assert.equal(search({ q: "danh muc tam an" }).total, 0); assert.equal(search({ q: "Vệ sinh tai" }).total, 0);
});
test("Accent/case-insensitive search ORs provider, service, category and address fields", () => {
  assert.equal(search({ q: "MAY PET" }).cards[0].provider.id, "2"); assert.equal(search({ q: "cham soc meo" }).cards[0].service.id, "302");
  assert.ok(search({ q: "TRONG GIU" }).total > 0); assert.ok(search({ q: "PhU NhUaN" }).cards.every(c => c.provider.id === "3"));
});
test("Category, exclusive price and availability cannot match different services", () => {
  assert.equal(search({ q: "Pet House", categoryId: "groom", maxPrice: "300000", available: true }).total, 0);
  const bath = search({ q: "Pet House", categoryId: "bath", maxPrice: "300000", available: true });
  assert.equal(bath.cards[0].service.id, "101"); assert.equal(bath.cards[0].service.price, "250000.00"); assert.equal(bath.cards[0].service.durationMinutes, 60);
});
test("Presets are ANDed consistently and reset only their own criteria when toggled off", () => {
  const first = togglePreset({ ...defaultQuery, page: 2, q: "pet" }, "nearby"); const both = togglePreset(first, "rated");
  assert.equal(presetActive(both, "nearby"), true); assert.equal(presetActive(both, "rated"), true); assert.equal(both.page, 1);
  const off = togglePreset(both, "nearby"); assert.equal(off.categoryId, "bath"); assert.equal(off.minRating, "4.5"); assert.equal(off.q, "pet");
  assert.equal(searchCatalog(createCatalogMock(), both, MOCK_NOW).cards[0].service.id, "101");
});
test("Card and sort price always belong to the chosen matching service", () => {
  const asc = search({ q: "Pet House", sort: "price-asc" }); const desc = search({ q: "Pet House", sort: "price-desc" });
  assert.equal(asc.cards[0].service.id, "101"); assert.equal(desc.cards[0].service.id, "102");
  assert.equal(search({ q: "Pet House", sort: "price-desc", available: true }).cards[0].service.id, "101");
});
test("Unknown prices and ratings sort last; actual zero remains zero", () => {
  const asc = search({ sort: "price-asc" }); assert.equal(asc.cards[0].provider.id, "7");
  const second = search({ sort: "price-desc", page: 2 }); assert.equal(second.cards.at(-1)?.provider.id, "6");
  assert.equal(search({ minRating: "0", q: "Góc Nhỏ" }).total, 0);
  assert.deepEqual(search({ sort: "rating-desc" }).cards.slice(0, 2).map(c => c.provider.id), ["2", "5"]);
});
test("Malformed and duplicate URL inputs canonicalize without crashing", () => {
  const query = parseDiscoveryQuery(new URLSearchParams("q=%E0%A4%A%00&categoryId=oops&area=any&maxPrice=NaN&minRating=9&page=-1&sort=__proto__&available=true&q=ignored"));
  assert.equal(query.categoryId, ""); assert.equal(query.area, ""); assert.equal(query.page, 1); assert.equal(query.sort, "fixture"); assert.equal(query.available, false); assert.ok(!query.q.includes("\0"));
  assert.doesNotThrow(() => serializeQuery(query)); assert.equal(parseDiscoveryQuery(new URLSearchParams("page=9999999999999999999")).page, 1);
});
test("Query roundtrip preserves applied criteria and clamps only the result page", () => {
  const query: DiscoveryQuery = { q: "tắm & spa", categoryId: "bath", area: "q3", maxPrice: "300000", minRating: "4.5", available: true, sort: "price-desc", page: 2 };
  assert.deepEqual(parseDiscoveryQuery(new URLSearchParams(serializeQuery(query))), query);
  assert.equal(changeCriteria(query, { sort: "rating-desc" }).page, 1);
  assert.equal(discoveryHref({ ...defaultQuery }), "/discover");
});
test("Return navigation accepts only canonical internal Discovery destinations", () => {
  for (const bad of [null, "https://evil.example/discover", "//evil.example", "/account", "/discover/../login", "/discover\\@evil", "javascript:alert(1)", "/%64iscover", "/discover\n?x=1"]) assert.equal(safeReturnTo(bad), "/discover", String(bad));
  assert.equal(safeReturnTo("/discover?sort=price-asc&page=2&unknown=bad#results"), "/discover?sort=price-asc&page=2");
  const href = detailHref("1", "102", "/discover?sort=price-desc&page=2"); const url = new URL(href, "https://local.invalid");
  assert.equal(url.searchParams.get("returnTo"), "/discover?sort=price-desc&page=2"); assert.equal(url.searchParams.get("serviceId"), "102");
});

test("Provider and representative-service ties stay stable when the input arrays are reversed", () => {
  const data = createCatalogMock();
  data.providers = data.providers.slice(0, 2).reverse().map(p => ({ ...p, rating: 4.5, ratingCount: 1, fixtureOrder: 0 }));
  data.services = data.services.filter(s => s.providerId === "1" || s.providerId === "2").reverse().map(s => ({ ...s, price: "100.00" }));
  for (const sort of ["fixture", "rating-desc", "price-asc", "price-desc"] as const) {
    const result = searchCatalog(data, { ...defaultQuery, sort }, MOCK_NOW);
    assert.deepEqual(result.cards.map(c => c.provider.id), ["1", "2"]);
    if (sort.startsWith("price-")) assert.equal(result.cards[0].service.id, "101");
  }
});
