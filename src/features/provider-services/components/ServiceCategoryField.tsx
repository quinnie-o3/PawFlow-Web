import { useId, useState } from "react";
import type { ServiceFeedback } from "../types";
import ServicesFeedback from "./ServicesFeedback";
import styles from "../services.module.css";

export default function ServiceCategoryField({ categories, value, onChange, onCreate }: {
  categories: string[];
  value: string;
  onChange: (category: string) => void;
  onCreate: (name: string) => ServiceFeedback;
}) {
  const id = useId();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [feedback, setFeedback] = useState<ServiceFeedback | null>(null);
  function create() {
    const result = onCreate(name);
    setFeedback(result);
    if (result.outcome === "success") {
      onChange(name.trim());
      setName("");
      setAdding(false);
      window.requestAnimationFrame(() => document.getElementById(id)?.focus());
    }
  }
  return <div>
    <div className={styles.field}><label htmlFor={id}>Danh mục (bắt buộc)</label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)} required>
        <option value="">Chọn danh mục</option>
        {categories.map((category) => <option key={category} value={category}>{category}</option>)}
      </select>
    </div>
    {!adding ? <button className={styles.softButton} type="button" onClick={() => { setAdding(true); setFeedback(null); }}>Thêm danh mục</button> : <div className={styles.confirmation}>
      <label className={styles.field}>Tên danh mục mới<input autoFocus value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); create(); } }} /></label>
      <ServicesFeedback feedback={feedback} />
      <button className={styles.primaryButton} type="button" onClick={create}>{feedback?.outcome === "error" ? "Thử lại tạo danh mục" : "Tạo danh mục"}</button>
      <button className={styles.softButton} type="button" onClick={() => { setAdding(false); window.requestAnimationFrame(() => document.getElementById(id)?.focus()); }}>Bỏ qua</button>
    </div>}
  </div>;
}
