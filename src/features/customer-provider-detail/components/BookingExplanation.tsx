import DesignAsset from "../../discovery-shell/components/DesignAsset";
import { Bone, Headset, HeartPulse } from "lucide-react";
import shell from "../../discovery-shell/shell.module.css";
import styles from "../detail.module.css";

export default function BookingExplanation() {
  return <section className={`${shell.container} ${styles.process}`} aria-labelledby="process-title"><h2 id="process-title">Quy trình đặt lịch qua PawFlow <DesignAsset src="/customer-discovery/e6e20.svg" /></h2><p>Chọn dịch vụ và cơ sở, thêm hồ sơ thú cưng, sau đó kiểm tra thông tin trước khi gửi yêu cầu.</p><div className={styles.processBody}><div className={styles.processPhoto}><DesignAsset src="/customer-provider-detail/33416.svg" className={styles.processCircle} /><DesignAsset src="/customer-provider-detail/363b1.png" /><DesignAsset src="/customer-provider-detail/fe546.svg" className={styles.processPaw} /><DesignAsset src="/customer-provider-detail/3b295.svg" className={styles.processPawUpper} /></div><ol>
    {([
      ["Dịch vụ rõ ràng", "Xem mô tả, giá và thời lượng của từng dịch vụ. Cơ sở sẽ tư vấn cụ thể theo tình trạng thú cưng.", HeartPulse],
      ["Hồ sơ thú cưng", "Đăng nhập và khai báo thông tin cơ bản của thú cưng trước khi gửi yêu cầu để cơ sở chuẩn bị phù hợp.", Bone],
      ["Xác nhận lịch hẹn", "Khi chức năng đặt lịch được hỗ trợ, yêu cầu được gửi đến cơ sở và chỉ trở thành lịch hẹn sau khi được xác nhận.", Headset],
    ] as const).map(([title, text, Icon]) => <li key={title}><Icon size={52} aria-hidden="true" /><div><h3>{title}</h3><p>{text}</p></div></li>)}
  </ol></div></section>;
}
