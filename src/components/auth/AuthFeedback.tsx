export default function AuthFeedback({ error, success }: { error?: string | null; success?: string | null }) {
  return <p data-auth-error tabIndex={-1} role={error ? "alert" : "status"} className={`min-h-[18px] whitespace-pre-line break-words text-center text-[13px] leading-5 ${error ? "text-red-700" : "text-[var(--accent-hover)]"}`}>{error ?? success}</p>;
}
