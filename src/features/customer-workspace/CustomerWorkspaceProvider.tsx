"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { createCustomerAccountMock, customerMockActorId } from "@/features/customer-account/data/customerAccountMock";
import { applyProfileUpdate } from "@/features/customer-account/profileLogic";
import type { CustomerProfile, CustomerProfileUpdate } from "@/features/customer-account/types";
import { usePetsWorkspace } from "@/features/customer-pets/hooks/usePetsWorkspace";

type CustomerWorkspace = {
  profile: CustomerProfile;
  updateProfile: (update: CustomerProfileUpdate) => void;
} & ReturnType<typeof usePetsWorkspace>;

const WorkspaceContext = createContext<CustomerWorkspace | null>(null);

/** One in-memory workspace per /account layout mount, shared by both routes. */
export default function CustomerWorkspaceProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState(createCustomerAccountMock);
  const petsWorkspace = usePetsWorkspace();

  function updateProfile(update: CustomerProfileUpdate) {
    setProfile((current) => applyProfileUpdate(current, customerMockActorId, update));
  }

  return <WorkspaceContext.Provider value={{ profile, updateProfile, ...petsWorkspace }}>{children}</WorkspaceContext.Provider>;
}

export function useCustomerWorkspace() {
  const workspace = useContext(WorkspaceContext);
  if (!workspace) throw new Error("Customer workspace must be mounted inside /account.");
  return workspace;
}
