import { UserRound } from "lucide-react";

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
      <UserRound aria-hidden="true" focusable="false" strokeWidth={2} className="h-[52%] w-[52%]" />
    </div>
  );
}
