import { vi } from "@/lib/locale";
import DesignAsset from "./DesignAsset";
import { Circle } from "lucide-react";
import styles from "../shell.module.css";

export default function DiscoveryIntro() {
  return <>
    <section className={`${styles.container} ${styles.intro}`} aria-labelledby="care-title"><DesignAsset src="/customer-discovery/8bac3.png" className={styles.introGlow} /><h2 id="care-title">{vi.discovery.intro.title}<DesignAsset src="/customer-discovery/e6e20.svg" /></h2><div className={styles.introPhotos}>
      <DesignAsset src="/customer-discovery/dd019.png" /><DesignAsset src="/customer-discovery/ccdfd.png" /><DesignAsset src="/customer-discovery/1f5a0.png" />
    </div></section>
    <section className={`${styles.container} ${styles.careIntro}`}><DesignAsset src="/customer-discovery/1e174.png" className={styles.careAnimals} /><div><h2>{vi.discovery.intro.careTitle}</h2><ul>{[vi.discovery.intro.services, vi.discovery.intro.prices, vi.discovery.intro.schedule, vi.discovery.intro.needs].map(text => <li key={text}><Circle size={24} aria-hidden="true" />{text}</li>)}</ul></div></section>
  </>;
}
