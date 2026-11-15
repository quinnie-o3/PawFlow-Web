import { vi } from "@/lib/locale";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import styles from "../services.module.css";

export default function ServicesGuidance() {
  return <div className={styles.guidance}>
    <article><h2>{vi.provider.services.guidance.visibilityTitle}</h2><p>{vi.provider.services.guidance.visibilityDescription}</p><Link href="/dashboard/profile" prefetch={false}>{vi.provider.services.links.profile} <ArrowRight aria-hidden="true" focusable="false" size={13} strokeWidth={2} className={styles.inlineIcon} /></Link></article>
    <article><h2>{vi.provider.services.guidance.availabilityTitle}</h2><p>{vi.provider.services.guidance.availabilityDescription}</p><Link href="/dashboard/availability" prefetch={false}>{vi.provider.services.links.availability} <ArrowRight aria-hidden="true" focusable="false" size={13} strokeWidth={2} className={styles.inlineIcon} /></Link></article>
  </div>;
}
