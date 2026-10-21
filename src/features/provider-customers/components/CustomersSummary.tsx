import type { CustomersReport } from "../types";
import styles from "../customers.module.css";

export default function CustomersSummary({ report }: { report: CustomersReport }) {
  return <section className={styles.summaries} aria-label="Chỉ số khách hàng trong kỳ">
    <article><h2>Khách đã phục vụ trong kỳ</h2><p className={styles.summaryCount}>{report.servedCustomers}</p><p>Có lịch hoàn thành trong kỳ, mỗi khách tính một lần.</p></article>
    <article><h2>Khách quay lại</h2><p className={styles.summaryCount}>{report.returningCustomers}</p><p>Đã phục vụ trong kỳ và có lịch hoàn thành trước kỳ tại cơ sở.</p></article>
    <article><h2>Thú cưng đã phục vụ</h2><p className={styles.summaryCount}>{report.servedPets}</p><p>Có lịch hoàn thành trong kỳ, mỗi thú cưng tính một lần.</p></article>
  </section>;
}
