"use client";

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
  const { profile, updateProfile } = useCustomerWorkspace();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [failNextSave, setFailNextSave] = useState(false);
  const request = useRef<AbortController | null>(null);
  const busy = useRef(false);

  useEffect(() => () => { request.current?.abort(); }, []);

  function open() {
    if (busy.current) return;
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
      await waitForMockSave(controller.signal);
      if (controller.signal.aborted) return;
      if (shouldFail) {
        setEditor({ ...editor, errors: {}, saveError: "Chưa lưu được thay đổi (lỗi mô phỏng). Bản nháp được giữ lại; vui lòng thử lại." });
        return;
      }
      updateProfile(prepareProfileUpdate(editor.draft));
      setEditor(null);
      setFeedback("Đã lưu thay đổi trong phiên dùng thử.");
    } catch {
      if (!controller.signal.aborted) {
        setEditor({ ...editor, errors: {}, saveError: "Chưa lưu được bản mô phỏng. Bản nháp được giữ lại; vui lòng thử lại." });
      }
    } finally {
      if (request.current === controller) {
        request.current = null;
        busy.current = false;
        if (!controller.signal.aborted) setIsSaving(false);
      }
    }
  }

  return { profile, editor, isSaving, feedback, failNextSave, setFailNextSave, open, close, change, save };
}
