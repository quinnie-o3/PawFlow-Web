import type { ReactNode } from "react";
import { Be_Vietnam_Pro, Assistant } from "next/font/google";

const authFont = Be_Vietnam_Pro({
  variable: "--font-be-vietnam-pro",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "600", "700"],
  display: "swap",
});
const assistantFont = Assistant({ variable: "--font-assistant", subsets: ["latin", "latin-ext"], weight: ["400", "600", "700"], display: "swap" });

export default function AuthPageLayout({ children }: { children: ReactNode }) {
  return <div lang="vi" className={`${authFont.variable} ${assistantFont.variable} font-[family-name:var(--font-be-vietnam-pro)]`}>{children}</div>;
}
