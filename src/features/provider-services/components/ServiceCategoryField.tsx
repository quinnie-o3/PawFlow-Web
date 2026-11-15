import { vi } from "@/lib/locale";
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
    <div className={styles.field}><label htmlFor={id}>{vi.provider.services.category.requiredLabel}</label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)} required>
        <option value="">{vi.provider.services.category.choose}</option>
        {categories.map((category) => <option key={category} value={category}>{category}</option>)}
      </select>
    </div>
    {!adding ? <button className={styles.softButton} type="button" onClick={() => { setAdding(true); setFeedback(null); }}>{vi.provider.services.category.add}</button> : <div className={styles.confirmation}>
      <label className={styles.field}>{vi.provider.services.category.newName}<input autoFocus value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); create(); } }} /></label>
      <ServicesFeedback feedback={feedback} />
      <button className={styles.primaryButton} type="button" onClick={create}>{feedback?.outcome === "error" ? vi.provider.services.category.retry : vi.provider.services.category.create}</button>
      <button className={styles.softButton} type="button" onClick={() => { setAdding(false); window.requestAnimationFrame(() => document.getElementById(id)?.focus()); }}>{vi.provider.services.category.skip}</button>
    </div>}
  </div>;
}
