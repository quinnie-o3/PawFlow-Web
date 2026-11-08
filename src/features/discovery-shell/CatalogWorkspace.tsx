"use client";

import { vi, formatMessageParts } from "@/lib/locale";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { MOCK_NOW } from "../customer-catalog/data/catalogMock";
import type { Species } from "../customer-catalog/types";
import styles from "./shell.module.css";

type Fault = "search" | "detail" | "availability";
interface Workspace {
  persona: "guest" | "customer"; pet: Species | "none"; now: string; delayMs: number;
  faults: Record<Fault, boolean>; clearFault: (fault: Fault) => void;
}
const Context = createContext<Workspace | null>(null);
export function useCatalogWorkspace(): Workspace { const value = useContext(Context); if (!value) throw new Error("Catalog workspace missing"); return value; }
export default function CatalogWorkspace({ children }: { children: ReactNode }) {
  const [persona, setPersona] = useState<Workspace["persona"]>("guest");
  const [pet, setPet] = useState<Workspace["pet"]>("dog");
  const [now, setNow] = useState(MOCK_NOW);
  const [delayMs, setDelay] = useState(300);
  const [faults, setFaults] = useState<Record<Fault, boolean>>({ search: false, detail: false, availability: false });
  const value = useMemo<Workspace>(() => ({ persona, pet, now, delayMs, faults, clearFault: fault => setFaults(previous => ({ ...previous, [fault]: false })) }), [persona, pet, now, delayMs, faults]);
  return <Context.Provider value={value}>{children}
    <aside className={`${styles.container} ${styles.mockTools}`} aria-label={vi.discovery.mockTools.title}>
      <details><summary>{vi.discovery.mockTools.title}</summary>
        <p>{vi.discovery.mockTools.description}</p>
        <div className={styles.toolFields}>
          <label>{vi.discovery.mockTools.persona}<select value={persona} onChange={e => setPersona(e.target.value as Workspace["persona"])}><option value="guest">{vi.discovery.mockTools.guest}</option><option value="customer">{vi.discovery.mockTools.customer}</option></select></label>
          <label>{vi.discovery.mockTools.pet}<select value={pet} onChange={e => setPet(e.target.value as Workspace["pet"])}><option value="dog">Milo · Chó</option><option value="cat">Miu · Mèo</option><option value="none">{vi.discovery.mockTools.noPet}</option></select></label>
          <label>{vi.discovery.mockTools.delay}<select value={delayMs} onChange={e => setDelay(Number(e.target.value))}><option value={300}>300 ms</option><option value={1200}>1200 ms</option><option value={60}>60 ms</option></select></label>
        </div>
        <p>{formatMessageParts(vi.discovery.mockTools.clock, { clock: <strong key="clock">{new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(now))}</strong> })}</p>
        <div className={styles.toolFields}><button type="button" onClick={() => setNow(new Date(Date.parse(now) + 3600000).toISOString())}>{vi.discovery.mockTools.advance}</button><button type="button" onClick={() => setNow(MOCK_NOW)}>{vi.discovery.mockTools.reset}</button>
          {([ ["search", vi.discovery.mockTools.searchFault], ["detail", vi.discovery.mockTools.detailFault], ["availability", vi.discovery.mockTools.availabilityFault] ] as const).map(([key, label]) => <label key={key}><input type="checkbox" checked={faults[key]} onChange={e => setFaults(previous => ({ ...previous, [key]: e.target.checked }))} />{label}</label>)}
        </div>
      </details>
    </aside>
  </Context.Provider>;
}
