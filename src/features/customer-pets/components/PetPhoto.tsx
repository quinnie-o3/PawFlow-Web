import Image from "next/image";
import { PawPrint } from "lucide-react";
import type { PetImage } from "../types";
import styles from "../pets.module.css";

export default function PetPhoto({ image, large = false }: { image: PetImage | null; large?: boolean }) {
  const size = large ? 120 : 60;
  return image
    ? <Image unoptimized src={image.url} alt="" aria-hidden="true" width={size} height={size} className={large ? styles.photoLarge : styles.photo} />
    : <span className={large ? styles.photoLarge : styles.photo} aria-hidden="true"><PawPrint size={large ? 40 : 28} /></span>;
}
