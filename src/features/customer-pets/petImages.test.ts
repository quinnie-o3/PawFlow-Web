import test from "node:test";
import assert from "node:assert/strict";
import { petImageFileError, petImageMaxBytes } from "./petImageValidation";
import { createPetImageRegistry } from "./petImageRegistry";
import { createCustomerPetsMock } from "./data/customerPetsMock";

const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
const jpeg = new Uint8Array([255, 216, 255, 224]);
const webp = new TextEncoder().encode("RIFF1234WEBP");
const withImage = (url: string) => createCustomerPetsMock().pets.map((pet) => ({ ...pet, image: { ...pet.image!, url } }));

test("Only matching JPEG/PNG/WebP signatures and MIME types are accepted", () => {
  for (const [type, header] of [["image/png", png], ["image/jpeg", jpeg], ["image/webp", webp]] as const) assert.equal(petImageFileError({ type, size: 20 }, header), null);
  assert.ok(petImageFileError({ type: "image/gif", size: 20 }, png));
  assert.ok(petImageFileError({ type: "image/png", size: 20 }, jpeg));
  assert.ok(petImageFileError({ type: "image/png", size: 20 }, new Uint8Array()));
});
test("The 5 MiB limit is inclusive; empty and oversized files are rejected", () => {
  assert.equal(petImageFileError({ type: "image/png", size: petImageMaxBytes }, png), null);
  for (const size of [0, petImageMaxBytes + 1]) assert.ok(petImageFileError({ type: "image/png", size }, png));
});
test("Cancelling/replacing an unsaved draft releases only its URL, once", () => {
  const revoked: string[] = []; const registry = createPetImageRegistry((url) => revoked.push(url));
  registry.syncSaved(withImage("/fixture.png"));
  registry.retainDraft("blob:draft"); registry.releaseDraft("blob:draft"); registry.releaseDraft("blob:draft");
  assert.deepEqual(revoked, ["blob:draft"]);
});
test("Successful Save transfers URL to the layout; closing editor/changing tabs cannot revoke it early", () => {
  const revoked: string[] = []; const registry = createPetImageRegistry((url) => revoked.push(url));
  registry.retainDraft("blob:saved"); registry.syncSaved(withImage("blob:saved")); registry.releaseDraft("blob:saved");
  assert.deepEqual(revoked, []);
  registry.dispose(); registry.dispose(); assert.deepEqual(revoked, ["blob:saved"]);
});
test("A failed Save retains saved and draft images until Cancel; replacing a saved image releases the old URL", () => {
  const revoked: string[] = []; const registry = createPetImageRegistry((url) => revoked.push(url));
  registry.retainDraft("blob:old"); registry.syncSaved(withImage("blob:old")); registry.releaseDraft("blob:old");
  registry.retainDraft("blob:failed"); assert.deepEqual(revoked, []); // failed mutation never syncs new saved records
  registry.releaseDraft("blob:failed"); assert.deepEqual(revoked, ["blob:failed"]);
  registry.retainDraft("blob:new"); registry.syncSaved(withImage("blob:new")); registry.releaseDraft("blob:new");
  assert.deepEqual(revoked, ["blob:failed", "blob:old"]);
  registry.dispose(); assert.deepEqual(revoked, ["blob:failed", "blob:old", "blob:new"]);
});
test("Soft-deleted records retain referenced images until the account workspace ends", () => {
  const revoked: string[] = []; const registry = createPetImageRegistry((url) => revoked.push(url));
  registry.retainDraft("blob:pet"); registry.syncSaved(withImage("blob:pet")); registry.releaseDraft("blob:pet");
  registry.syncSaved(withImage("blob:pet").map((pet) => ({ ...pet, status: "INACTIVE" as const })));
  assert.deepEqual(revoked, []); registry.dispose(); assert.deepEqual(revoked, ["blob:pet"]);
});
