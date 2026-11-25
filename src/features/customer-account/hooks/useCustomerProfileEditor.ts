"use client";

import { apiMessage } from "../../session/client";
import { vi } from "@/lib/locale";

import { useEffect, useRef, useState } from "react";
import { useCustomerWorkspace } from "@/features/customer-workspace/CustomerWorkspaceProvider";
import { prepareProfileUpdate, profileToDraft, validateProfileDraft } from "../profileLogic";
import type { CustomerProfileDraft, CustomerProfileErrors } from "../types";

type Editor = { draft: CustomerProfileDraft; errors: CustomerProfileErrors; saveError: string | null };

function waitForMockSave(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => {
      window.clearTimeout(timer);
      reject(new DOMException("Mock save cancelled", "AbortError"));
    };
    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, 650);
    signal.addEventListener("abort", abort, { once: true });
  });
}

export function useCustomerProfileEditor() {
  const { profile, updateProfile, live, loadStatus } = useCustomerWorkspace();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [failNextSave, setFailNextSave] = useState(false);
  const request = useRef<AbortController | null>(null);
  const busy = useRef(false);

  useEffect(() => () => { request.current?.abort(); }, []);

  function open() {
    if (busy.current || (live && loadStatus !== "ready")) return;
    setFeedback(null);
    setEditor({ draft: profileToDraft(profile), errors: {}, saveError: null });
  }

  function close() {
    if (!busy.current) setEditor(null);
  }

  function change(field: keyof CustomerProfileDraft, value: string) {
    if (busy.current) return;
    setEditor((current) => current && ({
      ...current,
      draft: { ...current.draft, [field]: value },
      errors: { ...current.errors, [field]: undefined },
      saveError: null,
    }));
  }

  async function save(): Promise<keyof CustomerProfileDraft | undefined> {
    if (!editor || busy.current) return;
    const errors = validateProfileDraft(editor.draft);
    const firstError = (["fullName", "phone"] as const).find((field) => errors[field]);
    if (firstError) {
      setEditor({ ...editor, errors, saveError: null });
      return firstError;
    }

    busy.current = true;
    const controller = new AbortController();
    request.current = controller;
    const shouldFail = failNextSave;
    setFailNextSave(false);
    setIsSaving(true);
    setEditor({ ...editor, errors: {}, saveError: null });
    try {
      if (!live) await waitForMockSave(controller.signal);
      if (controller.signal.aborted) return;
      if (shouldFail && !live) {
        setEditor({ ...editor, errors: {}, saveError: vi.customer.account.feedback.saveFailed });
        return;
      }
      await updateProfile(prepareProfileUpdate(editor.draft));
      if (controller.signal.aborted) return;
      setEditor(null);
      setFeedback(vi.customer.account.feedback.saved);
    } catch (error) {
      if (!controller.signal.aborted) {
        setEditor({ ...editor, errors: {}, saveError: apiMessage(error) });
      }
    } finally {
      if (request.current === controller) {
        request.current = null;
        busy.current = false;
        if (!controller.signal.aborted) setIsSaving(false);
      }
    }
  }

  return { live, loadStatus, profile, editor, isSaving, feedback, failNextSave, setFailNextSave, open, close, change, save };
}
