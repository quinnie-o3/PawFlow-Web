"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { vi } from "@/lib/locale";
import styles from "./ProviderWorkspace.module.css";

function getFocusableControls(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'button:not(:disabled), a[href], input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"]):not(:disabled)',
    ),
  ).filter((element) => element.offsetParent !== null || element === document.activeElement);
}

export default function ProviderWorkspaceDialog({
  title,
  subtitle,
  disableClose = false,
  restoreFocusFallbackId,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  disableClose?: boolean;
  restoreFocusFallbackId?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const fallbackIdRef = useRef(restoreFocusFallbackId);

  useEffect(() => {
    fallbackIdRef.current = restoreFocusFallbackId;
  }, [restoreFocusFallbackId]);

  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = document.activeElement;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
    return () => {
      if (dialog?.open) {
        dialog.close();
      }
      if (
        trigger instanceof HTMLElement &&
        trigger.isConnected &&
        trigger.offsetParent !== null
      ) {
        trigger.focus();
      } else if (fallbackIdRef.current) {
        const fallback = document.getElementById(fallbackIdRef.current);
        if (fallback && fallback.offsetParent !== null) {
          fallback.focus();
        }
      }
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-busy={disableClose || undefined}
      onCancel={(event) => {
        event.preventDefault();
        if (!disableClose) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = getFocusableControls(event.currentTarget);
        if (controls.length === 0) {
          event.preventDefault();
          return;
        }
        if (controls.length === 1) {
          event.preventDefault();
          controls[0].focus();
          return;
        }
        const first = controls[0];
        const last = controls[controls.length - 1];
        const active = document.activeElement;
        if (!(active instanceof HTMLElement) || !controls.includes(active)) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
          return;
        }
        if (event.shiftKey && active === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
      }}
      className={styles.dialog}
    >
      <div className={styles.dialogHeader}>
        <div className={styles.dialogHeading}>
          <h2 id={titleId} className={styles.dialogTitle}>
            {title}
          </h2>
          {subtitle && <p className={styles.dialogSubtitle}>{subtitle}</p>}
        </div>
        <button
          type="button"
          autoFocus
          disabled={disableClose}
          onClick={() => {
            if (!disableClose) onClose();
          }}
          aria-label={vi.common.actions.close}
          title={vi.common.actions.close}
          className={styles.dialogClose}
        >
          <X aria-hidden="true" focusable="false" size={20} strokeWidth={2} />
        </button>
      </div>
      <div className={styles.dialogBody}>{children}</div>
    </dialog>
  );
}
