import { vi } from "@/lib/locale";
import { useId, useRef, type FormEvent } from "react";
import { LoaderCircle } from "lucide-react";
import CustomerDialog from "@/features/customer-shell/components/CustomerDialog";
import type { useCustomerPetsPage } from "../hooks/useCustomerPetsPage";
import { petImageAccept } from "../petImageValidation";
import { petAge } from "../petLogic";
import PetPhoto from "./PetPhoto";
import styles from "../pets.module.css";
import ui from "@/features/customer-shell/customerShell.module.css";

export default function PetFormDialog({ model }: { model: ReturnType<typeof useCustomerPetsPage> }) {
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const saveButton = useRef<HTMLButtonElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const { editor, saving } = model.form;
  if (!editor) return null;
  const creating = editor.version === null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const field = await model.saveEditor();
    window.requestAnimationFrame(() => {
      if (field) formRef.current?.querySelector<HTMLElement>('[name="' + field + '"]')?.focus();
      else saveButton.current?.focus();
    });
  }

  return <CustomerDialog title={creating ? vi.customer.pets.editor.createTitle : vi.customer.pets.editor.editTitle}
    description={creating ? vi.customer.pets.editor.createDescription : vi.customer.pets.editor.editDescription} busy={saving} onClose={model.closeEditor}>
    <form ref={formRef} className={styles.form} noValidate onSubmit={submit} aria-busy={saving}>
      <fieldset className={styles.fields} disabled={saving}>
        <div className={styles.field}>
          <label htmlFor={id + "-name"}>{vi.customer.pets.editor.requiredName}</label>
          <input id={id + "-name"} name="name" required value={editor.draft.name} onChange={(event) => model.form.change("name", event.target.value)}
            aria-invalid={!!editor.errors.name} aria-describedby={id + "-name-hint" + (editor.errors.name ? " " + id + "-name-error" : "")} />
          <p id={id + "-name-hint"} className={styles.hint}>{vi.customer.pets.editor.nameHint}</p>
          {editor.errors.name && <p id={id + "-name-error"} className={styles.fieldError}>{editor.errors.name}</p>}
        </div>
        <div className={styles.field}>
          <label htmlFor={id + "-type"}>{vi.customer.pets.editor.requiredType}</label>
          <select id={id + "-type"} name="petTypeId" required value={editor.draft.petTypeId} onChange={(event) => model.form.change("petTypeId", event.target.value)}
            aria-invalid={!!editor.errors.petTypeId} aria-describedby={editor.errors.petTypeId ? id + "-type-error" : undefined}>
            <option value="">{vi.customer.pets.editor.selectType}</option>
            {model.petState.petTypes.filter((item) => item.status === "ACTIVE" || item.id === editor.draft.petTypeId).map((item) =>
              <option key={item.id} value={item.id} disabled={item.status !== "ACTIVE"}>{item.name}{item.status !== "ACTIVE" ? vi.customer.pets.editor.inactiveType : ""}</option>)}
          </select>
          {editor.errors.petTypeId && <p id={id + "-type-error"} className={styles.fieldError}>{editor.errors.petTypeId}</p>}
        </div>
        <div className={styles.field}>
          <label htmlFor={id + "-breed"}>{vi.customer.pets.editor.breed}</label>
          <input id={id + "-breed"} name="breed" value={editor.draft.breed} onChange={(event) => model.form.change("breed", event.target.value)}
            aria-invalid={!!editor.errors.breed} aria-describedby={id + "-breed-hint" + (editor.errors.breed ? " " + id + "-breed-error" : "")} />
          <p id={id + "-breed-hint"} className={styles.hint}>{vi.customer.pets.editor.breedHint}</p>
          {editor.errors.breed && <p id={id + "-breed-error"} className={styles.fieldError}>{editor.errors.breed}</p>}
        </div>
        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label htmlFor={id + "-birth"}>{vi.customer.pets.editor.birthDate}</label>
            <input type="date" id={id + "-birth"} name="birthDate" max={model.today} value={editor.draft.birthDate}
              onChange={(event) => model.form.change("birthDate", event.target.value)} aria-invalid={!!editor.errors.birthDate}
              aria-describedby={id + "-birth-hint" + (editor.errors.birthDate ? " " + id + "-birth-error" : "")} />
            <p id={id + "-birth-hint"} className={styles.hint}>{editor.draft.birthDate ? petAge(editor.draft.birthDate, model.today) : vi.customer.pets.editor.birthHint}</p>
            {editor.errors.birthDate && <p id={id + "-birth-error"} className={styles.fieldError}>{editor.errors.birthDate}</p>}
          </div>
          <div className={styles.field}>
            <label htmlFor={id + "-weight"}>{vi.customer.pets.editor.weight}</label>
            <input id={id + "-weight"} name="weight" inputMode="decimal" value={editor.draft.weight}
              onChange={(event) => model.form.change("weight", event.target.value)} aria-invalid={!!editor.errors.weight}
              aria-describedby={id + "-weight-hint" + (editor.errors.weight ? " " + id + "-weight-error" : "")} />
            <p id={id + "-weight-hint"} className={styles.hint}>{vi.customer.pets.editor.weightHint}</p>
            {editor.errors.weight && <p id={id + "-weight-error"} className={styles.fieldError}>{editor.errors.weight}</p>}
          </div>
        </div>
        <div className={styles.field}>
          <label htmlFor={id + "-note"}>{vi.customer.pets.editor.healthNote}</label>
          <textarea id={id + "-note"} name="healthNote" rows={3} value={editor.draft.healthNote} onChange={(event) => model.form.change("healthNote", event.target.value)} />
        </div>
        <div className={styles.imageField}>
          <label htmlFor={id + "-image"}>{vi.customer.pets.editor.photo}</label>
          <div className={styles.imagePreview}><PetPhoto image={editor.image} large /><span>{editor.image?.fileName ?? vi.customer.pets.editor.noPhoto}</span></div>
          <input ref={fileInput} id={id + "-image"} name="image" type="file" accept={petImageAccept} aria-invalid={!!editor.imageError}
            aria-describedby={id + "-image-hint" + (editor.imageError ? " " + id + "-image-error" : "")}
            onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void model.form.selectImage(file); }} />
          <p id={id + "-image-hint"} className={styles.hint}>{vi.customer.pets.editor.photoHint}</p>
          {editor.decoding && <p role="status" className={styles.hint}>{vi.customer.pets.editor.decoding}</p>}
          {editor.imageError && <p role="alert" id={id + "-image-error"} className={styles.fieldError}>{editor.imageError}</p>}
          {(editor.image !== editor.originalImage || editor.imageError || editor.decoding) && <button type="button" className={ui.secondaryButton} onClick={model.form.discardImageSelection}>{vi.customer.pets.editor.discardPhoto}</button>}
        </div>
      </fieldset>
      {editor.saveError && <p role="alert" className={styles.error}>{editor.saveError}</p>}
      <div className={styles.actions}>
        <button type="button" className={ui.secondaryButton} disabled={saving} onClick={model.closeEditor}>{vi.common.actions.cancel}</button>
        <button ref={saveButton} type="submit" className={ui.primaryButton} disabled={saving || editor.decoding}>
          {saving && <LoaderCircle aria-hidden="true" size={16} className={styles.spinner} />}
          {saving ? vi.customer.pets.editor.saving : editor.saveError ? vi.customer.pets.editor.retry : creating ? vi.customer.pets.editor.create : vi.customer.pets.editor.save}
        </button>
      </div>
    </form>
    <p role="status" className={styles.pending}>{saving ? vi.customer.pets.editor.pending : ""}</p>
  </CustomerDialog>;
}
