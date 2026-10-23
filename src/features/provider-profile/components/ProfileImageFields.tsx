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
    <legend>Logo & ảnh bìa · không bắt buộc</legend>
    <p className={styles.help} id="profile-image-help">JPEG, PNG hoặc WebP, tối đa 5 MB mỗi ảnh. Xem toàn bộ ảnh gốc, không cắt ảnh. Chọn ảnh mới chỉ tạo bản nháp; bấm Lưu thông tin để cập nhật bản mô phỏng.</p>
    {(["logo", "cover"] as const).map((slot) => {
      const image = editor.images[slot];
      const changed = image?.url !== saved[slot]?.url;
      const label = slot === "logo" ? "logo" : "ảnh bìa";
      return <div className={styles.imageTile} key={slot}>
        <label htmlFor={`profile-${slot}`}>{image ? "Thay" : "Chọn"} {label}</label>
        <ProfileImagePreview slot={slot} image={image} draft={changed} />
        {image && <p className={styles.help}>{image.fileName} · {image.width} × {image.height}px{changed ? " · ảnh vừa chọn" : " · bản đã lưu trong phiên mock"}</p>}
        <input className={styles.fileInput} id={`profile-${slot}`} name={slot} type="file" accept={profileImageAccept} disabled={editor.decoding[slot]}
          aria-invalid={!!editor.imageErrors[slot]} aria-describedby={`profile-image-help${editor.imageErrors[slot] ? ` profile-${slot}-error` : ""}`}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.currentTarget.value = "";
            if (file) onSelect(slot, file);
          }} />
        {editor.decoding[slot] && <p role="status" className={styles.help}>Đang kiểm tra {label}…</p>}
        {editor.imageErrors[slot] && <p id={`profile-${slot}-error`} className={styles.fieldError} role="alert">{editor.imageErrors[slot]}</p>}
        {(changed || editor.imageErrors[slot] || editor.decoding[slot]) && <button type="button" className={styles.softButton} onClick={() => onDiscard(slot)}>
          Bỏ {label} vừa chọn{saved[slot] ? " · quay lại ảnh đã lưu" : ""}
        </button>}
      </div>;
    })}
  </fieldset>;
}
