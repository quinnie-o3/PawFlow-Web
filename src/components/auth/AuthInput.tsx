import type { InputHTMLAttributes } from "react";

type AuthInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export default function AuthInput({ label, id, ...inputProps }: AuthInputProps) {
  return (
    <div className="flex w-full flex-col gap-[5px]">
      <div className="relative">
        <label htmlFor={id} className="absolute left-[15px] top-0 z-10 -translate-y-1/2 bg-[var(--surface-primary)] px-[5px] text-[12px] leading-none text-[var(--text-disabled)]">
          {label}
        </label>
        <input id={id} {...inputProps} className="h-[54px] w-full rounded-[var(--radius-md)] border bg-transparent px-5 text-[16px] leading-[22px] text-[var(--text-primary)] placeholder:text-[var(--text-disabled)]" />
      </div>
      <div aria-live="polite" className="h-4 px-5 text-[12px] leading-4 text-red-600" />
    </div>
  );
}
