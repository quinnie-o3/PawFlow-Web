"use client";

import { useEffect, useId, useRef } from "react";
import { Search } from "lucide-react";
import { formatMessage, vi } from "@/lib/locale";
import type {
  ServiceCategoryFilterOption,
  ServiceStatusFilter,
} from "../types";
import styles from "../services.module.css";

const SEARCH_DEBOUNCE_MS = 220;

export default function ServicesToolbar({
  status,
  categoryId,
  rawQuery,
  categoryOptions,
  onChangeStatus,
  onChangeCategory,
  onChangeRawQuery,
  onCommitQuery,
}: {
  status: ServiceStatusFilter;
  categoryId: string;
  rawQuery: string;
  categoryOptions: readonly ServiceCategoryFilterOption[];
  onChangeStatus: (next: ServiceStatusFilter) => void;
  onChangeCategory: (next: string) => void;
  onChangeRawQuery: (next: string) => void;
  onCommitQuery: (next: string) => void;
}) {
  const searchId = useId();
  const categoryIdField = useId();
  const composingRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  function scheduleCommit(value: string) {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      onCommitQuery(value);
    }, SEARCH_DEBOUNCE_MS);
  }

  const toolbarLocale = vi.provider.services.toolbar;
  const statusOptions = [
    ["ALL", vi.common.actions.all],
    ["ACTIVE", vi.provider.services.status.active],
    ["INACTIVE", vi.provider.services.status.inactive],
  ] as const;

  return (
    <div className={styles.toolbar}>
      <div
        className={styles.filters}
        role="group"
        aria-label={toolbarLocale.filterLabel}
      >
        {statusOptions.map(([value, label]) => (
          <button
            type="button"
            key={value}
            aria-pressed={status === value}
            onClick={() => onChangeStatus(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={styles.toolbarControls}>
        <label className={styles.categoryFilter} htmlFor={categoryIdField}>
          <span className={styles.srOnly}>{toolbarLocale.categoryLabel}</span>
          <select
            id={categoryIdField}
            value={categoryId}
            onChange={(event) => onChangeCategory(event.target.value)}
          >
            <option value="">{toolbarLocale.allCategories}</option>
            {categoryOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.inactive
                  ? formatMessage(toolbarLocale.inactiveCategoryOption, {
                      name: option.name,
                    })
                  : option.name}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.search} htmlFor={searchId}>
          <span className={styles.srOnly}>{toolbarLocale.searchLabel}</span>
          <Search
            aria-hidden="true"
            focusable="false"
            size={12}
            strokeWidth={2}
            className={styles.searchIcon}
          />
          <input
            id={searchId}
            type="search"
            placeholder={toolbarLocale.search}
            value={rawQuery}
            onCompositionStart={() => {
              composingRef.current = true;
              if (timerRef.current !== null) {
                window.clearTimeout(timerRef.current);
                timerRef.current = null;
              }
            }}
            onCompositionEnd={(event) => {
              composingRef.current = false;
              const finalValue = event.currentTarget.value;
              if (timerRef.current !== null) {
                window.clearTimeout(timerRef.current);
                timerRef.current = null;
              }
              onChangeRawQuery(finalValue);
              onCommitQuery(finalValue);
            }}
            onChange={(event) => {
              const nextValue = event.target.value;
              onChangeRawQuery(nextValue);
              if (!composingRef.current) {
                scheduleCommit(nextValue);
              }
            }}
          />
        </label>
      </div>
    </div>
  );
}
