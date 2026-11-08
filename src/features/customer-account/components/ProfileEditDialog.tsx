import { vi } from "@/lib/locale";
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

  return <CustomerDialog title={vi.customer.account.editor.title} description={vi.customer.account.editor.description} busy={isSaving} onClose={model.close}>
    <form noValidate className={styles.form} onSubmit={submit} aria-busy={isSaving}>
      <fieldset disabled={isSaving} className={styles.fields}>
        <div className={styles.field}>
          <label htmlFor={id + "-name"}>{vi.customer.account.editor.requiredName}</label>
          <input ref={fullName} id={id + "-name"} name="fullName" autoComplete="name" required value={editor.draft.fullName}
            aria-invalid={!!editor.errors.fullName} aria-describedby={id + "-name-hint" + (editor.errors.fullName ? " " + id + "-name-error" : "")}
            onChange={(event) => model.change("fullName", event.target.value)} />
          <p id={id + "-name-hint"} className={styles.fieldHint}>{vi.customer.account.editor.nameHint}</p>
          {editor.errors.fullName && <p id={id + "-name-error"} className={styles.fieldError}>{editor.errors.fullName}</p>}
        </div>
        <div className={styles.field}>
          <label htmlFor={id + "-email"}>{vi.customer.account.page.email}</label>
          <input id={id + "-email"} type="email" readOnly value={profile.email} aria-describedby={id + "-email-hint"} />
          <p id={id + "-email-hint"} className={styles.fieldHint}>{vi.customer.account.editor.emailHint}</p>
        </div>
        <div className={styles.field}>
          <label htmlFor={id + "-phone"}>{vi.common.fields.phone}</label>
          <input ref={phone} id={id + "-phone"} name="phone" type="tel" autoComplete="tel" value={editor.draft.phone}
            aria-invalid={!!editor.errors.phone} aria-describedby={id + "-phone-hint" + (editor.errors.phone ? " " + id + "-phone-error" : "")}
            onChange={(event) => model.change("phone", event.target.value)} />
          <p id={id + "-phone-hint"} className={styles.fieldHint}>{vi.customer.account.editor.phoneHint}</p>
          {editor.errors.phone && <p id={id + "-phone-error"} className={styles.fieldError}>{editor.errors.phone}</p>}
        </div>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>{vi.customer.account.editor.address}</span>
          <div className={styles.address}>{vi.customer.account.editor.addressUnavailable}</div>
        </div>
      </fieldset>
      {editor.saveError && <p role="alert" className={styles.saveError}>{editor.saveError}</p>}
      <div className={styles.actions}>
        <button type="button" className={ui.secondaryButton} disabled={isSaving} onClick={model.close}>{vi.common.actions.cancel}</button>
        <button ref={saveButton} type="submit" className={ui.primaryButton} disabled={isSaving}>
          {isSaving && <LoaderCircle aria-hidden="true" size={16} className={styles.spinner} />}
          {isSaving ? vi.customer.account.editor.saving : editor.saveError ? vi.customer.account.editor.retry : vi.customer.account.editor.save}
        </button>
      </div>
    </form>
    <p role="status" className={styles.pending}>{isSaving ? vi.customer.account.editor.pending : ""}</p>
  </CustomerDialog>;
}
