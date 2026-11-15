import test from "node:test";
import assert from "node:assert/strict";
import { createCustomerAccountMock, customerMockActorId } from "./data/customerAccountMock";
import { applyProfileUpdate, prepareProfileUpdate, profileToDraft, validateProfileDraft } from "./profileLogic";

test("Names keep Vietnamese accents and internal spacing; only edges are trimmed", () => {
  assert.deepEqual(prepareProfileUpdate({ fullName: "  Nguyễn  Mai Anh  ", phone: " +84 900-000-000 " }), {
    fullName: "Nguyễn  Mai Anh", phone: "+84 900-000-000",
  });
});

test("Name boundaries apply after trim: accept 2/150, reject blank/1/151", () => {
  for (const length of [2, 150]) assert.equal(validateProfileDraft({ fullName: " " + "Đ".repeat(length) + " ", phone: "" }).fullName, undefined);
  for (const fullName of ["", "   ", "A", "Đ".repeat(151)]) assert.ok(validateProfileDraft({ fullName, phone: "" }).fullName);
});

test("Phone is optional, has a trimmed 20-character limit, and has no Provider format rule", () => {
  for (const phone of ["", "  ", "123", "+1 (555) 123-4567", " " + "1".repeat(20) + " "]) {
    assert.equal(validateProfileDraft({ fullName: "Mai Anh", phone }).phone, undefined);
  }
  assert.ok(validateProfileDraft({ fullName: "Mai Anh", phone: "1".repeat(21) }).phone);
});

test("Blank phone follows PATCH omission semantics, preserving an existing value or null", () => {
  const original = createCustomerAccountMock();
  const update = prepareProfileUpdate({ fullName: "Mai Anh", phone: "  " });
  assert.equal(update.phone, undefined);
  assert.equal(applyProfileUpdate(original, customerMockActorId, update).phone, original.phone);
  assert.equal(applyProfileUpdate({ ...original, phone: null }, customerMockActorId, update).phone, null);
  assert.equal(profileToDraft({ ...original, phone: null }).phone, "");
});

test("Submitted identity/email/role/address fields cannot overwrite protected fields", () => {
  const original = createCustomerAccountMock();
  const hostile = { fullName: "Tên mới", phone: "123", id: "other", email: "other@example.com", role: "ADMIN", address: "Other" };
  const next = applyProfileUpdate(original, customerMockActorId, hostile);
  assert.equal(next.fullName, "Tên mới");
  assert.equal(next.phone, "123");
  assert.equal(next.id, original.id);
  assert.equal(next.email, original.email);
  assert.equal(next.role, "CUSTOMER");
  assert.equal("address" in next, false);
  assert.deepEqual(original, createCustomerAccountMock());
});

test("Mock ownership rejects another actor, and fresh fixtures/drafts are independent", () => {
  const original = createCustomerAccountMock();
  assert.throws(() => applyProfileUpdate(original, "another-customer", { fullName: "Other" }));
  const draft = profileToDraft(original);
  draft.fullName = "Bản nháp";
  assert.deepEqual(original, createCustomerAccountMock());
});
