import test from "node:test";
import assert from "node:assert/strict";
import { createProviderProfileMock } from "./data/providerProfileMock";
import { applyProfileValues, getProfileValues } from "./profileLogic";
import { normalizeProfileValues, validateProfileValues } from "./profileValidation";
import { profileImageFileError, profileImageMaxBytes } from "./profileImageValidation";

const values = () => getProfileValues(createProviderProfileMock());
const errors = (patch: Partial<ReturnType<typeof values>>, emailValid = true) => validateProfileValues({ ...values(), ...patch }, "all", emailValid);

test("Fresh profile fixtures are independent and protected metadata survives hostile form properties", () => {
  const original = createProviderProfileMock();
  const hostile = { ...values(), name: "Cơ sở Mới", ownerId: "other", ownerName: "Other", category: "Other", approvalStatus: "pending", id: "other" };
  const next = applyProfileValues(original, hostile, "all");
  assert.equal(next.name, "Cơ sở Mới");
  for (const key of ["id", "ownerId", "ownerName", "category", "approvalStatus"] as const) assert.equal(next[key], original[key]);
  assert.deepEqual(original, createProviderProfileMock());
});

test("Facility, contact and image forms cannot write fields outside their section", () => {
  const original = createProviderProfileMock();
  const input = { name: "New name", description: "New description", area: "New area", phone: "0123456789", email: "new@example.com" };
  const facility = applyProfileValues(original, input, "facility");
  assert.equal(facility.name, input.name);
  assert.equal(facility.description, input.description);
  assert.equal(facility.area, original.area);
  assert.equal(facility.phone, original.phone);
  assert.equal(facility.email, original.email);
  const contact = applyProfileValues(original, input, "contact");
  assert.equal(contact.name, original.name);
  assert.equal(contact.description, original.description);
  assert.equal(contact.area, input.area);
  assert.equal(contact.phone, input.phone);
  assert.equal(contact.email, input.email);
  assert.deepEqual(applyProfileValues(original, input, "images"), original);
});

test("Normalization trims edges, keeps Vietnamese accents and internal description whitespace", () => {
  const result = normalizeProfileValues({ name: "  Cơ sở Thú Cưng  ", description: "  Chăm sóc\n  theo lịch hẹn  ", area: "  Quận 3, Hồ Chí Minh  ", phone: " +84 900-000-002 ", email: " contact@example.com " });
  assert.deepEqual(result, { name: "Cơ sở Thú Cưng", description: "Chăm sóc\n  theo lịch hẹn", area: "Quận 3, Hồ Chí Minh", phone: "+84900000002", email: "contact@example.com" });
});

test("Whitespace cannot satisfy required fields; description is optional", () => {
  const result = errors({ name: "   ", area: "\t  ", phone: " -  ", email: "  ", description: "  " });
  for (const field of ["name", "area", "phone", "email"] as const) assert.ok(result[field]);
  assert.equal(result.description, undefined);
});

test("Name accepts inclusive 2 and 100 trimmed characters and rejects 1 or 101", () => {
  for (const length of [2, 100]) assert.equal(errors({ name: `  ${"đ".repeat(length)}  ` }).name, undefined);
  for (const length of [1, 101]) assert.ok(errors({ name: "đ".repeat(length) }).name);
});

test("Description accepts 2000 trimmed characters and rejects 2001", () => {
  assert.equal(errors({ description: `  ${"ả".repeat(2000)}  ` }).description, undefined);
  assert.ok(errors({ description: "ả".repeat(2001) }).description);
});

test("Area accepts 200 trimmed characters and rejects missing or 201", () => {
  assert.equal(errors({ area: `  ${"ô".repeat(200)}  ` }).area, undefined);
  assert.ok(errors({ area: "ô".repeat(201) }).area);
  assert.ok(errors({ area: "" }).area);
});

test("Phone accepts only 0 or +84 followed by exactly nine digits, allowing spaces and hyphens", () => {
  for (const phone of ["0900000002", "+84900000002", " 0900-000-002 ", "+84 900 000-002"]) assert.equal(errors({ phone }).phone, undefined, phone);
  for (const phone of ["", "090000002", "09000000002", "+840900000002", "84900000002", "+1 900000002", "0900.000.002", "090000000a"]) assert.ok(errors({ phone }).phone, phone);
});

test("Email uses native validity supplied by the browser and the inclusive 254 character limit", () => {
  assert.equal(errors({ email: `${"a".repeat(242)}@example.com` }).email, undefined);
  assert.ok(errors({ email: `${"a".repeat(243)}@example.com` }).email);
  assert.ok(errors({ email: "incorrect" }, false).email);
  assert.equal(errors({ email: " contact@example.com " }).email, undefined);
});

test("Section validation ignores unrelated fields and does not require text when editing images", () => {
  const input = { name: "", description: "", area: "", phone: "", email: "" };
  assert.deepEqual(Object.keys(validateProfileValues(input, "facility", false)), ["name"]);
  assert.deepEqual(Object.keys(validateProfileValues(input, "contact", false)), ["area", "phone", "email"]);
  assert.deepEqual(validateProfileValues(input, "images", false), {});
});

const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const jpeg = new Uint8Array([255, 216, 255, 224]);
const webp = new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]);

test("Image metadata accepts supported formats only when their actual signatures match", () => {
  for (const [type, header] of [["image/png", png], ["image/jpeg", jpeg], ["image/webp", webp]] as const) assert.equal(profileImageFileError({ type, size: 100 }, header), null);
  for (const type of ["image/gif", "image/svg+xml", "", "application/octet-stream"]) assert.ok(profileImageFileError({ type, size: 100 }, png));
  assert.ok(profileImageFileError({ type: "image/png", size: 100 }, jpeg));
  assert.ok(profileImageFileError({ type: "image/jpeg", size: 100 }, webp));
  assert.ok(profileImageFileError({ type: "image/webp", size: 100 }, png));
});

test("Image size limit includes exactly 5 MB and rejects empty, oversized or headerless files", () => {
  assert.equal(profileImageFileError({ type: "image/png", size: profileImageMaxBytes }, png), null);
  assert.ok(profileImageFileError({ type: "image/png", size: profileImageMaxBytes + 1 }, png));
  assert.ok(profileImageFileError({ type: "image/png", size: 0 }, png));
  assert.ok(profileImageFileError({ type: "image/png", size: 50 }, new Uint8Array()));
});
