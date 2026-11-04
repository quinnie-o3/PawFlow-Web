import DesignAsset from "./DesignAsset";
import { Circle } from "lucide-react";
import styles from "../shell.module.css";

export default function DiscoveryIntro() {
  return <>
    <section className={`${styles.container} ${styles.intro}`} aria-labelledby="care-title"><DesignAsset src="/customer-discovery/8bac3.png" className={styles.introGlow} /><h2 id="care-title">Dịch vụ tốt cho từng người bạn nhỏ <DesignAsset src="/customer-discovery/e6e20.svg" /></h2><div className={styles.introPhotos}>
      <DesignAsset src="/customer-discovery/dd019.png" /><DesignAsset src="/customer-discovery/ccdfd.png" /><DesignAsset src="/customer-discovery/1f5a0.png" />
    </div></section>
    <section className={`${styles.container} ${styles.careIntro}`}><DesignAsset src="/customer-discovery/1e174.png" className={styles.careAnimals} /><div><h2>Chọn nơi chăm sóc phù hợp cho thú cưng</h2><ul>{["Khám phá các dịch vụ theo nhu cầu: tắm, cắt tỉa, chăm sóc sức khỏe và trông giữ.", "Xem giá và thời lượng của đúng dịch vụ bạn quan tâm.", "Tìm hiểu cơ sở và lịch được công bố trước khi đặt lịch.", "Trao đổi nhu cầu riêng của thú cưng với cơ sở."].map(text => <li key={text}><Circle size={24} aria-hidden="true" />{text}</li>)}</ul></div></section>
  </>;
}
