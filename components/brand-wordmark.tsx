import { cn } from "@/lib/utils";

export function BrandWordmark({
  className,
  label = "Tâm An Center",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <span
      role="img"
      aria-label={label}
      className={cn("brand-wordmark inline-block shrink-0", className)}
    />
  );
}
