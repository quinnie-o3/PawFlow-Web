import { useCallback, useEffect, useRef, useState } from "react";
import { useCustomerWorkspace } from "@/features/customer-workspace/CustomerWorkspaceProvider";
import { activeOwnedPets, todayInVietnam } from "../petLogic";
import { petMockDelay } from "../mockDelay";
import { usePetEditor } from "./usePetEditor";
import type { CustomerPet } from "../types";

type Selection = { kind: "details" | "delete"; id: string; fromDetails?: boolean } | null;
const actor = { id: "customer-demo", role: "CUSTOMER" };
export function useCustomerPetsPage() {
  const { petState, mutatePet } = useCustomerWorkspace();
  const form = usePetEditor();
  const [selection, setSelection] = useState<Selection>(null);
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">("loading");
  const [hasLoaded, setHasLoaded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [failNextLoad, setFailNextLoad] = useState(false);
  const [failNextMutation, setFailNextMutation] = useState(false);
  const loadRequest = useRef<AbortController | null>(null);
  const deleteRequest = useRef<AbortController | null>(null);
  const deleteBusy = useRef(false);
  const focusAfterDialog = useRef<string | null>(null);
  const pets = activeOwnedPets(petState, actor);
  const selectedPet = selection ? pets.find((pet) => pet.id === selection.id) : undefined;

  useEffect(() => {
    if (form.editor || selection || form.saving || deleting || !focusAfterDialog.current) return;
    // Run after the dialog cleanup has restored its trigger, not before it.
    document.getElementById(focusAfterDialog.current)?.focus();
    focusAfterDialog.current = null;
  }, [form.editor, form.saving, selection, deleting, petState]);

  const load = useCallback(async (fail: boolean) => {
    loadRequest.current?.abort();
    const controller = new AbortController(); loadRequest.current = controller;
    setLoadStatus("loading");
    try {
      await petMockDelay(controller.signal, 400);
      if (controller.signal.aborted) return;
      if (fail) setLoadStatus("error");
      else { setHasLoaded(true); setLoadStatus("ready"); }
    } catch { /* cancelling a page/load request does not modify any records */ }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadRequest.current = controller;
    void petMockDelay(controller.signal, 400).then(() => {
      if (!controller.signal.aborted) { setHasLoaded(true); setLoadStatus("ready"); }
    }).catch(() => { /* initial load was cancelled by navigation */ });
    return () => { loadRequest.current?.abort(); deleteRequest.current?.abort(); };
  }, []);

  function showDetails(pet: CustomerPet) {
    setFeedback(null); setSelection({ kind: "details", id: pet.id });
  }
  function openCreate() { setFeedback(null); form.open(); }
  function openEdit(pet: CustomerPet, fromDetails = false) {
    setSelection(null); setFeedback(null); form.open(pet, fromDetails);
  }
  function closeEditor() {
    const value = form.editor;
    if (form.close() && value?.fromDetails) setSelection({ kind: "details", id: value.id });
  }
  async function saveEditor() {
    const creating = form.editor?.version === null;
    const result = await form.save(failNextMutation, () => setFailNextMutation(false));
    if (result.ok) {
      setFeedback(creating ? "Đã thêm hồ sơ thú cưng trong phiên dùng thử." : "Đã cập nhật hồ sơ thú cưng trong phiên dùng thử.");
      if (result.fromDetails) setSelection({ kind: "details", id: result.id });
      else focusAfterDialog.current = "pet-detail-" + result.id;
      return;
    }
    return result.firstError;
  }
  function openDelete(pet: CustomerPet, fromDetails = false) {
    setDeleteError(null); setFeedback(null); setSelection({ kind: "delete", id: pet.id, fromDetails });
  }
  function closeSelection() {
    if (deleteBusy.current) return;
    setDeleteError(null);
    if (selection?.kind === "delete" && selection.fromDetails) setSelection({ kind: "details", id: selection.id });
    else setSelection(null);
  }
  async function deactivate() {
    if (!selectedPet || deleteBusy.current || selection?.kind !== "delete") return;
    deleteBusy.current = true; setDeleting(true); setDeleteError(null);
    const controller = new AbortController(); deleteRequest.current = controller;
    const fail = failNextMutation; setFailNextMutation(false);
    const index = pets.findIndex((pet) => pet.id === selectedPet.id);
    const nextId = pets[index + 1]?.id ?? pets[index - 1]?.id;
    try {
      await petMockDelay(controller.signal);
      if (controller.signal.aborted) return;
      const result = mutatePet({ type: "deactivate", id: selectedPet.id, expectedVersion: selectedPet.version }, fail);
      if (!result.ok) { setDeleteError(result.message); return; }
      setSelection(null);
      setFeedback("Đã ngừng sử dụng hồ sơ " + selectedPet.name + " cho lịch mới. Bản ghi được giữ trong phiên mô phỏng.");
      focusAfterDialog.current = nextId ? "pet-detail-" + nextId : "add-customer-pet";
    } catch {
      if (!controller.signal.aborted) setDeleteError("Thao tác chưa thành công. Dữ liệu không đổi; vui lòng thử lại.");
    } finally {
      deleteBusy.current = false;
      if (!controller.signal.aborted) setDeleting(false);
    }
  }

  return { petState, pets, today: todayInVietnam(), form, selection, selectedPet, loadStatus, hasLoaded, deleting, deleteError, feedback,
    failNextLoad, setFailNextLoad, failNextMutation, setFailNextMutation,
    reload: () => { const fail = failNextLoad; setFailNextLoad(false); void load(fail); },
    retryLoad: () => { void load(false); }, showDetails, openCreate, openEdit, closeEditor, saveEditor, openDelete, closeSelection, deactivate };
}
