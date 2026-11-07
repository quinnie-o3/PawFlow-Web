import { vi, formatMessage } from "@/lib/locale";
import { authMockConfig } from "@/features/auth/config";
import styles from "./auth.module.css";

export default function AuthMockNotice() { return <p className={styles.notice}>{vi.auth.mock.notice}</p>; }

export function MockTools({ pending, failNext, onChange }: { pending: boolean; failNext: boolean; onChange: (value: boolean) => void }) {
  return <details className={styles.tools}><summary>{vi.auth.mock.tools}</summary><label><input type="checkbox" disabled={pending} checked={failNext} onChange={(e) => onChange(e.target.checked)} />{vi.auth.mock.failNext}</label><p>{formatMessage(vi.auth.mock.configNote, { delay: authMockConfig.delayMs })}</p></details>;
}
