import type { InputHTMLAttributes } from "react";

type AuthInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
};

export default function AuthInput({ label, id, error, hint, ...inputProps }: AuthInputProps) {
  return (
    <div className="flex w-full flex-col gap-[5px]">
      <div className="relative">
        <label htmlFor={id} className="absolute left-[15px] top-0 z-10 -translate-y-1/2 bg-[var(--surface-primary)] px-[5px] text-[12px] leading-none text-[var(--text-disabled)]">
          {label}
        </label>
        <input id={id} {...inputProps} aria-invalid={error ? true : undefined} aria-describedby={error || hint ? `${id}-feedback` : inputProps["aria-describedby"]} className="h-[54px] w-full rounded-[var(--radius-md)] border bg-transparent px-5 text-[16px] leading-[22px] text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] disabled:opacity-70" />
      </div>
      <div id={`${id}-feedback`} className={`min-h-4 whitespace-pre-line break-words px-2 text-[12px] leading-4 ${error ? "text-red-700" : "text-[var(--text-secondary)]"}`}>{error ?? hint}</div>
    </div>
  );
}
