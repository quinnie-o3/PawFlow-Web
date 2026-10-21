import DashboardDialog from "@/features/provider-dashboard/components/DashboardDialog";
import { canEditProfileImages, profileFields } from "../profileLogic";
import { profileFieldLimits } from "../profileValidation";
import type { ProfileEditor, ProfileImages, ProfileImageSlot, ProfileValues, ProviderProfile } from "../types";
import ProfileImageFields from "./ProfileImageFields";
import styles from "../profile.module.css";

const labels: Record<keyof ProfileValues, string> = {
  name: "Tên cơ sở",
  description: "Mô tả",
  area: "Khu vực phục vụ",
  phone: "Số điện thoại",
  email: "Email",
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
  return <DashboardDialog title={`Chỉnh sửa hồ sơ ${profile.name}`} onClose={onClose}>
    <form className={styles.form} noValidate onSubmit={(event) => { event.preventDefault(); onSave(); }}>
      <p className={styles.help}>Chỉ lưu bản mô phỏng trong phiên xem trang, chưa gửi lên máy chủ. Tải lại hoặc rời trang sẽ khôi phục mẫu.</p>
      <p className={styles.help}>Loại hình, người phụ trách và trạng thái duyệt được giữ nguyên.</p>
      {Object.values(errors).some(Boolean) && <p className={styles.fieldError} role="alert">Vui lòng kiểm tra các trường được báo lỗi bên dưới.</p>}
      {editor.saveError && <p className={styles.fieldError} role="alert">{editor.saveError}</p>}
      {profileFields(section).map((field) => <div className={styles.formField} key={field}>
        <label htmlFor={`profile-${field}`}>{labels[field]}{field === "description" ? " · không bắt buộc" : " *"}</label>
        {field === "description"
          ? <textarea id={`profile-${field}`} name={field} value={draft[field]} onChange={(event) => onChange(field, event.target.value)} aria-invalid={!!errors[field]} aria-describedby={`profile-${field}-hint${errors[field] ? ` profile-${field}-error` : ""}`} />
          : <input id={`profile-${field}`} name={field} required type={field === "phone" ? "tel" : field === "email" ? "email" : "text"} value={draft[field]} onChange={(event) => onChange(field, event.target.value)} aria-invalid={!!errors[field]} aria-describedby={`profile-${field}-hint${errors[field] ? ` profile-${field}-error` : ""}`} />}
        <p id={`profile-${field}-hint`} className={styles.help}>{field === "phone" ? "0 hoặc +84 rồi 9 chữ số; có thể nhập khoảng trắng/dấu gạch. Chỉ kiểm tra định dạng, không xác minh sở hữu."
          : field === "name" ? "Bắt buộc · 2–100 ký tự sau trim."
          : `${draft[field].trim().length} / ${profileFieldLimits[field]} ký tự${field === "description" ? "" : " · bắt buộc"}`}</p>
        {errors[field] && <p id={`profile-${field}-error`} className={styles.fieldError}>{errors[field]}</p>}
      </div>)}
      {(section === "all" || section === "contact") && <p className={styles.help}>Điện thoại và email là liên hệ của cơ sở; thay đổi tại đây không đổi tài khoản đăng nhập hoặc luồng xác minh.</p>}
      {canEditProfileImages(section) && <ProfileImageFields editor={editor} saved={savedImages} onSelect={onSelectImage} onDiscard={onDiscardImage} />}
      <div className={styles.formActions}>
        <button type="submit" className={styles.primaryButton} disabled={!hasChanges || decoding}>{decoding ? "Đang kiểm tra ảnh…" : "Lưu thông tin"}</button>
        <button type="button" className={styles.softButton} onClick={onClose}>Hủy thay đổi</button>
      </div>
    </form>
  </DashboardDialog>;
}
