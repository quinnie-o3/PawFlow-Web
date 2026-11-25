"use client";

import { X } from "lucide-react";
import { vi } from "@/lib/locale";
import styles from "./feedback.module.css";

/** Persistent until dismissed/replaced; never steals focus or hides form errors. */
export default function Toast({ message, onDismiss }: { message: string | null; onDismiss: () => void }) {
  return <>
    <p className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">{message}</p>
    {message && <aside className={styles.toastRegion}>
      <p aria-hidden="true">{message}</p>
      <button type="button" onClick={onDismiss} aria-label={vi.sharedUi.dismiss}><X aria-hidden="true" size={18} /></button>
    </aside>}
  </>;
}
