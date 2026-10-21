import { Circle } from "lucide-react";
import type { ProviderProfile } from "../types";
import styles from "../profile.module.css";

export default function ProfileApproval({ profile }: { profile: ProviderProfile }) {
  return <section className={styles.approval} aria-labelledby="profile-approval-title">
    <div>
      <h2 id="profile-approval-title">{profile.name} · Đã được duyệt</h2>
      <p>Thông tin cơ sở được hiển thị sau quy trình xét duyệt của quản trị viên.</p>
    </div>
    <span className={styles.badge}><Circle aria-hidden="true" focusable="false" size={7} fill="currentColor" />Đã duyệt</span>
  </section>;
}
