"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { areas, categories } from "../../customer-catalog/data/catalogMock";
import type { DiscoveryQuery, SortOrder } from "../../customer-catalog/types";
import styles from "../discovery.module.css";

export default function DiscoveryToolbar({ query, searchInput, onSearch, onApply, onOpenFilters, onReset }: { query: DiscoveryQuery; searchInput: string; onSearch: (value: string) => void; onApply: (patch: Partial<DiscoveryQuery>) => void; onOpenFilters: () => void; onReset: () => void }) {
  const summary = [categories.find(c => c.id === query.categoryId)?.name ?? "Tất cả dịch vụ", areas.find(a => a.id === query.area)?.name ?? "tất cả khu vực", query.maxPrice && `giá dưới ${Number(query.maxPrice).toLocaleString("vi-VN")} ₫`, query.minRating && `đánh giá từ ${query.minRating.replace(".", ",")}`, query.available && "còn chỗ"].filter(Boolean).join(" · ");
  return <>
    <div className={styles.categories} aria-label="Loại dịch vụ"><button type="button" aria-pressed={!query.categoryId} onClick={() => onApply({ categoryId: "" })}>Tất cả</button>{categories.map(category => <button type="button" key={category.id} aria-pressed={query.categoryId === category.id} onClick={() => onApply({ categoryId: category.id })}>{category.name}</button>)}</div>
    <div className={styles.searchRow}><label className={styles.search}><Search aria-hidden="true" size={20} /><span className={styles.srOnly}>Tìm cơ sở, dịch vụ, danh mục hoặc địa chỉ</span><input type="search" maxLength={120} placeholder="Tìm cơ sở, dịch vụ hoặc khu vực…" value={searchInput} onChange={e => onSearch(e.target.value)} /></label><button type="button" className={styles.filterButton} onClick={onOpenFilters}><SlidersHorizontal aria-hidden="true" size={18} />Bộ lọc</button></div>
    <div className={styles.summaryRow}><p>{summary}</p><button type="button" onClick={onReset}><X size={15} aria-hidden="true" />Đặt lại</button><label>Sắp xếp<select value={query.sort} onChange={e => onApply({ sort: e.target.value as SortOrder })}><option value="fixture">Mặc định</option><option value="rating-desc">Đánh giá cao nhất</option><option value="price-asc">Giá tăng dần</option><option value="price-desc">Giá giảm dần</option></select></label></div>
  </>;
}
