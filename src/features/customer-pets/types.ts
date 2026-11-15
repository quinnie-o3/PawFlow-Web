/** Internal mock models; ownership here does not enforce backend security. */
export type PetType = { id: string; name: string; status: "ACTIVE" | "INACTIVE" };
export type PetImage = { url: string; fileName: string; mimeType: string; size: number; width: number; height: number };
export type PetValues = {
  name: string; petTypeId: string; breed: string | null; birthDate: string | null;
  weight: number | null; healthNote: string | null;
};
export type CustomerPet = PetValues & {
  id: string; ownerId: string; status: "ACTIVE" | "INACTIVE"; version: number;
  image: PetImage | null;
};
export type PetState = { pets: CustomerPet[]; petTypes: PetType[] };
export type PetDraft = { name: string; petTypeId: string; breed: string; birthDate: string; weight: string; healthNote: string };
export type PetField = keyof PetDraft | "image";
export type PetErrors = Partial<Record<keyof PetDraft, string>>;
export type PetActor = { id: string; role: string };
export type PetCommand =
  | { type: "create"; id: string; draft: PetDraft; image: PetImage | null }
  | { type: "update"; id: string; expectedVersion: number; draft: PetDraft; image: PetImage | null }
  | { type: "deactivate"; id: string; expectedVersion: number };
export type PetResult =
  | { ok: true; state: PetState; id: string }
  | { ok: false; state: PetState; message: string; errors?: PetErrors };
