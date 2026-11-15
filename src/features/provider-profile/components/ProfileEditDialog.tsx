import { vi, formatMessage } from "@/lib/locale";
import DashboardDialog from "@/features/provider-dashboard/components/DashboardDialog";
import { canEditProfileImages, profileFields } from "../profileLogic";
import { profileFieldLimits } from "../profileValidation";
import type { ProfileEditor, ProfileImages, ProfileImageSlot, ProfileValues, ProviderProfile } from "../types";
import ProfileImageFields from "./ProfileImageFields";
import styles from "../profile.module.css";

const labels: Record<keyof ProfileValues, string> = {
  name: vi.provider.profile.fields.name,
  description: vi.provider.profile.fields.description,
  area: vi.provider.profile.fields.area,
  phone: vi.provider.profile.fields.phone,
  email: vi.provider.profile.fields.email,
};

export default function ProfileEditDialog({ profile, editor, savedImages, hasChanges, onChange, onSelectImage, onDiscardImage, onSave, onClose }: {
  profile: ProviderProfile;
  editor: ProfileEditor;
  savedImages: ProfileImages;
  hasChanges: boolean;
  onChange: (field: keyof ProfileValues, value: string) => void;
  onSelectImage: (slot: ProfileImageSlot, file: File) => void;
  onDiscardImage: (slot: ProfileImageSlot) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const { section, draft, errors } = editor;
  const decoding = editor.decoding.logo || editor.decoding.cover;
  return <DashboardDialog title={formatMessage(vi.provider.profile.dialog.title, { facilityName: profile.name })} onClose={onClose}>
    <form className={styles.form} noValidate onSubmit={(event) => { event.preventDefault(); onSave(); }}>
      <p className={styles.help}>{vi.provider.profile.dialog.mockHint}</p>
      <p className={styles.help}>{vi.provider.profile.dialog.readonlyHint}</p>
      {Object.values(errors).some(Boolean) && <p className={styles.fieldError} role="alert">{vi.provider.profile.dialog.validationSummary}</p>}
      {editor.saveError && <p className={styles.fieldError} role="alert">{editor.saveError}</p>}
      {profileFields(section).map((field) => <div className={styles.formField} key={field}>
        <label htmlFor={`profile-${field}`}>{formatMessage(field === "description" ? vi.provider.profile.dialog.optionalLabel : vi.provider.profile.dialog.requiredLabel, { label: labels[field] })}</label>
        {field === "description"
          ? <textarea id={`profile-${field}`} name={field} value={draft[field]} onChange={(event) => onChange(field, event.target.value)} aria-invalid={!!errors[field]} aria-describedby={`profile-${field}-hint${errors[field] ? ` profile-${field}-error` : ""}`} />
          : <input id={`profile-${field}`} name={field} required type={field === "phone" ? "tel" : field === "email" ? "email" : "text"} value={draft[field]} onChange={(event) => onChange(field, event.target.value)} aria-invalid={!!errors[field]} aria-describedby={`profile-${field}-hint${errors[field] ? ` profile-${field}-error` : ""}`} />}
        <p id={`profile-${field}-hint`} className={styles.help}>{field === "phone" ? vi.provider.profile.dialog.phoneHint
          : field === "name" ? vi.provider.profile.dialog.nameHint
          : formatMessage(field === "description" ? vi.provider.profile.dialog.characterCount : vi.provider.profile.dialog.requiredCharacterCount, { count: draft[field].trim().length, limit: profileFieldLimits[field] })}</p>
        {errors[field] && <p id={`profile-${field}-error`} className={styles.fieldError}>{errors[field]}</p>}
      </div>)}
      {(section === "all" || section === "contact") && <p className={styles.help}>{vi.provider.profile.dialog.contactHint}</p>}
      {canEditProfileImages(section) && <ProfileImageFields editor={editor} saved={savedImages} onSelect={onSelectImage} onDiscard={onDiscardImage} />}
      <div className={styles.formActions}>
        <button type="submit" className={styles.primaryButton} disabled={!hasChanges || decoding}>{decoding ? vi.provider.profile.images.checkingAll : vi.provider.profile.dialog.save}</button>
        <button type="button" className={styles.softButton} onClick={onClose}>{vi.provider.profile.dialog.cancel}</button>
      </div>
    </form>
  </DashboardDialog>;
}
