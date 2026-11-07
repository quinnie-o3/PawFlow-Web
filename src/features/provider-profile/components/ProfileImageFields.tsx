import { vi, formatMessage } from "@/lib/locale";
import { profileImageAccept } from "../profileImageValidation";
import type { ProfileEditor, ProfileImages, ProfileImageSlot } from "../types";
import ProfileImagePreview from "./ProfileImagePreview";
import styles from "../profile.module.css";

export default function ProfileImageFields({ editor, saved, onSelect, onDiscard }: {
  editor: ProfileEditor;
  saved: ProfileImages;
  onSelect: (slot: ProfileImageSlot, file: File) => void;
  onDiscard: (slot: ProfileImageSlot) => void;
}) {
  return <fieldset className={styles.imageFields}>
    <legend>{vi.provider.profile.images.legend}</legend>
    <p className={styles.help} id="profile-image-help">{vi.provider.profile.images.selectionHint}</p>
    {(["logo", "cover"] as const).map((slot) => {
      const image = editor.images[slot];
      const changed = image?.url !== saved[slot]?.url;
      const label = slot === "logo" ? vi.provider.profile.images.logoLower : vi.provider.profile.images.coverLower;
      return <div className={styles.imageTile} key={slot}>
        <label htmlFor={`profile-${slot}`}>{formatMessage(image ? vi.provider.profile.images.replace : vi.provider.profile.images.select, { imageLabel: label })}</label>
        <ProfileImagePreview slot={slot} image={image} draft={changed} />
        {image && <p className={styles.help}>{formatMessage(changed ? vi.provider.profile.images.selectedDescription : vi.provider.profile.images.savedDescription, { fileName: image.fileName, width: image.width, height: image.height })}</p>}
        <input className={styles.fileInput} id={`profile-${slot}`} name={slot} type="file" accept={profileImageAccept} disabled={editor.decoding[slot]}
          aria-invalid={!!editor.imageErrors[slot]} aria-describedby={`profile-image-help${editor.imageErrors[slot] ? ` profile-${slot}-error` : ""}`}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.currentTarget.value = "";
            if (file) onSelect(slot, file);
          }} />
        {editor.decoding[slot] && <p role="status" className={styles.help}>{formatMessage(vi.provider.profile.images.checking, { imageLabel: label })}</p>}
        {editor.imageErrors[slot] && <p id={`profile-${slot}-error`} className={styles.fieldError} role="alert">{editor.imageErrors[slot]}</p>}
        {(changed || editor.imageErrors[slot] || editor.decoding[slot]) && <button type="button" className={styles.softButton} onClick={() => onDiscard(slot)}>
          {formatMessage(saved[slot] ? vi.provider.profile.images.discardAndRestore : vi.provider.profile.images.discard, { imageLabel: label })}
        </button>}
      </div>;
    })}
  </fieldset>;
}
