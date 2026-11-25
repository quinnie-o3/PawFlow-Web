import type { CustomerPet, PetType, PetDraft } from "../customer-pets/types";
import type { CustomerProfile } from "./types";
import { normalizePetDraft } from "../customer-pets/petLogic";
const id = (value: unknown): string => {
  if (
    typeof value !== "string" ||
    !/^\d+$/.test(value) ||
    BigInt(value) <= BigInt(0) ||
    BigInt(value) > BigInt("9223372036854775807")
  )
    throw new Error("Invalid ID");
  return value;
};
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid response");
  return value as Record<string, unknown>;
};
const string = (value: unknown) => {
  if (typeof value !== "string") throw new Error("Invalid string");
  return value;
};
const nullable = (value: unknown) => (value === null ? null : string(value));
export function decodeProfile(body: unknown): CustomerProfile {
  const value = record(body);
  if (value.role !== "CUSTOMER" || value.status !== "ACTIVE")
    throw new Error("Invalid profile");
  return {
    id: id(value.id),
    role: "CUSTOMER",
    fullName: string(value.fullName),
    email: string(value.email),
    phone: nullable(value.phone),
  };
}
export function decodePet(body: unknown): CustomerPet {
  const value = record(body),
    weight = value.weight === null ? null : Number(value.weight);
  if (
    value.weight !== null &&
    typeof value.weight !== "string" &&
    typeof value.weight !== "number"
  )
    throw new Error("Invalid weight");
  if (value.status !== "ACTIVE" && value.status !== "INACTIVE")
    throw new Error("Invalid pet");
  if (
    weight !== null &&
    (!Number.isFinite(weight) || weight <= 0 || weight > 9999.99)
  )
    throw new Error("Invalid weight");
  return {
    id: id(value.id),
    ownerId: id(value.ownerId),
    petTypeId: id(value.petTypeId),
    name: string(value.name),
    breed: nullable(value.breed),
    birthDate: nullable(value.birthDate),
    healthNote: nullable(value.healthNote),
    weight,
    status: value.status,
    image: null,
    version: 0,
  };
}
export function decodePets(body: unknown): CustomerPet[] {
  if (!Array.isArray(body)) throw new Error("Invalid pets");
  return body.map(decodePet);
}
export function decodePetTypes(body: unknown): PetType[] {
  if (!Array.isArray(body)) throw new Error("Invalid types");
  return body.map((item) => {
    const value = record(item);
    return { id: id(value.id), name: string(value.name), status: "ACTIVE" };
  });
}
export function petBody(draft: PetDraft) {
  return normalizePetDraft(draft);
}
