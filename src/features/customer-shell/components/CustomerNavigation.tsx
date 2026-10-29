import Link from "next/link";
import { usePathname } from "next/navigation";
import CustomerAsset from "./CustomerAsset";
import styles from "../customerShell.module.css";

export default function CustomerNavigation() {
  const pets = usePathname() === "/account/pets";
  return <nav aria-label="Tài khoản và thú cưng" className={styles.tabs}>
    <Link href="/account" prefetch={false} aria-current={!pets ? "page" : undefined}>
      <CustomerAsset name={pets ? "accountInactive" : "accountActive"} /><span>Thông tin tài khoản</span>
    </Link>
    <Link href="/account/pets" prefetch={false} aria-current={pets ? "page" : undefined}>
      <CustomerAsset name={pets ? "petsActive" : "petsInactive"} /><span>Thú cưng của tôi</span>
    </Link>
  </nav>;
}
