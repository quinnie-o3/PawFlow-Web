"use client";

import { vi, formatMessage } from "@/lib/locale";

import { Info } from "lucide-react";
import { useCatalogWorkspace } from "../CatalogWorkspace";
import styles from "../shell.module.css";

export default function MockNotice() { const { now, persona } = useCatalogWorkspace(); return <p className={styles.mockNotice}><Info size={16} aria-hidden="true" /><span>{formatMessage(vi.discovery.notice.summary, { persona: persona === "guest" ? vi.discovery.mockTools.guest : vi.discovery.mockTools.customer, clock: new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(now)) })}</span></p>; }
