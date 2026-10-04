type UserAvatarProps = {
  size?: number;
  className?: string;
};

export default function UserAvatar({
  size = 44,
  className = "",
}: UserAvatarProps) {
  return (
    <div
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full bg-[#E5C3FF] text-[#410075] ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-[52%] w-[52%]"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      >
        <circle cx="12" cy="8" r="3.25" />
        <path d="M5.5 20c.85-3.3 3.3-5 6.5-5s5.65 1.7 6.5 5" />
      </svg>
    </div>
  );
}
