import type { PetImage } from "./types";

export const petImageMaxBytes = 5 * 1024 * 1024;
export const petImageAccept = "image/jpeg,image/png,image/webp";
const mimeTypes = new Set(petImageAccept.split(","));

export function petImageFileError(file: Pick<File, "type" | "size">, header: Uint8Array): string | null {
  if (!mimeTypes.has(file.type)) return "Chỉ nhận ảnh JPEG, PNG hoặc WebP.";
  if (!file.size) return "File ảnh trống. Vui lòng chọn ảnh khác.";
  if (file.size > petImageMaxBytes) return "Mỗi ảnh tối đa 5 MiB.";
  const png = header.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => header[index] === byte);
  const jpeg = header[0] === 255 && header[1] === 216 && header[2] === 255;
  const webp = header.length >= 12 && String.fromCharCode(...header.slice(0, 4)) === "RIFF" && String.fromCharCode(...header.slice(8, 12)) === "WEBP";
  if (!(file.type === "image/png" ? png : file.type === "image/jpeg" ? jpeg : webp)) return "Nội dung file không khớp định dạng ảnh đã chọn.";
  return null;
}

export async function decodePetImage(file: File, signal: AbortSignal): Promise<PetImage> {
  signal.throwIfAborted();
  if (!mimeTypes.has(file.type)) throw new Error("Chỉ nhận ảnh JPEG, PNG hoặc WebP.");
  if (!file.size) throw new Error("File ảnh trống. Vui lòng chọn ảnh khác.");
  if (file.size > petImageMaxBytes) throw new Error("Mỗi ảnh tối đa 5 MiB.");
  const error = petImageFileError(file, new Uint8Array(await file.slice(0, 12).arrayBuffer()));
  signal.throwIfAborted();
  if (error) throw new Error(error);
  const url = URL.createObjectURL(file);
  const image = new Image();
  let abort: (() => void) | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      abort = () => { image.removeAttribute("src"); reject(new DOMException("Image cancelled", "AbortError")); };
      signal.addEventListener("abort", abort, { once: true });
      image.src = url;
      image.decode().then(resolve, reject);
    });
    signal.throwIfAborted();
    if (!image.naturalWidth || !image.naturalHeight) throw new Error("Empty image dimensions");
    return { url, fileName: file.name, mimeType: file.type, size: file.size, width: image.naturalWidth, height: image.naturalHeight };
  } catch {
    URL.revokeObjectURL(url);
    signal.throwIfAborted();
    throw new Error("Không giải mã được ảnh. File có thể bị hỏng; vui lòng chọn ảnh khác.");
  } finally {
    if (abort) signal.removeEventListener("abort", abort);
  }
}
