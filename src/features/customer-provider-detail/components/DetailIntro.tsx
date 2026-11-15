import { vi } from "@/lib/locale";
import DesignAsset from "../../discovery-shell/components/DesignAsset";
import shell from "../../discovery-shell/shell.module.css";
import styles from "../detail.module.css";

export default function DetailIntro() {
  return <div className={`${shell.container} ${styles.serviceTiles}`}>
    {[
      [vi.discovery.detailIntro.bath, vi.discovery.detailIntro.bathDescription, "e0fcc.png"],
      [vi.discovery.detailIntro.groom, vi.discovery.detailIntro.groomDescription, "593f2.png"],
      [vi.discovery.detailIntro.boarding, vi.discovery.detailIntro.boardingDescription, "4b389.png"],
    ].map(([name, description, asset]) => <div key={name} className={styles.serviceTile}><div><h2>{name}</h2><p>{description}</p><a href="#services" className={shell.primaryButton}>{vi.discovery.detailIntro.more}</a></div><DesignAsset src={`/customer-provider-detail/${asset}`} /></div>)}
  </div>;
}
