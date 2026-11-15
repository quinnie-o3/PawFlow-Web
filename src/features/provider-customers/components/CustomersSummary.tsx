import { vi } from "@/lib/locale";
import type { CustomersReport } from "../types";
import styles from "../customers.module.css";

export default function CustomersSummary({ report }: { report: CustomersReport }) {
  return <section className={styles.summaries} aria-label={vi.provider.customers.summary.region}>
    <article><h2>{vi.provider.customers.summary.servedCustomers}</h2><p className={styles.summaryCount}>{report.servedCustomers}</p><p>{vi.provider.customers.summary.servedCustomersNote}</p></article>
    <article><h2>{vi.provider.customers.summary.returningCustomers}</h2><p className={styles.summaryCount}>{report.returningCustomers}</p><p>{vi.provider.customers.summary.returningCustomersNote}</p></article>
    <article><h2>{vi.provider.customers.summary.servedPets}</h2><p className={styles.summaryCount}>{report.servedPets}</p><p>{vi.provider.customers.summary.servedPetsNote}</p></article>
  </section>;
}
