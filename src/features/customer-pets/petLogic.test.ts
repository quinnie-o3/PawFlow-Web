import test from "node:test";
import assert from "node:assert/strict";
import { createCustomerPetsMock } from "./data/customerPetsMock";
import { activeOwnedPets, applyPetCommand, normalizePetDraft, petAge, petToDraft, todayInVietnam, validDateOnly, validatePetDraft } from "./petLogic";
import type { PetCommand, PetDraft, PetState } from "./types";

const actor = { id: "customer-demo", role: "CUSTOMER" };
const today = "2026-10-29";
const draft = (patch: Partial<PetDraft> = {}): PetDraft => ({ name: "Bông", petTypeId: "2", breed: "", birthDate: "", weight: "", healthNote: "", ...patch });
const errors = (patch: Partial<PetDraft>) => validatePetDraft(draft(patch), createCustomerPetsMock().petTypes, today);
const run = (state: PetState, command: PetCommand, fail = false) => applyPetCommand(state, actor, command, today, fail);

test("Fixtures and drafts are independent; editing or cancelling a draft cannot change the saved record", () => {
  const state = createCustomerPetsMock();
  const edit = petToDraft(state.pets[0]); edit.name = "Draft only"; edit.weight = "0";
  assert.deepEqual(state, createCustomerPetsMock());
});
test("Name boundaries after trim accept 1/100 Unicode characters and reject blank/101", () => {
  for (const name of [" X ", " " + "đ".repeat(100) + " ", "🐕".repeat(100)]) assert.equal(errors({ name }).name, undefined);
  for (const name of ["", " \t ", "đ".repeat(101), "🐕".repeat(101)]) assert.ok(errors({ name }).name);
});
test("Breed has the DTO 100-character limit; health notes have no invented length limit", () => {
  assert.equal(errors({ breed: " " + "a".repeat(100) + " " }).breed, undefined);
  assert.ok(errors({ breed: "a".repeat(101) }).breed);
  assert.deepEqual(errors({ healthNote: "Ghi chú\n".repeat(20000) }), {});
});
test("Only supported ACTIVE species can be chosen; an existing inactive type can be retained as in the API", () => {
  assert.ok(errors({ petTypeId: "" }).petTypeId);
  assert.ok(errors({ petTypeId: "99" }).petTypeId);
  const types = [{ id: "2", name: "Mèo", status: "INACTIVE" as const }];
  assert.ok(validatePetDraft(draft(), types, today).petTypeId);
  assert.equal(validatePetDraft(draft(), types, today, "2").petTypeId, undefined);
});
test("Birth dates are optional, valid calendar dates and never in the future", () => {
  for (const birthDate of ["", "2024-02-29", today]) assert.equal(errors({ birthDate }).birthDate, undefined);
  for (const birthDate of ["2023-02-29", "2026-04-31", "2026-10-30", "29/10/2026"]) assert.ok(errors({ birthDate }).birthDate);
  assert.equal(validDateOnly("2026-02-30"), false);
});
test("Vietnam calendar day is explicit at the UTC boundary; age changes on the actual birthday", () => {
  assert.equal(todayInVietnam(new Date("2026-10-28T16:59:59Z")), "2026-10-28");
  assert.equal(todayInVietnam(new Date("2026-10-28T17:00:00Z")), "2026-10-29");
  assert.equal(petAge("2023-05-20", "2026-05-19"), "2 tuổi");
  assert.equal(petAge("2023-05-20", "2026-05-20"), "3 tuổi");
  assert.equal(petAge(null, today), "Chưa có ngày sinh");
  assert.equal(petAge(today, today), "Dưới 1 tháng tuổi");
  assert.equal(petAge("2026-09-29", today), "1 tháng tuổi");
});
test("Weight distinguishes optional blank from zero and enforces inclusive bounds/decimal precision", () => {
  for (const weight of ["", "  ", "0.01", "5,55", "5.55", "9999.99", "9999,99", "1.230", "1e2"]) assert.equal(errors({ weight }).weight, undefined, weight);
  for (const weight of ["0", "-1", "10000", "9999.991", "5.555", "1e-7", "NaN", "Infinity", "abc"]) assert.ok(errors({ weight }).weight, weight);
  assert.equal(normalizePetDraft(draft()).weight, null);
  assert.equal(normalizePetDraft(draft({ weight: "5,5" })).weight, 5.5);
});
test("Blank optional fields become explicit nulls so an edit can clear them without touching identity", () => {
  const state = createCustomerPetsMock();
  const result = run(state, { type: "update", id: state.pets[0].id, expectedVersion: 1, draft: draft({ name: "Milo", petTypeId: "1" }), image: state.pets[0].image });
  assert.ok(result.ok);
  if (!result.ok) return;
  for (const field of ["breed", "birthDate", "weight", "healthNote"] as const) assert.equal(result.state.pets[0][field], null);
  assert.equal(result.state.pets[0].id, "pet-milo");
  assert.equal(result.state.pets[0].version, 2);
  assert.deepEqual(state, createCustomerPetsMock());
});
test("Create is immutable, assigns the current owner and ignores hostile extra identity/status fields", () => {
  const state = createCustomerPetsMock();
  const hostile = { ...draft({ name: " Bông ", healthNote: "  Dòng 1\n Dòng 2  " }), ownerId: "other", status: "INACTIVE", version: 500 };
  const result = run(state, { type: "create", id: "pet-bong", draft: hostile, image: null });
  assert.ok(result.ok);
  if (!result.ok) return;
  const pet = result.state.pets[0];
  assert.equal(pet.ownerId, actor.id); assert.equal(pet.status, "ACTIVE"); assert.equal(pet.version, 1);
  assert.equal(pet.name, "Bông"); assert.equal(pet.healthNote, "Dòng 1\n Dòng 2");
  assert.equal(state.pets.length, 1);
});
test("Update uses the latest record and keeps readonly owner/id/status while incrementing version", () => {
  const state = createCustomerPetsMock();
  const result = run(state, { type: "update", id: "pet-milo", expectedVersion: 1, draft: petToDraft({ ...state.pets[0], name: "Milo mới", weight: 7.25 }), image: null });
  assert.ok(result.ok);
  if (!result.ok) return;
  assert.equal(result.state.pets[0].name, "Milo mới"); assert.equal(result.state.pets[0].weight, 7.25);
  assert.equal(result.state.pets[0].ownerId, actor.id);
  assert.equal(state.pets[0].name, "Milo");
});
test("Soft deletion keeps the entire record/image but removes it from active/new-booking selection", () => {
  const state = createCustomerPetsMock();
  const result = run(state, { type: "deactivate", id: "pet-milo", expectedVersion: 1 });
  assert.ok(result.ok);
  if (!result.ok) return;
  assert.equal(result.state.pets.length, state.pets.length);
  assert.deepEqual(result.state.pets[0], { ...state.pets[0], status: "INACTIVE", version: 2 });
  assert.deepEqual(activeOwnedPets(result.state, actor), []);
  assert.equal(state.pets[0].status, "ACTIVE");
});
test("Ownership and role are checked on reads and every mutation; client rules are only mock behavior", () => {
  const state = createCustomerPetsMock();
  const command: PetCommand = { type: "update", id: "pet-milo", expectedVersion: 1, draft: draft(), image: null };
  for (const other of [{ id: "other", role: "CUSTOMER" }, { id: actor.id, role: "PROVIDER_OWNER" }]) {
    assert.deepEqual(activeOwnedPets(state, other), []);
    const update = applyPetCommand(state, other, command, today);
    assert.equal(update.ok, false); assert.equal(update.state, state);
    assert.equal(applyPetCommand(state, other, { type: "deactivate", id: "pet-milo", expectedVersion: 1 }, today).ok, false);
  }
  assert.equal(applyPetCommand(state, { id: actor.id, role: "ADMIN" }, { type: "create", id: "new", draft: draft(), image: null }, today).ok, false);
});
test("Missing/inactive/stale/duplicate IDs reject commands without changing state", () => {
  const state = createCustomerPetsMock();
  const inactive = { ...state, pets: state.pets.map((pet) => ({ ...pet, status: "INACTIVE" as const })) };
  for (const [target, command] of [
    [state, { type: "deactivate", id: "missing", expectedVersion: 1 }],
    [state, { type: "deactivate", id: "pet-milo", expectedVersion: 0 }],
    [inactive, { type: "deactivate", id: "pet-milo", expectedVersion: 1 }],
    [state, { type: "create", id: "pet-milo", draft: draft(), image: null }],
  ] as [PetState, PetCommand][]) { const result = run(target, command); assert.equal(result.ok, false); assert.equal(result.state, target); }
});
test("Simulated create/update/delete failures keep the exact state, versions and saved images", () => {
  const state = createCustomerPetsMock();
  const commands: PetCommand[] = [
    { type: "create", id: "pet-bong", draft: draft(), image: null },
    { type: "update", id: "pet-milo", expectedVersion: 1, draft: draft(), image: null },
    { type: "deactivate", id: "pet-milo", expectedVersion: 1 },
  ];
  for (const command of commands) {
    const result = run(state, command, true); assert.equal(result.ok, false); assert.equal(result.state, state);
    assert.deepEqual(state, createCustomerPetsMock());
    assert.equal(run(state, command).ok, true);
  }
});
