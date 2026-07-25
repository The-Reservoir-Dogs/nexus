import { cn } from "@/lib/utils";

export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-full bg-fork/20 text-sm font-medium text-fork",
        className
      )}
      aria-label={name}
    >
      {initials}
    </div>
  );
}
