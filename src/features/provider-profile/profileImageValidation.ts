import type { ProfileImage } from "./types";

export const profileImageMaxBytes = 5 * 1024 * 1024;
export const profileImageAccept = "image/jpeg,image/png,image/webp";
const mimeTypes = new Set(profileImageAccept.split(","));

/** Checks metadata and file signature before asking the browser to decode. */
export function profileImageFileError(file: Pick<File, "type" | "size">, header: Uint8Array): string | null {
  if (!mimeTypes.has(file.type)) return "Chỉ nhận ảnh JPEG, PNG hoặc WebP.";
  if (file.size === 0) return "File ảnh trống. Vui lòng chọn ảnh khác.";
  if (file.size > profileImageMaxBytes) return "Mỗi ảnh tối đa 5 MB.";
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => header[index] === byte);
  const jpeg = header[0] === 255 && header[1] === 216 && header[2] === 255;
  const webp = header.length >= 12 && String.fromCharCode(...header.slice(0, 4)) === "RIFF" && String.fromCharCode(...header.slice(8, 12)) === "WEBP";
  if (!(file.type === "image/png" ? png : file.type === "image/jpeg" ? jpeg : webp)) return "Nội dung file không khớp định dạng ảnh đã chọn.";
  return null;
}

export async function decodeProfileImage(file: File, signal: AbortSignal): Promise<ProfileImage> {
  // Reject oversized files before reading bytes or creating a URL.
  if (!mimeTypes.has(file.type)) throw new Error("Chỉ nhận ảnh JPEG, PNG hoặc WebP.");
  if (file.size > profileImageMaxBytes) throw new Error("Mỗi ảnh tối đa 5 MB.");
  const error = profileImageFileError(file, new Uint8Array(await file.slice(0, 12).arrayBuffer()));
  if (error) throw new Error(error);
  signal.throwIfAborted();
  const url = URL.createObjectURL(file);
  const image = new Image();
  let onAbort: (() => void) | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      onAbort = () => {
        image.removeAttribute("src");
        reject(new DOMException("Image selection cancelled", "AbortError"));
      };
      signal.addEventListener("abort", onAbort, { once: true });
      image.src = url;
      image.decode().then(resolve, reject);
    });
    signal.throwIfAborted();
    if (!image.naturalWidth || !image.naturalHeight) throw new Error("empty dimensions");
    return { url, fileName: file.name, mimeType: file.type, size: file.size, width: image.naturalWidth, height: image.naturalHeight };
  } catch {
    URL.revokeObjectURL(url);
    signal.throwIfAborted();
    throw new Error("Không giải mã được ảnh. File có thể bị hỏng; vui lòng chọn ảnh khác.");
  } finally {
    if (onAbort) signal.removeEventListener("abort", onAbort);
  }
}
