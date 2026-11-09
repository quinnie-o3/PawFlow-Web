import { vi } from "@/lib/locale";
import Link from "next/link";
import { usePathname } from "next/navigation";
import CustomerAsset from "./CustomerAsset";
import styles from "../customerShell.module.css";

export default function CustomerNavigation() {
  const pets = usePathname() === "/account/pets";
  return <nav aria-label={vi.customer.shell.tabs.label} className={styles.tabs}>
    <Link href="/account" prefetch={false} aria-current={!pets ? "page" : undefined}>
      <CustomerAsset name={pets ? "accountInactive" : "accountActive"} /><span>{vi.customer.shell.tabs.account}</span>
    </Link>
    <Link href="/account/pets" prefetch={false} aria-current={pets ? "page" : undefined}>
      <CustomerAsset name={pets ? "petsActive" : "petsInactive"} /><span>{vi.customer.shell.tabs.pets}</span>
    </Link>
  </nav>;
}
