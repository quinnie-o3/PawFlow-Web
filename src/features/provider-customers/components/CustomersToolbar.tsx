"use client";

import { useRef, useState } from "react";
import { Search } from "lucide-react";
import { vi } from "@/lib/locale";
import type { CustomerFilters } from "../types";
import styles from "../customers.module.css";

const GROUPS = [
  { value: "all", label: vi.common.actions.all },
  { value: "returning", label: vi.provider.customers.groups.returning },
  { value: "new", label: vi.provider.customers.groups.new },
] as const;

export default function CustomersToolbar({
  filters,
  onChange,
}: {
  filters: CustomerFilters;
  onChange: (filters: CustomerFilters) => void;
}) {
  const [isComposing, setIsComposing] = useState(false);
  const composingRef = useRef(false);
  const [draftQuery, setDraftQuery] = useState<{
    baseQuery: string;
    value: string;
  }>(() => ({ baseQuery: filters.query, value: filters.query }));

  const displayedQuery = isComposing
    ? draftQuery.value
    : draftQuery.baseQuery === filters.query
      ? draftQuery.value
      : filters.query;

  return (
    <div className={styles.toolbar}>
      <div
        className={styles.filters}
        role="group"
        aria-label={vi.provider.customers.filters.groupLabel}
      >
        {GROUPS.map((group) => (
          <button
            key={group.value}
            type="button"
            aria-pressed={filters.group === group.value}
            onClick={() => onChange({ ...filters, group: group.value })}
          >
            {group.label}
          </button>
        ))}
      </div>
      <label className={styles.search}>
        <span className={styles.srOnly}>
          {vi.provider.customers.filters.searchLabel}
        </span>
        <Search
          className={styles.searchIcon}
          aria-hidden="true"
          focusable="false"
          size={16}
        />
        <input
          type="search"
          placeholder={vi.provider.customers.filters.searchPlaceholder}
          value={displayedQuery}
          onCompositionStart={() => {
            composingRef.current = true;
            setIsComposing(true);
            setDraftQuery({ baseQuery: filters.query, value: displayedQuery });
          }}
          onCompositionEnd={(event) => {
            composingRef.current = false;
            const committed = event.currentTarget.value;
            setIsComposing(false);
            setDraftQuery({ baseQuery: committed, value: committed });
            onChange({ ...filters, query: committed });
          }}
          onChange={(event) => {
            const next = event.target.value;
            const nativeComposing = Boolean(
              (event.nativeEvent as { isComposing?: boolean }).isComposing,
            );
            if (composingRef.current || nativeComposing) {
              setDraftQuery((prev) => ({ ...prev, value: next }));
              return;
            }
            setDraftQuery({ baseQuery: next, value: next });
            onChange({ ...filters, query: next });
          }}
        />
      </label>
    </div>
  );
}
