import { ExternalLink, MapPin, Navigation } from "lucide-react";
import { cn } from "@/lib/utils";

type GoogleMapEmbedProps = {
  address: string;
  branchLabel: string;
  className?: string;
};

export function GoogleMapEmbed({ address, branchLabel, className }: GoogleMapEmbedProps) {
  const query = `TÂM AN CENTER ${branchLabel}, ${address}`;
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

  return (
    <a
      href={mapsHref}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Mở vị trí thật trên Google Maps"
      className={cn(
        "group block overflow-hidden rounded-[1.65rem] border border-[#e1c8b7] bg-white shadow-[0_12px_30px_rgba(101,48,35,0.12)] transition active:scale-[0.99]",
        className,
      )}
    >
      <div
        role="img"
        aria-label="Bản đồ vị trí TÂM AN CENTER"
        className="relative h-52 overflow-hidden bg-[#eee9df] sm:h-60"
      >
        <div className="absolute inset-0 opacity-90 [background-image:linear-gradient(32deg,transparent_46%,rgba(255,255,255,.92)_47%,rgba(255,255,255,.92)_52%,transparent_53%),linear-gradient(118deg,transparent_42%,rgba(255,255,255,.82)_43%,rgba(255,255,255,.82)_48%,transparent_49%)] [background-size:150px_115px,190px_145px]" />
        <div className="absolute -left-8 top-12 h-7 w-[120%] -rotate-6 border-y border-[#dcccad] bg-[#f6e8c7]" />
        <div className="absolute -right-8 top-24 h-5 w-[105%] rotate-[22deg] border-y border-white/80 bg-white/70" />
        <div className="absolute left-[14%] top-0 h-[120%] w-4 rotate-[8deg] border-x border-white/80 bg-white/65" />
        <div className="absolute right-[12%] top-0 h-[115%] w-3 -rotate-[15deg] border-x border-white/80 bg-white/55" />
        <div className="absolute left-[7%] top-[18%] h-8 w-14 rounded-md bg-[#d7e5c7]/80" />
        <div className="absolute bottom-[12%] right-[6%] h-12 w-20 rounded-xl bg-[#d7e5c7]/75" />
        <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full border border-black/5 bg-white/95 px-3 py-1.5 text-[10px] font-bold text-[#3f3a36] shadow-sm">
          <span className="text-[#4285f4]">G</span>
          <span>Google Maps</span>
        </div>

        <div className="absolute left-1/2 top-[47%] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
          <span className="absolute top-8 h-12 w-12 animate-ping rounded-full bg-[#c64b32]/20 [animation-duration:2.2s]" />
          <span className="relative flex h-12 w-12 items-center justify-center rounded-full border-[3px] border-white bg-gradient-to-br from-[#d65d3f] to-[#8a2324] text-white shadow-[0_8px_22px_rgba(113,34,31,0.35)]">
            <MapPin size={23} fill="currentColor" strokeWidth={1.8} />
          </span>
          <span className="relative mt-2 whitespace-nowrap rounded-full border border-[#d7bdac] bg-white/95 px-3 py-1.5 text-[10px] font-bold tracking-[0.08em] text-[#6f211f] shadow-md">
            TÂM AN CENTER
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-[#eadbd0] bg-gradient-to-r from-[#fffaf6] to-white px-4 py-3.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#f6e7dd] text-[#b83b2d]">
          <Navigation size={18} fill="currentColor" />
        </span>
        <span className="min-w-0 flex-1">
          <strong className="block truncate text-xs text-[#39211c]">TÂM AN CENTER · {branchLabel}</strong>
          <small className="mt-0.5 block text-[10px] leading-4 text-[#7a6961]" data-no-translate>{address}</small>
          <small className="mt-1 block text-[10px] font-semibold text-[#a2352d]">Xem đường đi và thời gian di chuyển</small>
        </span>
        <ExternalLink size={16} className="shrink-0 text-[#a2352d] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </div>
    </a>
  );
}
