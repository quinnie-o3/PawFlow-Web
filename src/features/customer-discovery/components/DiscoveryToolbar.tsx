"use client";

import { vi, formatMessage } from "@/lib/locale";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { areas, categories } from "../../customer-catalog/data/catalogMock";
import type { DiscoveryQuery, SortOrder } from "../../customer-catalog/types";
import styles from "../discovery.module.css";

export default function DiscoveryToolbar({ query, searchInput, onSearch, onApply, onOpenFilters, onReset }: { query: DiscoveryQuery; searchInput: string; onSearch: (value: string) => void; onApply: (patch: Partial<DiscoveryQuery>) => void; onOpenFilters: () => void; onReset: () => void }) {
  const summary = [categories.find(c => c.id === query.categoryId)?.name ?? vi.discovery.toolbar.allServices, areas.find(a => a.id === query.area)?.name ?? vi.discovery.toolbar.allAreas, query.maxPrice && formatMessage(vi.discovery.toolbar.maxPrice, { value: Number(query.maxPrice).toLocaleString("vi-VN") }), query.minRating && formatMessage(vi.discovery.toolbar.minRating, { value: query.minRating.replace(".", ",") }), query.available && vi.discovery.toolbar.available].filter(Boolean).join(" · ");
  return <>
    <div className={styles.categories} aria-label={vi.discovery.toolbar.categories}><button type="button" aria-pressed={!query.categoryId} onClick={() => onApply({ categoryId: "" })}>{vi.common.actions.all}</button>{categories.map(category => <button type="button" key={category.id} aria-pressed={query.categoryId === category.id} onClick={() => onApply({ categoryId: category.id })}>{category.name}</button>)}</div>
    <div className={styles.searchRow}><label className={styles.search}><Search aria-hidden="true" size={20} /><span className={styles.srOnly}>{vi.discovery.toolbar.searchLabel}</span><input type="search" maxLength={120} placeholder={vi.discovery.toolbar.searchPlaceholder} value={searchInput} onChange={e => onSearch(e.target.value)} /></label><button type="button" className={styles.filterButton} onClick={onOpenFilters}><SlidersHorizontal aria-hidden="true" size={18} />{vi.discovery.toolbar.filters}</button></div>
    <div className={styles.summaryRow}><p>{summary}</p><button type="button" onClick={onReset}><X size={15} aria-hidden="true" />{vi.common.actions.reset}</button><label>{vi.discovery.toolbar.sort}<select value={query.sort} onChange={e => onApply({ sort: e.target.value as SortOrder })}><option value="fixture">{vi.discovery.toolbar.fixture}</option><option value="rating-desc">{vi.discovery.toolbar.rating}</option><option value="price-asc">{vi.discovery.toolbar.priceAscending}</option><option value="price-desc">{vi.discovery.toolbar.priceDescending}</option></select></label></div>
  </>;
}
