import DesignAsset from "../../discovery-shell/components/DesignAsset";
import shell from "../../discovery-shell/shell.module.css";
import styles from "../detail.module.css";

export default function DetailIntro() {
  return <div className={`${shell.container} ${styles.serviceTiles}`}>
    {[
      ["Tắm & vệ sinh", "Làm sạch dịu nhẹ, sấy khô và vệ sinh cơ bản.", "e0fcc.png"],
      ["Cắt tỉa lông", "Chăm sóc và tạo kiểu lông theo nhu cầu của từng bé.", "593f2.png"],
      ["Trông giữ", "Trao đổi với cơ sở để chọn ca trông giữ phù hợp.", "4b389.png"],
    ].map(([name, description, asset]) => <div key={name} className={styles.serviceTile}><div><h2>{name}</h2><p>{description}</p><a href="#services" className={shell.primaryButton}>Xem thêm</a></div><DesignAsset src={`/customer-provider-detail/${asset}`} /></div>)}
  </div>;
}
