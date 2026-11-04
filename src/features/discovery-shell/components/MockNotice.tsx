"use client";

import { Info } from "lucide-react";
import { useCatalogWorkspace } from "../CatalogWorkspace";
import styles from "../shell.module.css";

export default function MockNotice() { const { now, persona } = useCatalogWorkspace(); return <p className={styles.mockNotice}><Info size={16} aria-hidden="true" /><span>Dữ liệu mô phỏng · {persona === "guest" ? "Khách vãng lai" : "Khách hàng mẫu"} · Đồng hồ mẫu: {new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(now))} (UTC+7).</span></p>; }
