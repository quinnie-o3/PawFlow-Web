"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import { createPublicApi } from "./api";
import { publicCache } from "./resource";

const Context = createContext<{ cache: ReturnType<typeof publicCache>; api: ReturnType<typeof createPublicApi> } | null>(null);
export default function PublicCatalogProvider({ children }: { children: ReactNode }) {
  const [value] = useState(() => ({ cache: publicCache(), api: createPublicApi() }));
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function usePublicCatalog() { const value = useContext(Context); if (!value) throw Error("Public catalog missing"); return value; }
