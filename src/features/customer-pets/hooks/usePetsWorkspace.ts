import { useCallback, useEffect, useRef, useState } from "react";
import { createCustomerPetsMock } from "../data/customerPetsMock";
import { applyPetCommand, todayInVietnam } from "../petLogic";
import { createPetImageRegistry } from "../petImageRegistry";
import type { PetCommand } from "../types";

export function usePetsWorkspace() {
  const [state, setState] = useState(createCustomerPetsMock);
  const current = useRef(state);
  const [images] = useState(() => createPetImageRegistry((url) => URL.revokeObjectURL(url)));
  useEffect(() => () => images.dispose(), [images]);

  const mutatePet = useCallback((command: PetCommand, fail = false) => {
    const result = applyPetCommand(current.current, { id: "customer-demo", role: "CUSTOMER" }, command, todayInVietnam(), fail);
    if (result.ok) {
      // Transfer URL ownership before the editor releases its draft reference.
      images.syncSaved(result.state.pets);
      current.current = result.state;
      setState(result.state);
    }
    return result;
  }, [images]);

  const retainDraftImage = useCallback((url: string) => images.retainDraft(url), [images]);
  const releaseDraftImage = useCallback((url: string) => images.releaseDraft(url), [images]);
  return { petState: state, mutatePet, retainDraftImage, releaseDraftImage };
}
