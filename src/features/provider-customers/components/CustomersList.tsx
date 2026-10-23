import { formatCustomerDateTime } from "../customerLogic";
import type { CustomerRecord } from "../types";
import CustomerGroupBadge from "./CustomerGroupBadge";
import styles from "../customers.module.css";

export default function CustomersList({ records, total, onSelect, onClearFilters }: {
  records: CustomerRecord[];
  total: number;
  onSelect: (id: string) => void;
  onClearFilters: () => void;
}) {
  return <section className={styles.listCard} aria-labelledby="customers-list-title">
    <div><h2 id="customers-list-title">Danh sách khách hàng</h2><p>Thông tin được tổng hợp từ lịch hẹn của cơ sở.</p></div>
    <p className={styles.resultCount} role="status">Hiển thị {records.length} / {total} khách hàng tại cơ sở.</p>
    {records.length > 0 ? <div className={styles.tableRegion} role="region" aria-label="Bảng khách hàng, cuộn ngang để xem đầy đủ" tabIndex={0}>
      <table className={styles.table}>
        <caption className={styles.srOnly}>Khách có booking tại cơ sở. Lịch hoàn thành và lần phục vụ gần nhất tính trên toàn bộ lịch sử; nhóm khách tính theo kỳ đang chọn.</caption>
        <thead><tr>{["Khách hàng", "Thú cưng", "Lần phục vụ gần nhất", "Lịch hoàn thành", "Nhóm khách", "Chi tiết"].map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead>
        <tbody>{records.map((record) => <tr key={record.customer.id}>
          <th scope="row"><span className={styles.customerName}>{record.customer.name}</span><span className={styles.customerId}>{record.customer.id}</span></th>
          <td>{record.pets.slice(0, 2).map((pet) => <span className={styles.petPreview} key={pet.id}>{pet.name} · {pet.species}</span>)}
            {record.pets.length > 2 && <span className={styles.customerId}>+{record.pets.length - 2} thú cưng trong hồ sơ</span>}
          </td>
          <td>{record.lastServedAt ? formatCustomerDateTime(record.lastServedAt) : "Chưa có"}</td>
          <td>{record.completedCount || "Chưa có"}</td>
          <td><CustomerGroupBadge group={record.group} /></td>
          <td><button type="button" className={styles.textButton} aria-label={`Xem hồ sơ ${record.customer.name} (${record.customer.id})`} onClick={() => onSelect(record.customer.id)}>Xem hồ sơ</button></td>
        </tr>)}</tbody>
      </table>
    </div> : <div className={styles.empty}>
      <h3>{total === 0 ? "Chưa có khách hàng tại cơ sở" : "Không tìm thấy khách hàng phù hợp"}</h3>
      <p>{total === 0 ? "Khách hàng sẽ xuất hiện khi có booking tại cơ sở này." : "Thử tên khác hoặc bỏ bộ lọc nhóm khách theo kỳ đang chọn."}</p>
      {total > 0 && <button type="button" className={styles.softButton} onClick={onClearFilters}>Xóa tìm kiếm và bộ lọc</button>}
    </div>}
    <p className={styles.lifetimeNote}>Lịch hoàn thành và lần phục vụ gần nhất là chỉ số toàn bộ lịch sử tại cơ sở, không đổi theo kỳ. Lần phục vụ gần nhất không sau đồng hồ mô phỏng.</p>
    <p>Mở hồ sơ để xem thông tin liên hệ, thú cưng và lịch sử booking tại cơ sở này.</p>
  </section>;
}
