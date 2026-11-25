"use client";

import { useSession } from "../session/SessionProvider";
import { createContext, useContext, useState, type ReactNode } from "react";
import { createCustomerAccountMock, customerMockActorId } from "@/features/customer-account/data/customerAccountMock";
import { applyProfileUpdate } from "@/features/customer-account/profileLogic";
import type { CustomerProfile, CustomerProfileUpdate } from "@/features/customer-account/types";
import { usePetsWorkspace } from "@/features/customer-pets/hooks/usePetsWorkspace";

export type CustomerWorkspace = {
  profile: CustomerProfile;
  updateProfile: (update: CustomerProfileUpdate) => void | Promise<void>;
  loadPet?: (id: string) => Promise<void>;
  live?: boolean; loadStatus?: "loading"|"ready"|"error"; loadError?: string|null; reload?: () => Promise<void>;
} & Omit<ReturnType<typeof usePetsWorkspace>, "mutatePet"> & { mutatePet: (command: import("../customer-pets/types").PetCommand, fail?: boolean) => import("../customer-pets/types").PetResult | Promise<import("../customer-pets/types").PetResult> };

export const WorkspaceContext = createContext<CustomerWorkspace | null>(null);

/** One in-memory Customer workspace across account, discovery and booking routes. */
export default function CustomerWorkspaceProvider({ children }: { children: ReactNode }) {
  const session=useSession();
  return <MockWorkspace key={session.epoch}>{children}</MockWorkspace>;
}
function MockWorkspace({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState(createCustomerAccountMock);
  const petsWorkspace = usePetsWorkspace();

  function updateProfile(update: CustomerProfileUpdate) {
    setProfile((current) => applyProfileUpdate(current, customerMockActorId, update));
  }

  return <WorkspaceContext.Provider value={{ profile, updateProfile, ...petsWorkspace }}>{children}</WorkspaceContext.Provider>;
}

export function useCustomerWorkspace() {
  const workspace = useContext(WorkspaceContext);
  if (!workspace) throw new Error("Customer workspace is missing.");
  return workspace;
}
