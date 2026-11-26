import { ImageIcon } from "lucide-react";
import { formatMessage, vi } from "@/lib/locale";
import styles from "../profile.module.css";

const IMAGE_SLOTS = [
  { key: "logo", previewClass: styles.logoPreview },
  { key: "cover", previewClass: styles.coverPreview },
] as const;

export default function ProfileImages() {
  const imagesLocale = vi.provider.profile.images;

  return (
    <section className={styles.card} aria-labelledby="profile-images-title">
      <div className={styles.sectionHeading}>
        <h2 id="profile-images-title">{imagesLocale.title}</h2>
        <span className={styles.readonlyBadge}>
          {imagesLocale.unavailableBadge}
        </span>
      </div>
      <div className={styles.imageGrid}>
        {IMAGE_SLOTS.map(({ key, previewClass }) => {
          const label = key === "logo" ? imagesLocale.logo : imagesLocale.cover;
          return (
            <div className={styles.imageTile} key={key}>
              <h3>{label}</h3>
              <div className={`${styles.imagePreview} ${previewClass}`}>
                <div className={styles.imagePlaceholder}>
                  <ImageIcon aria-hidden="true" size={30} strokeWidth={1.5} />
                  <span>
                    {formatMessage(imagesLocale.placeholder, {
                      imageLabel: label.toLowerCase(),
                    })}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p className={styles.help}>{imagesLocale.unavailableHint}</p>
    </section>
  );
}
