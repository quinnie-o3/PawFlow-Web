import { vi } from "@/lib/locale";
import DesignAsset from "../../discovery-shell/components/DesignAsset";
import { Bone, Headset, HeartPulse } from "lucide-react";
import shell from "../../discovery-shell/shell.module.css";
import styles from "../detail.module.css";

export default function BookingExplanation() {
  return <section className={`${shell.container} ${styles.process}`} aria-labelledby="process-title"><h2 id="process-title">{vi.discovery.process.title}<DesignAsset src="/customer-discovery/e6e20.svg" /></h2><p>{vi.discovery.process.description}</p><div className={styles.processBody}><div className={styles.processPhoto}><DesignAsset src="/customer-provider-detail/33416.svg" className={styles.processCircle} /><DesignAsset src="/customer-provider-detail/363b1.png" /><DesignAsset src="/customer-provider-detail/fe546.svg" className={styles.processPaw} /><DesignAsset src="/customer-provider-detail/3b295.svg" className={styles.processPawUpper} /></div><ol>
    {([
      [vi.discovery.process.servicesTitle, vi.discovery.process.servicesDescription, HeartPulse],
      [vi.discovery.process.petsTitle, vi.discovery.process.petsDescription, Bone],
      [vi.discovery.process.confirmationTitle, vi.discovery.process.confirmationDescription, Headset],
    ] as const).map(([title, text, Icon]) => <li key={title}><Icon size={52} aria-hidden="true" /><div><h3>{title}</h3><p>{text}</p></div></li>)}
  </ol></div></section>;
}
