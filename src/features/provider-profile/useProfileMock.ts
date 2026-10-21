"use client";

import { useEffect, useRef, useState } from "react";
import { createProviderProfileMock } from "./data/providerProfileMock";
import { applyProfileValues, canEditProfileImages, getProfileValues, profileFields } from "./profileLogic";
import { decodeProfileImage } from "./profileImageValidation";
import { normalizeProfileValues, validateProfileValues } from "./profileValidation";
import type { ProfileEditor, ProfileImages, ProfileImageSlot, ProfileSection, ProfileValues } from "./types";

const emptyImages = (): ProfileImages => ({ logo: null, cover: null });

export function useProfileMock() {
  const [profile, setProfile] = useState(createProviderProfileMock);
  const [images, setImages] = useState<ProfileImages>(emptyImages);
  const [editor, setEditor] = useState<ProfileEditor | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [failNextSave, setFailNextSave] = useState(false);
  const urls = useRef(new Set<string>());
  const mounted = useRef(true);
  const generation = useRef(0);
  const requests = useRef({ logo: 0, cover: 0 });
  const decoders = useRef<Record<ProfileImageSlot, AbortController | null>>({ logo: null, cover: null });

  useEffect(() => {
    mounted.current = true;
    const created = urls.current;
    const pending = decoders.current;
    return () => {
      mounted.current = false;
      pending.logo?.abort();
      pending.cover?.abort();
      created.forEach((url) => URL.revokeObjectURL(url));
      created.clear();
    };
  }, []);

  useEffect(() => {
    const live = new Set([images.logo?.url, images.cover?.url, editor?.images.logo?.url, editor?.images.cover?.url]);
    for (const url of urls.current) {
      if (!live.has(url)) {
        URL.revokeObjectURL(url);
        urls.current.delete(url);
      }
    }
  }, [images, editor]);

  function release(url: string) {
    if (urls.current.delete(url)) URL.revokeObjectURL(url);
  }
  function discardDraftImages() {
    if (!editor) return;
    for (const slot of ["logo", "cover"] as const) {
      const image = editor.images[slot];
      if (image && image.url !== images[slot]?.url) release(image.url);
    }
  }
  function open(section: ProfileSection) {
    generation.current++;
    decoders.current.logo?.abort();
    decoders.current.cover?.abort();
    setFeedback(null);
    setEditor({ section, draft: getProfileValues(profile), images: { ...images }, errors: {}, imageErrors: {}, decoding: { logo: false, cover: false }, saveError: null });
  }
  function close() {
    generation.current++;
    decoders.current.logo?.abort();
    decoders.current.cover?.abort();
    discardDraftImages();
    setEditor(null);
  }
  function change(field: keyof ProfileValues, value: string) {
    setEditor((current) => {
      if (!current || !profileFields(current.section).includes(field)) return current;
      const errors = { ...current.errors };
      delete errors[field];
      return { ...current, draft: { ...current.draft, [field]: value }, errors, saveError: null };
    });
  }

  async function selectImage(slot: ProfileImageSlot, file: File) {
    if (!editor || !canEditProfileImages(editor.section)) return;
    const currentGeneration = generation.current;
    const request = ++requests.current[slot];
    decoders.current[slot]?.abort();
    const decoder = new AbortController();
    decoders.current[slot] = decoder;
    setEditor((current) => current && ({ ...current, decoding: { ...current.decoding, [slot]: true }, imageErrors: { ...current.imageErrors, [slot]: undefined }, saveError: null }));
    try {
      const image = await decodeProfileImage(file, decoder.signal);
      if (!mounted.current || generation.current !== currentGeneration || requests.current[slot] !== request) {
        URL.revokeObjectURL(image.url);
        return;
      }
      urls.current.add(image.url);
      // The previous draft URL is owned here; the committed URL must remain live.
      const previous = editor.images[slot];
      if (previous && previous.url !== images[slot]?.url) release(previous.url);
      setEditor((current) => current && ({ ...current, images: { ...current.images, [slot]: image }, decoding: { ...current.decoding, [slot]: false } }));
    } catch (error) {
      if (!mounted.current || generation.current !== currentGeneration || requests.current[slot] !== request) return;
      setEditor((current) => current && ({ ...current, decoding: { ...current.decoding, [slot]: false }, imageErrors: { ...current.imageErrors, [slot]: error instanceof Error ? error.message : "Không đọc được ảnh. Vui lòng thử lại." } }));
    } finally {
      if (decoders.current[slot] === decoder) decoders.current[slot] = null;
    }
  }
  function discardImage(slot: ProfileImageSlot) {
    if (!editor) return;
    requests.current[slot]++;
    decoders.current[slot]?.abort();
    const draft = editor.images[slot];
    if (draft && draft.url !== images[slot]?.url) release(draft.url);
    setEditor((current) => current && ({ ...current, images: { ...current.images, [slot]: images[slot] }, decoding: { ...current.decoding, [slot]: false }, imageErrors: { ...current.imageErrors, [slot]: undefined }, saveError: null }));
  }

  const hasChanges = !!editor && (profileFields(editor.section).some((field) => normalizeProfileValues(editor.draft)[field] !== profile[field]) ||
    (canEditProfileImages(editor.section) && (["logo", "cover"] as const).some((slot) => editor.images[slot]?.url !== images[slot]?.url)));

  function save() {
    if (!editor || !hasChanges || editor.decoding.logo || editor.decoding.cover) return false;
    const values = normalizeProfileValues(editor.draft);
    const emailInput = document.createElement("input");
    emailInput.type = "email";
    emailInput.value = values.email;
    const errors = validateProfileValues(values, editor.section, emailInput.validity.valid);
    if (Object.values(errors).some(Boolean) || Object.values(editor.imageErrors).some(Boolean)) {
      setEditor({ ...editor, errors });
      const firstError = Object.keys(errors)[0] ?? (["logo", "cover"] as const).find((slot) => editor.imageErrors[slot]);
      window.requestAnimationFrame(() => document.getElementById(`profile-${firstError}`)?.focus());
      return false;
    }
    if (failNextSave) {
      setFailNextSave(false);
      setEditor({ ...editor, errors: {}, saveError: "Chưa lưu được bản mô phỏng (lỗi mô phỏng). Bản nháp được giữ nguyên; bạn có thể thử lại." });
      return false;
    }
    setProfile(applyProfileValues(profile, values, editor.section));
    if (canEditProfileImages(editor.section)) {
      for (const slot of ["logo", "cover"] as const) {
        const previous = images[slot];
        if (previous && previous.url !== editor.images[slot]?.url) release(previous.url);
      }
      setImages({ ...editor.images });
    }
    generation.current++;
    setEditor(null);
    setFeedback("Đã cập nhật bản mô phỏng trong phiên. Chưa lưu lên máy chủ; tải lại hoặc rời trang sẽ khôi phục mẫu.");
    return true;
  }
  return { profile, images, editor, feedback, hasChanges, failNextSave, setFailNextSave, open, close, change, selectImage, discardImage, save };
}
