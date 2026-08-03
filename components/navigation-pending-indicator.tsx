"use client";

import { LoaderCircle } from "lucide-react";
import { useLinkStatus } from "next/link";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  light?: boolean;
};

export function NavigationPendingIndicator({ className, light = false }: Props) {
  const { pending } = useLinkStatus();

  return (
    <span
      aria-hidden="true"
      data-pending={pending ? "true" : "false"}
      className={cn(
        "route-link-wait pointer-events-none absolute inset-0 z-10 items-center justify-center rounded-[inherit]",
        light ? "bg-white/15 text-white" : "bg-white/[0.78] text-[#c64b32] backdrop-blur-[1px]",
        className,
      )}
    >
      <LoaderCircle size={15} className="animate-spin" />
    </span>
  );
}
