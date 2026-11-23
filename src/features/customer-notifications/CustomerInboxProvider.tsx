"use client";

import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { MockInbox } from "./mockInbox";

const Context = createContext<MockInbox | null>(null);
export default function CustomerInboxProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => new MockInbox());
  useEffect(() => { void store.load(); return store.dispose; }, [store]);
  return <Context.Provider value={store}>{children}</Context.Provider>;
}
export function useCustomerInbox() {
  const store = useContext(Context);
  if (!store) throw new Error("Customer inbox workspace missing");
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return { store, state };
}
