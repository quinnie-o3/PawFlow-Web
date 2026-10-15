import { test } from "node:test";
import { strict as assert } from "node:assert";
import { createServicesMock } from "./data/providerServicesMock";
import { affectedSlots, applyServiceCommand, categoryError, filterServices, formatDuration, formatPrice, serviceAcceptsNewBookings, serviceToDraft, validateServiceDraft } from "./serviceLogic";
import type { ServiceCommand, ServiceDraft, ServicesState } from "./types";

function draft(overrides: Partial<ServiceDraft> = {}): ServiceDraft {
  return { name: "Chăm sóc móng", category: "Vệ sinh", description: "Vệ sinh móng nhẹ nhàng.", price: "90000", durationMinutes: "30", ...overrides };
}
function update(state: ServicesState, id: string, changes: Partial<ServiceDraft> = {}): ServiceCommand {
  const service = state.services.find((item) => item.id === id)!;
  return { type: "update", id, expectedVersion: service.version, draft: { ...serviceToDraft(service), ...changes } };
}

test("Required name and category reject empty and whitespace-only values", () => {
  const state = createServicesMock();
  for (const value of ["", " \n\t "]) {
    assert.match(validateServiceDraft(draft({ name: value }), state.categories)!, /tên dịch vụ/);
    assert.match(validateServiceDraft(draft({ category: value }), state.categories)!, /danh mục/);
  }
});

test("Price must be finite, positive and valid numeric input, including at save", () => {
  const state = createServicesMock();
  for (const price of ["", " ", "0", "-1", "NaN", "Infinity", "1e309", "abc", "90.000 ₫", "9,000", "0x10", "9007199254740992"]) {
    const result = applyServiceCommand(state, { type: "create", id: "new", draft: draft({ price }) });
    assert.equal(result.feedback?.outcome, "error", price);
    assert.equal(result.services, state.services, price);
  }
  assert.equal(validateServiceDraft(draft({ price: " 90000.5 " }), state.categories), null);
});

test("Duration rejects empty, non-finite, non-numeric, zero and negative values", () => {
  const state = createServicesMock();
  for (const durationMinutes of ["", " \n", "0", "-30", "Infinity", "NaN", "abc", "1e309", "30 phút"]) {
    assert.match(validateServiceDraft(draft({ durationMinutes }), state.categories)!, /Thời lượng/);
  }
  assert.equal(validateServiceDraft(draft({ durationMinutes: "30.5" }), state.categories), null);
});

test("Creation trims text, sets active, and leaves existing state untouched", () => {
  const state = createServicesMock();
  const result = applyServiceCommand(state, { type: "create", id: "new", draft: draft({ name: "  Chăm sóc móng  ", description: "  \n  " }) });
  assert.equal(result.feedback?.outcome, "success");
  assert.equal(result.services.length, 7);
  assert.equal(state.services.length, 6);
  assert.deepEqual(result.services[6], { id: "new", version: 1, name: "Chăm sóc móng", description: "", category: "Vệ sinh", price: 90000, duration: { unit: "minutes", value: 30 }, active: true, completedCount: 0 });
});

test("Owner creates a trimmed category and can use it in a new service", () => {
  const initial = createServicesMock();
  const category = applyServiceCommand(initial, { type: "createCategory", name: "  Chăm sóc đặc biệt  " });
  assert.equal(category.categories.at(-1), "Chăm sóc đặc biệt");
  assert.equal(initial.categories.length, 4);
  const saved = applyServiceCommand(category, { type: "create", id: "new", draft: draft({ category: "Chăm sóc đặc biệt" }) });
  assert.equal(saved.feedback?.outcome, "success");
});

test("Category requires a name, rejects duplicates and unknown draft categories", () => {
  const state = createServicesMock();
  assert.ok(categoryError(state.categories, " \t\n "));
  assert.ok(categoryError(state.categories, "  gROOMING  "));
  assert.ok(validateServiceDraft(draft({ category: "Unknown" }), state.categories));
  const duplicate = applyServiceCommand(state, { type: "createCategory", name: "grooming" });
  assert.equal(duplicate.categories, state.categories);
  assert.equal(duplicate.feedback?.outcome, "error");
});

test("Price changes preserve every booking price/duration/status and every slot", () => {
  const state = createServicesMock();
  const before = structuredClone(state);
  const saved = applyServiceCommand(state, update(state, "styling", { price: "300000" }));
  assert.equal(saved.services[0].price, 300000);
  assert.equal(saved.bookings, state.bookings);
  assert.equal(saved.slots, state.slots);
  assert.deepEqual(saved.bookings, before.bookings);
  assert.deepEqual(state, before);
});

test("Duration changes without affected slots preserve the booking snapshot", () => {
  const state = createServicesMock();
  const changed = applyServiceCommand(state, update(state, "ears-nails", { durationMinutes: "45" }));
  assert.equal(changed.feedback?.outcome, "success");
  assert.equal(changed.services.find((item) => item.id === "ears-nails")?.duration.value, 45);
  assert.equal(changed.bookings[1].duration.value, 30);
  assert.equal(changed.bookings, state.bookings);
  assert.equal(changed.slots, state.slots);
});

test("Affected slots block the whole save and identify all conflicts", () => {
  const state = createServicesMock();
  const command = update(state, "styling", { durationMinutes: "60", price: "300000", name: "New name" });
  const result = applyServiceCommand(state, command);
  assert.equal(result.feedback?.outcome, "error");
  assert.match(result.feedback!.message, /MOCK-SLOT-1.*21\/10\/2026/);
  assert.match(result.feedback!.message, /MOCK-SLOT-2.*22\/10\/2026/);
  assert.equal(result.services, state.services);
  assert.equal(result.slots, state.slots);
  assert.equal(result.bookings, state.bookings);
});

