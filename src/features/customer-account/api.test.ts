import test from "node:test";
import assert from "node:assert/strict";
import {
  decodePet,
  decodePets,
  decodePetTypes,
  decodeProfile,
  petBody,
} from "./api";
const pet = {
  id: "9007199254740993",
  ownerId: "1",
  petTypeId: "2",
  name: "Mèo",
  breed: null,
  birthDate: null,
  weight: "5.50",
  healthNote: null,
  status: "ACTIVE",
};
test("pet wire DTO preserves bigint IDs, numeric strings/null, and excludes UI-only fields", () => {
  assert.equal(decodePet(pet).id, "9007199254740993");
  assert.equal(decodePet(pet).weight, 5.5);
  assert.equal(decodePet({ ...pet, weight: null }).weight, null);
  assert.throws(() => decodePet({ ...pet, id: 9007199254740993 }));
  assert.throws(() => decodePet({ ...pet, weight: "NaN" }));
  assert.throws(() => decodePet({ ...pet, weight: true }));
  assert.throws(() => decodePets({ items: [pet] }));
  assert.deepEqual(
    petBody({
      name: " Mèo ",
      petTypeId: "2",
      breed: "",
      birthDate: "",
      weight: "5,5",
      healthNote: "",
    }),
    {
      name: "Mèo",
      petTypeId: "2",
      breed: null,
      birthDate: null,
      weight: 5.5,
      healthNote: null,
    },
  );
  assert.deepEqual(decodePetTypes([{ id: "2", name: "Cat" }]), [
    { id: "2", name: "Cat", status: "ACTIVE" },
  ]);
});
test("profile projection rejects noncustomer identity and omits extra fields", () => {
  const user = {
    id: "1",
    fullName: "Customer",
    email: "test@example.test",
    phone: null,
    role: "CUSTOMER",
    status: "ACTIVE",
    address: "ignored",
  };
  assert.equal("address" in decodeProfile(user), false);
  assert.throws(() => decodeProfile({ ...user, role: "ADMIN" }));
  assert.throws(() => decodeProfile({ ...user, status: "SUSPENDED" }));
});
