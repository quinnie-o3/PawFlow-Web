import { vi, formatMessage } from "@/lib/locale";
import { Circle } from "lucide-react";
import type { ProviderProfile } from "../types";
import styles from "../profile.module.css";

export default function ProfileApproval({ profile }: { profile: ProviderProfile }) {
  return <section className={styles.approval} aria-labelledby="profile-approval-title">
    <div>
      <h2 id="profile-approval-title">{formatMessage(vi.provider.profile.approval.title, { facilityName: profile.name })}</h2>
      <p>{vi.provider.profile.approval.description}</p>
    </div>
    <span className={styles.badge}><Circle aria-hidden="true" focusable="false" size={7} fill="currentColor" />{vi.provider.profile.approval.approved}</span>
  </section>;
}