test("Equal numeric duration is not a change; other services' slots do not block", () => {
  const state = createServicesMock();
  assert.equal(applyServiceCommand(state, update(state, "styling", { durationMinutes: "090.0" })).feedback?.outcome, "success");
  assert.equal(applyServiceCommand(state, update(state, "bath", { durationMinutes: "75" })).feedback?.outcome, "success");
  assert.deepEqual(affectedSlots(state, state.services[0], serviceToDraft(state.services[0])), []);
});

test("One-day duration stays unchanged even if minutes are supplied or invalid", () => {
  const state = createServicesMock();
  for (const durationMinutes of ["", "60", "NaN", "0"]) {
    const saved = applyServiceCommand(state, update(state, "daycare", { durationMinutes, price: "270000" }));
    assert.equal(saved.feedback?.outcome, "success");
    assert.deepEqual(saved.services[3].duration, { unit: "day", value: 1 });
  }
});

test("Hide stops new booking eligibility and preserves existing bookings/slots", () => {
  const state = createServicesMock();
  const hidden = applyServiceCommand(state, { type: "setActive", id: "styling", expectedVersion: 1, active: false });
  assert.equal(serviceAcceptsNewBookings(hidden.services[0]), false);
  assert.equal(hidden.bookings, state.bookings);
  assert.equal(hidden.slots, state.slots);
  assert.equal(hidden.services.length, state.services.length);
  const visible = applyServiceCommand(hidden, { type: "setActive", id: "styling", expectedVersion: 2, active: true });
  assert.equal(serviceAcceptsNewBookings(visible.services[0]), true);
  assert.equal(visible.bookings, state.bookings);
});

test("Editing an inactive service never silently reactivates it", () => {
  const state = createServicesMock();
  const saved = applyServiceCommand(state, update(state, "ears-nails", { price: "100000" }));
  assert.equal(saved.services[5].active, false);
  assert.equal(serviceAcceptsNewBookings(saved.services[5]), false);
});

test("Failure keeps all collections and retry applies the exact same draft", () => {
  const state = createServicesMock();
  const input = draft({ name: "  Retry name  " });
  const command: ServiceCommand = { type: "create", id: "new", draft: input };
  const original = structuredClone(command);
  const failed = applyServiceCommand(state, command, true);
  assert.equal(failed.feedback?.outcome, "error");
  for (const key of ["services", "categories", "bookings", "slots"] as const) assert.equal(failed[key], state[key]);
  assert.deepEqual(command, original);
  const saved = applyServiceCommand(failed, command);
  assert.equal(saved.feedback?.outcome, "success");
  assert.equal(saved.services.at(-1)?.name, "Retry name");
});

test("Status and category failures are atomic and can be retried", () => {
  const state = createServicesMock();
  const commands: ServiceCommand[] = [{ type: "setActive", id: "styling", expectedVersion: 1, active: false }, { type: "createCategory", name: "New category" }];
  for (const command of commands) {
    const failed = applyServiceCommand(state, command, true);
    assert.equal(failed.services, state.services);
    assert.equal(failed.categories, state.categories);
    assert.equal(applyServiceCommand(failed, command).feedback?.outcome, "success");
  }
});

test("Duplicate IDs, missing services, stale saves and repeated status commands fail", () => {
  const state = createServicesMock();
  assert.equal(applyServiceCommand(state, { type: "create", id: "styling", draft: draft() }).feedback?.outcome, "error");
  assert.equal(applyServiceCommand(state, { type: "update", id: "missing", expectedVersion: 1, draft: draft() }).feedback?.outcome, "error");
  const command = update(state, "styling", { price: "300000" });
  const saved = applyServiceCommand(state, command);
  const stale = applyServiceCommand(saved, command);
  assert.equal(stale.feedback?.outcome, "error");
  assert.equal(stale.services, saved.services);
  assert.equal(applyServiceCommand(state, { type: "setActive", id: "styling", expectedVersion: 1, active: true }).feedback?.outcome, "error");
});

test("Search combines status with trimmed case/accent-insensitive name/category/description", () => {
  const state = createServicesMock();
  assert.deepEqual(filterServices(state.services, { query: "  TAO KIEU ", status: "visible" }).map((item) => item.id), ["styling"]);
  assert.equal(filterServices(state.services, { query: "ve sinh", status: "hidden" })[0].id, "ears-nails");
  assert.equal(filterServices(state.services, { query: "trong gio", status: "visible" })[0].id, "daycare");
  assert.equal(filterServices(state.services, { query: "tai", status: "visible" }).some((item) => item.id === "ears-nails"), false);
  assert.equal(filterServices(state.services, { query: "unknown", status: "all" }).length, 0);
  assert.deepEqual(filterServices([], { query: "", status: "all" }), []);
});

test("Empty scenario, reset isolation and Vietnamese format remain explicit", () => {
  const empty = createServicesMock(true);
  assert.equal(empty.services.length, 0);
  assert.equal(empty.slots.length, 0);
  assert.equal(empty.bookings.length, 0);
  const state = createServicesMock();
  state.services[0].name = "changed";
  state.categories.push("changed");
  assert.equal(createServicesMock().services[0].name, "Chăm sóc tạo kiểu");
  assert.equal(createServicesMock().categories.length, 4);
  assert.equal(formatPrice(280000), "280.000 ₫");
  assert.equal(formatDuration({ unit: "minutes", value: 90 }), "90 phút");
  assert.equal(formatDuration({ unit: "day", value: 1 }), "1 ngày");
});
