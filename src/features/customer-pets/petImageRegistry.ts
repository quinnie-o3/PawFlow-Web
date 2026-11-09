import type { CustomerPet } from "./types";

/** Layout owns uploaded URLs; drafts and saved records have independent references. */
export function createPetImageRegistry(revoke: (url: string) => void) {
  const owned = new Set<string>();
  const drafts = new Set<string>();
  let saved = new Set<string>();
  function sweep() {
    for (const url of owned) if (!drafts.has(url) && !saved.has(url)) {
      owned.delete(url);
      revoke(url);
    }
  }
  return {
    retainDraft(url: string) { owned.add(url); drafts.add(url); },
    releaseDraft(url: string) { drafts.delete(url); sweep(); },
    syncSaved(pets: CustomerPet[]) {
      saved = new Set(pets.flatMap((pet) => pet.image ? [pet.image.url] : []));
      sweep();
    },
    dispose() {
      for (const url of owned) revoke(url);
      owned.clear(); drafts.clear(); saved.clear();
    },
  };
}
