import Image from "next/image";
import { ImageIcon } from "lucide-react";
import type { ProfileImage, ProfileImageSlot } from "../types";
import styles from "../profile.module.css";

export default function ProfileImagePreview({ image, slot, draft = false }: { image: ProfileImage | null; slot: ProfileImageSlot; draft?: boolean }) {
  const label = slot === "logo" ? "Logo" : "Ảnh bìa";
  return <div className={`${styles.imagePreview} ${slot === "logo" ? styles.logoPreview : styles.coverPreview}`}>
    {image ? <Image unoptimized src={image.url} alt={`${label} cơ sở${draft ? " · bản nháp" : " · bản mô phỏng"}`} fill sizes={slot === "logo" ? "180px" : "(max-width: 767px) 100vw, 640px"} className={styles.previewImage} />
      : <div className={styles.imagePlaceholder}><ImageIcon aria-hidden="true" size={32} strokeWidth={1.5} /><span>Chưa có {label.toLowerCase()}</span></div>}
  </div>;
}
