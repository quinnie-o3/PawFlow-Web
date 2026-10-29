import { useId, useRef, type FormEvent } from "react";
import { LoaderCircle } from "lucide-react";
import CustomerDialog from "@/features/customer-shell/components/CustomerDialog";
import type { useCustomerProfileEditor } from "../hooks/useCustomerProfileEditor";
import styles from "../account.module.css";
import ui from "@/features/customer-shell/customerShell.module.css";

export default function ProfileEditDialog({ model }: { model: ReturnType<typeof useCustomerProfileEditor> }) {
  const id = useId();
  const fullName = useRef<HTMLInputElement>(null);
  const phone = useRef<HTMLInputElement>(null);
  const saveButton = useRef<HTMLButtonElement>(null);
  const { editor, isSaving, profile } = model;
  if (!editor) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const invalidField = await model.save();
    window.requestAnimationFrame(() => {
      if (invalidField) (invalidField === "fullName" ? fullName : phone).current?.focus();
      else saveButton.current?.focus();
    });
  }

  return <CustomerDialog title="Chỉnh sửa thông tin cá nhân" description="Cập nhật họ tên và số điện thoại cho tài khoản của bạn." busy={isSaving} onClose={model.close}>
    <form noValidate className={styles.form} onSubmit={submit} aria-busy={isSaving}>
      <fieldset disabled={isSaving} className={styles.fields}>
        <div className={styles.field}>
          <label htmlFor={id + "-name"}>Họ và tên (bắt buộc)</label>
          <input ref={fullName} id={id + "-name"} name="fullName" autoComplete="name" required value={editor.draft.fullName}
            aria-invalid={!!editor.errors.fullName} aria-describedby={id + "-name-hint" + (editor.errors.fullName ? " " + id + "-name-error" : "")}
            onChange={(event) => model.change("fullName", event.target.value)} />
          <p id={id + "-name-hint"} className={styles.fieldHint}>Từ 2 đến 150 ký tự, không tính khoảng trắng đầu và cuối.</p>
          {editor.errors.fullName && <p id={id + "-name-error"} className={styles.fieldError}>{editor.errors.fullName}</p>}
        </div>
        <div className={styles.field}>
          <label htmlFor={id + "-email"}>Email</label>
          <input id={id + "-email"} type="email" readOnly value={profile.email} aria-describedby={id + "-email-hint"} />
          <p id={id + "-email-hint"} className={styles.fieldHint}>Email đăng nhập chỉ đọc.</p>
        </div>
        <div className={styles.field}>
          <label htmlFor={id + "-phone"}>Số điện thoại</label>
          <input ref={phone} id={id + "-phone"} name="phone" type="tel" autoComplete="tel" value={editor.draft.phone}
            aria-invalid={!!editor.errors.phone} aria-describedby={id + "-phone-hint" + (editor.errors.phone ? " " + id + "-phone-error" : "")}
            onChange={(event) => model.change("phone", event.target.value)} />
          <p id={id + "-phone-hint"} className={styles.fieldHint}>Không bắt buộc, tối đa 20 ký tự. Để trống sẽ giữ số đang lưu.</p>
          {editor.errors.phone && <p id={id + "-phone-error"} className={styles.fieldError}>{editor.errors.phone}</p>}
        </div>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Địa chỉ</span>
          <div className={styles.address}>Chưa hỗ trợ cập nhật địa chỉ</div>
        </div>
      </fieldset>
      {editor.saveError && <p role="alert" className={styles.saveError}>{editor.saveError}</p>}
      <div className={styles.actions}>
        <button type="button" className={ui.secondaryButton} disabled={isSaving} onClick={model.close}>Hủy</button>
        <button ref={saveButton} type="submit" className={ui.primaryButton} disabled={isSaving}>
          {isSaving && <LoaderCircle aria-hidden="true" size={16} className={styles.spinner} />}
          {isSaving ? "Đang lưu…" : editor.saveError ? "Thử lưu lại" : "Lưu thay đổi"}
        </button>
      </div>
    </form>
    <p role="status" className={styles.pending}>{isSaving ? "Đang lưu bản mô phỏng, vui lòng chờ." : ""}</p>
  </CustomerDialog>;
}
