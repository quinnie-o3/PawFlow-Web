"use client";

import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { vi, formatMessageParts } from "@/lib/locale";
import { useCustomerWorkspace } from "../customer-workspace/CustomerWorkspaceProvider";
import { createCatalogMock, MOCK_NOW } from "../customer-catalog/data/catalogMock";
import { createMockRepository } from "../customer-catalog/mockRepository";
import { TIME_ZONE } from "../customer-catalog/catalogLogic";
import type { Species } from "../customer-catalog/types";
import { BookingMockWorkspace, type SubmitFault, type WorkspaceSnapshot } from "../customer-booking/mockWorkspace";
import type { Actor } from "../customer-booking/model";
import styles from "./shell.module.css";

type Fault = "search" | "detail" | "availability" | "bookings" | "action" | "lookup";
interface Workspace {
  persona: "guest" | "customer"; pet: Species | "none"; now: string; delayMs: number;
  selectedPetId: string | null; selectPet: (id: string | null) => void;
  faults: Record<Fault, boolean>; clearFault: (fault: Fault) => void;
  store: BookingMockWorkspace; state: WorkspaceSnapshot;
  repository: ReturnType<typeof createMockRepository>; actor: Actor; submitFault: SubmitFault;
}
const Context = createContext<Workspace | null>(null);
export function useCatalogWorkspace(): Workspace {
  const value = useContext(Context);
  if (!value) throw new Error("Catalog workspace missing");
  return value;
}
export default function CatalogWorkspace({ children }: { children: ReactNode }) {
  const { profile, petState, getPetState } = useCustomerWorkspace();
  const [store] = useState(() => new BookingMockWorkspace(createCatalogMock(), Date.parse(MOCK_NOW)));
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  useEffect(() => { store.activate(); return () => store.dispose(); }, [store]);
  const [persona, setPersona] = useState<Workspace["persona"]>("guest");
  const [selectedPetId, selectPet] = useState<string | null>(() => petState.pets.find(p => p.ownerId === profile.id && p.status === "ACTIVE")?.id ?? null);
  const [delayMs, setDelay] = useState(300);
  const [faults, setFaults] = useState<Record<Fault, boolean>>({ search: false, detail: false, availability: false, bookings: false, action: false, lookup: false });
  const [submitFault, setSubmitFault] = useState<SubmitFault>("none");
  const repository = useMemo(() => createMockRepository(state.catalog), [state.catalog]);
  const pet = petState.pets.find(p => p.id === selectedPetId && p.ownerId === profile.id && p.status === "ACTIVE");
  // Fixture taxonomy mapping only supports illustrative copy; never a booking rule.
  const species: Species | "none" = pet?.petTypeId === "1" ? "dog" : pet?.petTypeId === "2" ? "cat" : "none";
  const now = new Date(state.now).toISOString();
  const actor: Actor = { id: profile.id, role: profile.role };
  const path = usePathname();
  const providerId = path.startsWith("/providers/") ? path.split("/")[2] ?? "" : "";
  const activePets = petState.pets.filter(p => p.ownerId === profile.id && p.status === "ACTIVE");
  const value: Workspace = { persona, pet: species, now, delayMs, selectedPetId, selectPet, faults,
    clearFault: fault => setFaults(previous => ({ ...previous, [fault]: false })),
    store, state, repository, actor, submitFault };
  return <Context.Provider value={value}>{children}
    <aside className={styles.container + " " + styles.mockTools} aria-label={vi.discovery.mockTools.title}>
      <details><summary>{vi.discovery.mockTools.title}</summary>
        <p>{vi.discovery.mockTools.description}</p>
        <div className={styles.toolFields}>
          <label>{vi.discovery.mockTools.persona}<select value={persona} onChange={e => setPersona(e.target.value as Workspace["persona"])}><option value="guest">{vi.discovery.mockTools.guest}</option><option value="customer">{vi.discovery.mockTools.customer}</option></select></label>
          <label>{vi.discovery.mockTools.pet}<select value={pet?.id ?? ""} onChange={e => selectPet(e.target.value || null)}><option value="">{vi.discovery.mockTools.noPet}</option>{activePets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label>{vi.discovery.mockTools.delay}<select value={delayMs} onChange={e => setDelay(Number(e.target.value))}><option value={300}>300 ms</option><option value={1200}>1200 ms</option><option value={60}>60 ms</option></select></label>
          <label>{vi.booking.tools.fault}<select value={submitFault} onChange={e => setSubmitFault(e.target.value as SubmitFault)}>
            {([["none", vi.booking.tools.none], ["before-create", vi.booking.tools.before], ["timeout-before", vi.booking.tools.timeoutBefore], ["timeout-after", vi.booking.tools.timeoutAfter], ["slow-timeout", vi.booking.tools.slow]] as const).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select></label>
        </div>
        <p>{formatMessageParts(vi.discovery.mockTools.clock, { clock: <strong key="clock">{new Intl.DateTimeFormat("vi-VN", { timeZone: TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(state.now)}</strong> })}</p>
        <div className={styles.toolFields}>
          <button type="button" onClick={() => store.setNow(state.now + 3_600_000)}>{vi.discovery.mockTools.advance}</button>
          <button type="button" onClick={() => store.setNow(Date.parse(MOCK_NOW))}>{vi.discovery.mockTools.reset}</button>
          {([["search", vi.discovery.mockTools.searchFault], ["detail", vi.discovery.mockTools.detailFault], ["availability", vi.discovery.mockTools.availabilityFault], ["bookings", vi.booking.tools.listFault], ["action", vi.booking.tools.actionFault], ["lookup", vi.booking.tools.lookupFault]] as const).map(([key, label]) => <label key={key}><input type="checkbox" checked={faults[key]} onChange={e => setFaults(previous => ({ ...previous, [key]: e.target.checked }))} />{label}</label>)}
          <button type="button" onClick={() => store.seedHistory(actor, getPetState())}>{vi.booking.tools.history}</button>
          {providerId && <><button type="button" onClick={() => store.simulate(providerId, "full")}>{vi.booking.tools.full}</button><button type="button" onClick={() => store.simulate(providerId, "price")}>{vi.booking.tools.price}</button></>}
        </div><p>{vi.booking.tools.explanation}</p>
      </details>
    </aside>
  </Context.Provider>;
}
