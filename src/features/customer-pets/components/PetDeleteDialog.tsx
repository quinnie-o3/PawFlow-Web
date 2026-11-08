import { vi, formatMessage } from "@/lib/locale";
import { useEffect, useRef } from "react";
import { LoaderCircle } from "lucide-react";
import CustomerDialog from "@/features/customer-shell/components/CustomerDialog";
import type { CustomerPet } from "../types";
import styles from "../pets.module.css";
import ui from "@/features/customer-shell/customerShell.module.css";

export default function PetDeleteDialog({ pet, busy, error, onClose, onConfirm }: {
  pet: CustomerPet; busy: boolean; error: string | null; onClose: () => void; onConfirm: () => Promise<void>;
}) {
  const confirm = useRef<HTMLButtonElement>(null);
  const keep = useRef<HTMLButtonElement>(null);
  useEffect(() => { keep.current?.focus(); }, []);
  return <CustomerDialog title={formatMessage(vi.customer.pets.deletion.title, { petName: pet.name })} description={vi.customer.pets.deletion.description} busy={busy} onClose={onClose} closeLabel={vi.customer.pets.deletion.close}>
    <p className={styles.deleteDescription}>{formatMessage(vi.customer.pets.deletion.impact, { petName: pet.name })}</p>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <div className={styles.actions}>
      <button ref={keep} type="button" className={ui.secondaryButton} disabled={busy} onClick={onClose}>{vi.customer.pets.deletion.keep}</button>
      <button ref={confirm} type="button" className={ui.primaryButton} disabled={busy} onClick={async () => {
        await onConfirm(); window.requestAnimationFrame(() => confirm.current?.focus());
      }}>{busy && <LoaderCircle aria-hidden="true" size={16} className={styles.spinner} />}{busy ? vi.customer.pets.deletion.pending : error ? vi.customer.pets.deletion.retry : vi.customer.pets.deletion.confirm}</button>
    </div>
    <p role="status" className={styles.pending}>{busy ? vi.customer.pets.deletion.busy : ""}</p>
  </CustomerDialog>;
}
