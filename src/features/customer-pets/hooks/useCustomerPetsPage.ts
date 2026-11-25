import { vi, formatMessage } from "@/lib/locale";
import { useEffect, useRef, useState } from "react";
import { useCustomerWorkspace } from "@/features/customer-workspace/CustomerWorkspaceProvider";
import { activeOwnedPets, todayInVietnam } from "../petLogic";
import { petMockDelay } from "../mockDelay";
import { usePetEditor } from "./usePetEditor";
import type { CustomerPet } from "../types";

import {apiMessage} from "../../session/client";
import {isRequestCancelled} from "../../../lib/api/errors";

type Selection = { kind: "details" | "delete"; id: string; fromDetails?: boolean } | null;

export function useCustomerPetsPage() {
  const workspace = useCustomerWorkspace();
  const { petState, mutatePet, profile, live } = workspace;
  const actor = { id: profile.id, role: profile.role };
  const form = usePetEditor();
  const [selection, setSelection] = useState<Selection>(null);
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">("loading");
  const [hasLoaded, setHasLoaded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [detailError,setDetailError]=useState<string|null>(null),[detailBusy,setDetailBusy]=useState(false);
  const detailRequest=useRef(0);
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

  const load = async (fail: boolean) => {
    loadRequest.current?.abort();
    const controller = new AbortController(); loadRequest.current = controller;
    setLoadStatus("loading");
    try {
      await petMockDelay(controller.signal, 400);
      if (controller.signal.aborted) return;
      if (fail) setLoadStatus("error");
      else { setHasLoaded(true); setLoadStatus("ready"); }
    } catch { /* cancelling a page/load request does not modify any records */ }
  };

  useEffect(() => {
    const detailGeneration=detailRequest;
    const controller = new AbortController();
    loadRequest.current = controller;
    void petMockDelay(controller.signal, 400).then(() => {
      if (!controller.signal.aborted) { setHasLoaded(true); setLoadStatus("ready"); }
    }).catch(() => { /* initial load was cancelled by navigation */ });
    return () => { detailGeneration.current++;loadRequest.current?.abort(); deleteRequest.current?.abort(); };
  }, []);

  async function showDetails(pet: CustomerPet) {
    setFeedback(null);setDetailError(null);setDetailBusy(true);const version=++detailRequest.current;
    try {await workspace.loadPet?.(pet.id);if(version===detailRequest.current)setSelection({kind:"details",id:pet.id});}
    catch(error){if(version===detailRequest.current&&!isRequestCancelled(error))setDetailError(apiMessage(error));}
    finally{if(version===detailRequest.current)setDetailBusy(false);}
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
      setFeedback(creating ? vi.customer.pets.feedback.created : vi.customer.pets.feedback.updated);
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
      if (!live) await petMockDelay(controller.signal);
      if (controller.signal.aborted) return;
      const result = await mutatePet({ type: "deactivate", id: selectedPet.id, expectedVersion: selectedPet.version }, fail);
      if (!result.ok) { setDeleteError(result.message); return; }
      setSelection(null);
      setFeedback(formatMessage(vi.customer.pets.feedback.deactivated, { selectedPetName: selectedPet.name }));
      focusAfterDialog.current = nextId ? "pet-detail-" + nextId : "add-customer-pet";
    } catch {
      if (!controller.signal.aborted) setDeleteError(vi.customer.pets.feedback.mutationError);
    } finally {
      deleteBusy.current = false;
      if (!controller.signal.aborted) setDeleting(false);
    }
  }

  return { petState, pets, today: todayInVietnam(), form, selection, selectedPet, live, detailError, detailBusy, loadStatus: live ? workspace.loadStatus! : loadStatus, hasLoaded: live ? workspace.loadStatus === "ready" : hasLoaded, deleting, deleteError, feedback,
    failNextLoad, setFailNextLoad, failNextMutation, setFailNextMutation,
    reload: () => { const fail = failNextLoad; setFailNextLoad(false); void load(fail); },
    retryLoad: () => { if (live) void workspace.reload?.(); else void load(false); }, showDetails, openCreate, openEdit, closeEditor, saveEditor, openDelete, closeSelection, deactivate };
}
