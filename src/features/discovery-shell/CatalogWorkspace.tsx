"use client";

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
    <aside className={`${styles.container} ${styles.mockTools}`} aria-label="Công cụ dữ liệu mô phỏng">
      <details><summary>Công cụ dữ liệu mô phỏng</summary>
        <p>Chỉ dùng dữ liệu mẫu trong bộ nhớ. Đổi vai trò ở đây không đăng nhập; tải lại hoặc rời khu vực sẽ khôi phục mẫu. Không lưu trên máy chủ.</p>
        <div className={styles.toolFields}>
          <label>Trạng thái xem<select value={persona} onChange={e => setPersona(e.target.value as Workspace["persona"])}><option value="guest">Khách vãng lai</option><option value="customer">Khách hàng mẫu</option></select></label>
          <label>Hồ sơ thú cưng mẫu<select value={pet} onChange={e => setPet(e.target.value as Workspace["pet"])}><option value="dog">Milo · Chó</option><option value="cat">Miu · Mèo</option><option value="none">Chưa có hồ sơ</option></select></label>
          <label>Độ trễ mô phỏng<select value={delayMs} onChange={e => setDelay(Number(e.target.value))}><option value={300}>300 ms</option><option value={1200}>1200 ms</option><option value={60}>60 ms</option></select></label>
        </div>
        <p>Đồng hồ mẫu cố định: <strong>{new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(now))}</strong> · giờ Việt Nam (UTC+7).</p>
        <div className={styles.toolFields}><button type="button" onClick={() => setNow(new Date(Date.parse(now) + 3600000).toISOString())}>Tăng 1 giờ mẫu</button><button type="button" onClick={() => setNow(MOCK_NOW)}>Khôi phục giờ mẫu</button>
          {([ ["search", "Lỗi danh sách"], ["detail", "Lỗi chi tiết"], ["availability", "Lỗi lịch"] ] as const).map(([key, label]) => <label key={key}><input type="checkbox" checked={faults[key]} onChange={e => setFaults(previous => ({ ...previous, [key]: e.target.checked }))} />{label}</label>)}
        </div>
      </details>
    </aside>
  </Context.Provider>;
}
