import { vi, formatMessage } from "../../lib/locale";
import type { CustomerPet, PetActor, PetCommand, PetDraft, PetErrors, PetResult, PetState, PetType, PetValues } from "./types";

export function todayInVietnam(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function validDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function petAge(birthDate: string | null, today: string): string {
  if (!birthDate || !validDateOnly(birthDate) || birthDate > today) return vi.customer.pets.validation.noBirthDate;
  const [y, m, d] = birthDate.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  const months = (ty - y) * 12 + tm - m - (td < d ? 1 : 0);
  const years = Math.floor(months / 12);
  if (years > 0) return formatMessage(vi.customer.pets.validation.years, { years: years });
  if (months > 0) return formatMessage(vi.customer.pets.validation.months, { months: months });
  return vi.customer.pets.validation.underOneMonth;
}

export function petToDraft(pet?: CustomerPet): PetDraft {
  return { name: pet?.name ?? "", petTypeId: pet?.petTypeId ?? "", breed: pet?.breed ?? "",
    birthDate: pet?.birthDate ?? "", weight: pet?.weight?.toString() ?? "", healthNote: pet?.healthNote ?? "" };
}

function weightNumber(raw: string): number | null {
  return raw.trim() === "" ? null : Number(raw.trim().replace(",", "."));
}

function decimalPlaces(value: number): number {
  const [base, exponent = "0"] = value.toString().toLowerCase().split("e");
  return Math.max(0, (base.split(".")[1]?.length ?? 0) - Number(exponent));
}

export function validatePetDraft(draft: PetDraft, types: PetType[], today: string, previousTypeId?: string): PetErrors {
  const errors: PetErrors = {};
  const name = draft.name.trim();
  if (!name || [...name].length > 100) errors.name = vi.customer.pets.validation.name;
  const type = types.find((item) => item.id === draft.petTypeId);
  // The current API permits retaining an existing inactive type while editing other fields.
  if (!type || (type.status !== "ACTIVE" && type.id !== previousTypeId)) errors.petTypeId = vi.customer.pets.validation.type;
  if ([...draft.breed.trim()].length > 100) errors.breed = vi.customer.pets.validation.breed;
  if (draft.birthDate && (!validDateOnly(draft.birthDate) || draft.birthDate > today)) errors.birthDate = vi.customer.pets.validation.birthDate;
  const weight = weightNumber(draft.weight);
  if (weight !== null && (!Number.isFinite(weight) || weight <= 0 || weight > 9999.99 || decimalPlaces(weight) > 2)) {
    errors.weight = vi.customer.pets.validation.weight;
  }
  return errors;
}

export function normalizePetDraft(draft: PetDraft): PetValues {
  return { name: draft.name.trim(), petTypeId: draft.petTypeId, breed: draft.breed.trim() || null,
    birthDate: draft.birthDate || null, weight: weightNumber(draft.weight), healthNote: draft.healthNote.trim() || null };
}

export function activeOwnedPets(state: PetState, actor: PetActor): CustomerPet[] {
  if (actor.role !== "CUSTOMER") return [];
  return state.pets.filter((pet) => pet.ownerId === actor.id && pet.status === "ACTIVE");
}

export function applyPetCommand(state: PetState, actor: PetActor, command: PetCommand, today: string, fail = false): PetResult {
  const reject = (message: string, errors?: PetErrors): PetResult => ({ ok: false, state, message, errors });
  if (actor.role !== "CUSTOMER") return reject(vi.customer.pets.validation.unauthorized);
  const existing = state.pets.find((pet) => pet.id === command.id);
  if (command.type === "create") {
    if (existing) return reject(vi.customer.pets.validation.duplicate);
  } else {
    if (!existing || existing.status !== "ACTIVE") return reject(vi.customer.pets.validation.inactive);
    if (existing.ownerId !== actor.id) return reject(vi.customer.pets.validation.notOwner);
    if (existing.version !== command.expectedVersion) return reject(vi.customer.pets.validation.stale);
  }
  if (command.type !== "deactivate") {
    const errors = validatePetDraft(command.draft, state.petTypes, today, existing?.petTypeId);
    if (Object.keys(errors).length) return reject(vi.customer.pets.validation.invalid, errors);
  }
  if (fail) return reject(vi.customer.pets.validation.mockFailure);
  if (command.type === "deactivate") {
    return { ok: true, id: command.id, state: { ...state, pets: state.pets.map((pet) => pet.id === command.id ? { ...pet, status: "INACTIVE", version: pet.version + 1 } : pet) } };
  }
  const values = normalizePetDraft(command.draft);
  const next: CustomerPet = command.type === "create"
    ? { ...values, id: command.id, ownerId: actor.id, status: "ACTIVE", version: 1, image: command.image }
    : { ...existing!, ...values, image: command.image, version: existing!.version + 1 };
  return { ok: true, id: command.id, state: { ...state, pets: command.type === "create" ? [next, ...state.pets] : state.pets.map((pet) => pet.id === command.id ? next : pet) } };
}
