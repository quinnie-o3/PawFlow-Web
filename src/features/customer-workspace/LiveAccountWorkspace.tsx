"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { WorkspaceContext } from "./CustomerWorkspaceProvider";
import { useSession } from "../session/SessionProvider";
import {
  bffRequest,
  privateCache,
  apiMessage,
  acceptSession,
  notifySessionChange,
  snapshot,
} from "../session/client";
import { isRequestCancelled } from "../../lib/api/errors";
import {
  decodeProfile,
  decodePet,
  decodePets,
  decodePetTypes,
  petBody,
} from "../customer-account/api";
import type {
  CustomerProfile,
  CustomerProfileUpdate,
} from "../customer-account/types";
import type { PetState, PetCommand, PetResult } from "../customer-pets/types";

export default function LiveAccountWorkspace({
  children,
}: {
  children: ReactNode;
}) {
  const session = useSession();
  const user = session.session!.user!;
  const [profile, setProfile] = useState<CustomerProfile>({
    id: user.id,
    role: "CUSTOMER",
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
  });
  const [petState, setPets] = useState<PetState>({ pets: [], petTypes: [] });
  const current = useRef(petState);
  const [loadStatus, setStatus] = useState<"loading" | "ready" | "error">(
      "loading",
    ),
    [loadError, setError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const revision = useRef(0);
  const reload = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const version = ++revision.current;
    setStatus("loading");
    setError(null);
    const ticket = privateCache.ticket(["v1", "account"]);
    try {
      const [p, pets, types] = await Promise.all([
        bffRequest("/users/me", { signal: controller.signal }),
        bffRequest("/pets", { signal: controller.signal }),
        bffRequest("/pet-types", { signal: controller.signal }),
      ]);
      const nextProfile = decodeProfile(p.body),
        next = {
          pets: decodePets(pets.body),
          petTypes: decodePetTypes(types.body),
        };
      for (const pet of next.pets)
        if (!next.petTypes.some((type) => type.id === pet.petTypeId))
          next.petTypes.push({
            id: pet.petTypeId,
            name: `Loại #${pet.petTypeId}`,
            status: "INACTIVE",
          });
      if (
        nextProfile.id !== user.id ||
        next.pets.some((pet) => pet.ownerId !== user.id)
      )
        throw new Error("Invalid owner response");
      if (
        controller.signal.aborted ||
        version !== revision.current ||
        !privateCache.write(ticket, next, 0)
      )
        return;
      current.current = next;
      setPets(next);
      setProfile(nextProfile);
      setStatus("ready");
    } catch (error) {
      if (!isRequestCancelled(error) && !controller.signal.aborted) {
        setStatus("error");
        setError(apiMessage(error));
      }
    }
  }, [user.id]);
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return reload();
    });
    return () => {
      active = false;
      request.current?.abort();
    };
  }, [reload]);
  const updateProfile = async (update: CustomerProfileUpdate) => {
    const result = await bffRequest("/users/me", {
      method: "PATCH",
      body: {
        fullName: update.fullName,
        ...(update.phone !== undefined ? { phone: update.phone } : {}),
      },
    });
    const next = decodeProfile(result.body);
    if (next.id !== user.id) throw new Error("Invalid identity");
    revision.current++;
    request.current?.abort();
    privateCache.invalidate(["v1", "account"]);
    setProfile(next);
    setStatus("ready");
    const view = snapshot().session;
    if (view?.user?.id === next.id) {
      acceptSession({
        ...view,
        user: { ...view.user, fullName: next.fullName, phone: next.phone },
      });
      notifySessionChange();
    }
  };
  const loadPet = async (id: string) => {
    const result = await bffRequest(`/pets/${id}`),
      pet = decodePet(result.body);
    if (pet.ownerId !== user.id || pet.id !== id)
      throw new Error("Invalid owner response");
    revision.current++;
    request.current?.abort();
    privateCache.invalidate(["v1", "account"]);
    const next = {
      ...current.current,
      pets: current.current.pets.map((p) => (p.id === id ? pet : p)),
    };
    current.current = next;
    setPets(next);
    setStatus("ready");
  };
  const mutatePet = async (command: PetCommand): Promise<PetResult> => {
    try {
      const result = await bffRequest(
        command.type === "create" ? "/pets" : `/pets/${command.id}`,
        {
          method:
            command.type === "create"
              ? "POST"
              : command.type === "update"
                ? "PATCH"
                : "DELETE",
          body: command.type === "deactivate" ? {} : petBody(command.draft),
        },
      );
      const pet = command.type === "deactivate" ? null : decodePet(result.body);
      if (pet && pet.ownerId !== user.id)
        throw new Error("Invalid owner response");
      revision.current++;
      request.current?.abort();
      privateCache.invalidate(["v1", "account"]);
      const next = {
        ...current.current,
        pets: pet
          ? command.type === "create"
            ? [pet, ...current.current.pets]
            : current.current.pets.map((p) => (p.id === pet.id ? pet : p))
          : current.current.pets.filter((p) => p.id !== command.id),
      };
      current.current = next;
      setPets(next);
      setStatus("ready");
      return { ok: true, state: next, id: pet?.id ?? command.id };
    } catch (error) {
      if (isRequestCancelled(error)) throw error;
      return { ok: false, state: current.current, message: apiMessage(error) };
    }
  };
  const noop = useCallback(() => {}, []);
  const getPetState = useCallback(() => current.current, []);
  return (
    <WorkspaceContext.Provider
      value={{
        profile,
        updateProfile,
        petState,
        getPetState,
        mutatePet,
        retainDraftImage: noop,
        releaseDraftImage: noop,
        live: true,
        loadStatus,
        loadError,
        reload,
        loadPet,
      }}
    >
      {loadError && (
        <div role="alert" className="m-4 space-y-2">
          <p>{loadError}</p>
          <button onClick={() => void reload()}>Tải lại dữ liệu</button>
        </div>
      )}
      {children}
    </WorkspaceContext.Provider>
  );
}
