"use client";

import Link from "next/link";
import DesignAsset from "./DesignAsset";
import { Brand } from "./DiscoveryHeader";
import styles from "../shell.module.css";

export default function DiscoveryFooter() {
  return <footer className={styles.footer}>
    <DesignAsset src="/customer-discovery/80645.svg" className={styles.footerWave} />
    <DesignAsset src="/customer-discovery/c4ca0.svg" className={styles.footerPawRight} /><DesignAsset src="/customer-discovery/6fd9f.svg" className={styles.footerPawLeft} />
    <div className={`${styles.container} ${styles.footerInner}`}>
      <div><p>PawFlow giúp bạn tìm cơ sở, xem dịch vụ và tìm hiểu lịch chăm sóc thú cưng.</p><Brand /></div>
      <div className={styles.footerPhoto} aria-hidden="true"><DesignAsset src="/customer-discovery/a7c98.png" className={styles.photoBack} /><DesignAsset src="/customer-discovery/713a2.png" className={styles.photoPaper} /><DesignAsset src="/customer-discovery/945f3.svg" className={styles.photoBorder} /><DesignAsset src="/customer-discovery/c6336.png" className={styles.photoDog} /></div>
      <nav aria-label="Dịch vụ"><h2>Dịch vụ</h2><Link href="/discover?categoryId=bath">Tắm & vệ sinh</Link><Link href="/discover?categoryId=groom">Cắt tỉa lông</Link><Link href="/discover?categoryId=boarding">Trông giữ</Link></nav>
      <nav aria-label="PawFlow"><h2>PawFlow</h2><Link href="/" prefetch={false}>Trang chủ</Link><Link href="/discover">Khám phá</Link><Link href="/login" prefetch={false}>Đăng nhập</Link></nav>
    </div>
  </footer>;
}
