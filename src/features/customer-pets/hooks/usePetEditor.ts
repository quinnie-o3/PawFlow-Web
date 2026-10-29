import { useEffect, useRef, useState } from "react";
import { useCustomerWorkspace } from "@/features/customer-workspace/CustomerWorkspaceProvider";
import { decodePetImage } from "../petImageValidation";
import { petToDraft, todayInVietnam, validatePetDraft } from "../petLogic";
import { petMockDelay } from "../mockDelay";
import type { CustomerPet, PetDraft, PetErrors, PetField, PetImage } from "../types";

type Editor = {
  id: string; version: number | null; fromDetails: boolean; draft: PetDraft;
  image: PetImage | null; originalImage: PetImage | null; errors: PetErrors;
  imageError: string | null; decoding: boolean; saveError: string | null;
};
export type PetEditorOutcome = { ok: true; id: string; fromDetails: boolean } | { ok: false; firstError?: PetField };

export function usePetEditor() {
  const { petState, mutatePet, retainDraftImage, releaseDraftImage } = useCustomerWorkspace();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [saving, setSaving] = useState(false);
  const current = useRef<Editor | null>(null);
  const draftUrl = useRef<string | null>(null);
  const decoder = useRef<AbortController | null>(null);
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const busy = useRef(false);

  useEffect(() => () => {
    generation.current++;
    decoder.current?.abort();
    request.current?.abort();
    if (draftUrl.current) releaseDraftImage(draftUrl.current);
    draftUrl.current = null;
  }, [releaseDraftImage]);

  function update(change: (value: Editor) => Editor) {
    if (!current.current) return;
    const next = change(current.current);
    current.current = next;
    setEditor(next);
  }

  function releaseDraft() {
    if (draftUrl.current) releaseDraftImage(draftUrl.current);
    draftUrl.current = null;
  }

  function open(pet?: CustomerPet, fromDetails = false) {
    if (busy.current) return;
    generation.current++;
    decoder.current?.abort();
    releaseDraft();
    const next: Editor = {
      id: pet?.id ?? "mock-pet-" + crypto.randomUUID(), version: pet?.version ?? null, fromDetails,
      draft: petToDraft(pet), image: pet?.image ?? null, originalImage: pet?.image ?? null,
      errors: {}, imageError: null, decoding: false, saveError: null,
    };
    current.current = next; setEditor(next);
  }

  function close() {
    if (busy.current) return false;
    generation.current++;
    decoder.current?.abort();
    releaseDraft();
    current.current = null; setEditor(null);
    return true;
  }

  function change(field: keyof PetDraft, value: string) {
    if (busy.current) return;
    update((valueNow) => ({ ...valueNow, draft: { ...valueNow.draft, [field]: value },
      errors: { ...valueNow.errors, [field]: undefined }, saveError: null }));
  }

  async function selectImage(file: File) {
    if (!current.current || busy.current) return;
    const token = ++generation.current;
    decoder.current?.abort();
    const controller = new AbortController();
    decoder.current = controller;
    update((value) => ({ ...value, decoding: true, imageError: null, saveError: null }));
    try {
      const image = await decodePetImage(file, controller.signal);
      if (token !== generation.current || !current.current) {
        URL.revokeObjectURL(image.url);
        return;
      }
      retainDraftImage(image.url);
      releaseDraft();
      draftUrl.current = image.url;
      update((value) => ({ ...value, image, decoding: false }));
    } catch (error) {
      if (token !== generation.current || controller.signal.aborted) return;
      update((value) => ({ ...value, decoding: false, imageError: error instanceof Error ? error.message : "Không đọc được ảnh." }));
    } finally {
      if (decoder.current === controller) decoder.current = null;
    }
  }

  function discardImageSelection() {
    if (busy.current) return;
    generation.current++;
    decoder.current?.abort();
    releaseDraft();
    update((value) => ({ ...value, image: value.originalImage, decoding: false, imageError: null }));
  }

  async function save(fail: boolean, onAttempt: () => void): Promise<PetEditorOutcome> {
    const value = current.current;
    if (!value || busy.current || value.decoding) return { ok: false };
    const previousTypeId = value.version !== null ? petState.pets.find((pet) => pet.id === value.id)?.petTypeId : undefined;
    const errors = validatePetDraft(value.draft, petState.petTypes, todayInVietnam(), previousTypeId);
    const firstError = (["name", "petTypeId", "breed", "birthDate", "weight", "healthNote"] as const).find((field) => errors[field]);
    if (firstError || value.imageError) {
      update((now) => ({ ...now, errors, saveError: null }));
      return { ok: false, firstError: firstError ?? "image" };
    }
    busy.current = true;
    const controller = new AbortController();
    request.current = controller;
    onAttempt();
    setSaving(true);
    update((now) => ({ ...now, errors: {}, saveError: null }));
    try {
      await petMockDelay(controller.signal);
      if (controller.signal.aborted) return { ok: false };
      const command = value.version === null
        ? { type: "create" as const, id: value.id, draft: value.draft, image: value.image }
        : { type: "update" as const, id: value.id, expectedVersion: value.version, draft: value.draft, image: value.image };
      const result = mutatePet(command, fail);
      if (!result.ok) {
        update((now) => ({ ...now, saveError: result.message, errors: result.errors ?? {} }));
        return { ok: false, firstError: result.errors ? (Object.keys(result.errors)[0] as keyof PetDraft) : undefined };
      }
      releaseDraft(); // saved references were registered by the layout before this release
      current.current = null; setEditor(null);
      return { ok: true, id: result.id, fromDetails: value.fromDetails };
    } catch {
      if (!controller.signal.aborted) update((now) => ({ ...now, saveError: "Không lưu được bản mô phỏng. Bản nháp vẫn được giữ; vui lòng thử lại." }));
      return { ok: false };
    } finally {
      if (request.current === controller) {
        request.current = null; busy.current = false;
        if (!controller.signal.aborted) setSaving(false);
      }
    }
  }

  return { editor, saving, open, close, change, selectImage, discardImageSelection, save };
}
