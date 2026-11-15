import Image from "next/image";
import { designAssets } from "../designAssets";

export default function DesignAsset({ src, alt = "", className, priority = false }: { src: string; alt?: string; className?: string; priority?: boolean }) {
  const dimensions = designAssets[src];
  if (!dimensions) throw new Error(`Missing local design asset metadata: ${src}`);
  return <Image src={src} alt={alt} aria-hidden={alt ? undefined : true} width={Math.ceil(dimensions.width)} height={Math.ceil(dimensions.height)} className={className} preload={priority || undefined} sizes="(max-width: 767px) 90vw, (max-width: 1100px) 50vw, 800px" />;
}
