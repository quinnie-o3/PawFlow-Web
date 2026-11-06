import type { ReactNode } from "react";
import RegisterSidePanel from "./RegisterSidePanel";
import styles from "./auth.module.css";

export default function AuthScreen({ children, label }: { children: ReactNode; label: string }) {
  return <main className={styles.frame}><section className={styles.grid} aria-label={label}><div className={styles.panel}>{children}</div><RegisterSidePanel /></section></main>;
}
