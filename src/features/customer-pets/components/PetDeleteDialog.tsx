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
  return <CustomerDialog title={"Xóa hồ sơ " + pet.name + "?"} description="Xác nhận ngừng sử dụng hồ sơ thú cưng." busy={busy} onClose={onClose} closeLabel="Đóng xác nhận xóa">
    <p className={styles.deleteDescription}>{pet.name} sẽ không còn trong danh sách để chọn cho lịch hẹn mới. Bản ghi và các lịch đã tạo được giữ lại.</p>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <div className={styles.actions}>
      <button ref={keep} type="button" className={ui.secondaryButton} disabled={busy} onClick={onClose}>Giữ hồ sơ</button>
      <button ref={confirm} type="button" className={ui.primaryButton} disabled={busy} onClick={async () => {
        await onConfirm(); window.requestAnimationFrame(() => confirm.current?.focus());
      }}>{busy && <LoaderCircle aria-hidden="true" size={16} className={styles.spinner} />}{busy ? "Đang xóa…" : error ? "Thử xóa lại" : "Xóa hồ sơ"}</button>
    </div>
    <p role="status" className={styles.pending}>{busy ? "Đang ngừng sử dụng hồ sơ trong phiên mô phỏng." : ""}</p>
  </CustomerDialog>;
}
