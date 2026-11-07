"use client";

import Image from "next/image";
import { useState } from "react";
import { ImageOff } from "lucide-react";
import { designAssets } from "../../discovery-shell/designAssets";

/** Fixture photos share one missing/broken-image boundary; decorative assets stay separate. */
export default function CatalogImage({ src, alt, className, missingClassName, missingLabel }: {
  src: string | null; alt: string; className: string; missingClassName: string; missingLabel: string;
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const dimensions = src ? designAssets[src] : undefined;
  if (!src || !dimensions || failedSource === src) return <div className={missingClassName}>
    <ImageOff aria-hidden="true" size={30} /><span>{src ? "Không tải được hình ảnh" : missingLabel}</span>
  </div>;
  return <Image src={src} alt={alt} width={Math.ceil(dimensions.width)} height={Math.ceil(dimensions.height)} className={className}
    sizes="(max-width: 600px) 90vw, (max-width: 1100px) 50vw, 600px" onError={() => setFailedSource(src)} />;
}
