import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

type GoogleMapEmbedProps = {
  address: string;
  branchLabel: string;
  className?: string;
};

export function GoogleMapEmbed({ address, branchLabel, className }: GoogleMapEmbedProps) {
  const query = `Tâm An Center ${branchLabel}, ${address}`;
  const embedSrc = `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

  return (
    <div className={cn("overflow-hidden rounded-2xl border border-[#e7d6ca] bg-white shadow-sm", className)}>
      <iframe
        title={`Bản đồ Google Maps · Tâm An Center ${branchLabel}`}
        src={embedSrc}
        loading="lazy"
        allowFullScreen
        referrerPolicy="no-referrer-when-downgrade"
        className="h-52 w-full border-0 sm:h-60"
      />
      <a
        href={mapsHref}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 border-t border-[#eee0d6] bg-[#fffaf6] px-4 py-3 text-xs font-semibold text-[#7c2927]"
      >
        <ExternalLink size={14} /> Mở địa chỉ trên Google Maps
      </a>
    </div>
  );
}
