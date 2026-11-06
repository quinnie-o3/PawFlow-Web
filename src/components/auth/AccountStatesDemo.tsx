"use client";
import Link from "next/link";
import { useState } from "react";
import { vi } from "@/lib/locale";
import AuthMockNotice from "./AuthMockNotice";
import styles from "./auth.module.css";

export default function AccountStatesDemo() {
  const [state, setState] = useState<keyof typeof vi.auth.demo.states>("invalid");
  return <div className={styles.form}><h1 className={styles.title}>{vi.auth.demo.title}</h1><AuthMockNotice /><p className={styles.copy}>{vi.auth.demo.description}</p><label htmlFor="demo-state" className={styles.copy}>{vi.auth.demo.select}</label><select id="demo-state" className={styles.secondary} value={state} onChange={(event) => setState(event.target.value as typeof state)}>{Object.entries(vi.auth.demo.states).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><div role="status" className={styles.notice}>{vi.auth.demo.messages[state]}</div><Link className={styles.link} href="/register/verify-email?demo=1">{vi.auth.verification.preview}</Link><Link className={styles.link} href="/login">{vi.auth.mock.backToLogin}</Link></div>;
}
