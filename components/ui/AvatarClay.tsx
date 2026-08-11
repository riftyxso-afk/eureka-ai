interface AvatarClayProps {
  name?: string;
  size?: number;
}

export default function AvatarClay({ name = "Eureka", size = 48 }: AvatarClayProps) {
  const initial = (name.trim().charAt(0) || "E").toUpperCase();
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-clay-primary font-extrabold text-white border-2 border-clay-borderLight shadow-clay-sm"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      aria-hidden
    >
      {initial}
    </div>
  );
}
