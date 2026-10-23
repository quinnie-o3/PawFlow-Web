import { Pencil } from "lucide-react";
import type { ProfileSection, ProviderProfile } from "../types";
import styles from "../profile.module.css";

export default function ProfileInformation({ profile, onEdit }: {
  profile: ProviderProfile;
  onEdit: (section: ProfileSection) => void;
}) {
  return <>
    <section className={styles.card} aria-labelledby="profile-facility-title">
      <div className={styles.sectionHeading}>
        <h2 id="profile-facility-title">Thông tin cơ sở</h2>
        <button type="button" className={styles.outlineButton} onClick={() => onEdit("facility")} aria-label="Chỉnh sửa thông tin cơ sở"><Pencil aria-hidden="true" size={14} />Chỉnh sửa</button>
      </div>
      <dl className={styles.fields}>
        <div><dt>Tên cơ sở</dt><dd>{profile.name}</dd></div>
        <div><dt>Người phụ trách · chỉ đọc</dt><dd>{profile.ownerName}</dd></div>
        <div><dt>Loại hình · chỉ đọc</dt><dd>{profile.category}</dd></div>
        <div><dt>Mô tả</dt><dd className={styles.multiline}>{profile.description || "Chưa có mô tả"}</dd></div>
      </dl>
    </section>
    <section className={styles.card} aria-labelledby="profile-contact-title">
      <div className={styles.sectionHeading}>
        <h2 id="profile-contact-title">Liên hệ & địa điểm</h2>
        <button type="button" className={styles.outlineButton} onClick={() => onEdit("contact")} aria-label="Chỉnh sửa liên hệ và địa điểm"><Pencil aria-hidden="true" size={14} />Chỉnh sửa</button>
      </div>
      <dl className={styles.fields}>
        <div><dt>Khu vực phục vụ</dt><dd>{profile.area}</dd></div>
        <div><dt>Số điện thoại</dt><dd>{profile.phone}</dd></div>
        <div><dt>Email</dt><dd>{profile.email}</dd></div>
      </dl>
    </section>
  </>;
}
