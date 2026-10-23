import { Pencil } from "lucide-react";
import type { ProfileImages as Images } from "../types";
import ProfileImagePreview from "./ProfileImagePreview";
import styles from "../profile.module.css";

export default function ProfileImages({ images, onEdit }: { images: Images; onEdit: () => void }) {
  return <section className={styles.card} aria-labelledby="profile-images-title">
    <div className={styles.sectionHeading}>
      <h2 id="profile-images-title">Hình ảnh cơ sở</h2>
      <button type="button" className={styles.outlineButton} onClick={onEdit}><Pencil aria-hidden="true" size={14} />Chỉnh sửa ảnh</button>
    </div>
    <div className={styles.imageGrid}>{(["logo", "cover"] as const).map((slot) => <div className={styles.imageTile} key={slot}>
      <h3>{slot === "logo" ? "Logo" : "Ảnh bìa"}</h3>
      <ProfileImagePreview slot={slot} image={images[slot]} />
      {images[slot] && <p className={styles.help}>{images[slot].fileName} · {images[slot].width} × {images[slot].height}px · chỉ trong bộ nhớ</p>}
    </div>)}</div>
    <p className={styles.help}>Ảnh không bắt buộc. JPEG, PNG hoặc WebP, tối đa 5 MB mỗi ảnh. Ảnh chỉ lưu trong bộ nhớ của phiên mock, chưa upload lên máy chủ.</p>
  </section>;
}
