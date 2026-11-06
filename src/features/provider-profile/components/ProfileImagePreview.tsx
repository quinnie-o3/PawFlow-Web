import { vi, formatMessage } from "@/lib/locale";
import Image from "next/image";
import { ImageIcon } from "lucide-react";
import type { ProfileImage, ProfileImageSlot } from "../types";
import styles from "../profile.module.css";

export default function ProfileImagePreview({ image, slot, draft = false }: { image: ProfileImage | null; slot: ProfileImageSlot; draft?: boolean }) {
  const label = slot === "logo" ? vi.provider.profile.images.logo : vi.provider.profile.images.cover;
  return <div className={`${styles.imagePreview} ${slot === "logo" ? styles.logoPreview : styles.coverPreview}`}>
    {image ? <Image unoptimized src={image.url} alt={formatMessage(draft ? vi.provider.profile.images.draftAlt : vi.provider.profile.images.savedAlt, { imageLabel: label })} fill sizes={slot === "logo" ? "180px" : "(max-width: 767px) 100vw, 640px"} className={styles.previewImage} />
      : <div className={styles.imagePlaceholder}><ImageIcon aria-hidden="true" size={32} strokeWidth={1.5} /><span>{formatMessage(vi.provider.profile.images.missing, { imageLabel: label.toLowerCase() })}</span></div>}
  </div>;
}
