import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  context: "customer" | "admin" | "therapist";
};

const COPY = {
  customer: "Đang mở nội dung cho bạn…",
  admin: "Đang đồng bộ dữ liệu quản trị…",
  therapist: "Đang cập nhật lịch điều phối…",
} as const;

export function PageLoadingState({ context }: Props) {
  const adminLike = context !== "customer";

  return (
    <div className="route-loading-state relative mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-10" role="status" aria-live="polite">
      <div className="route-loading-progress" aria-hidden="true" />
      <div className="route-loading-content">
        <div
          className={cn(
            "overflow-hidden rounded-3xl p-5 shadow-sm",
            adminLike
              ? "bg-gradient-to-br from-[#351b15] via-[#5c2718] to-[#8c211d]"
              : "border border-[#eadbd1] bg-white",
          )}
        >
          <div className="flex items-center gap-3">
            <span className={cn("route-skeleton h-11 w-11 shrink-0 rounded-2xl", adminLike ? "bg-white/[0.16]" : "bg-[#f3e5de]")} />
            <div className="min-w-0 flex-1 space-y-2">
              <div className={cn("route-skeleton h-4 w-2/5 rounded-full", adminLike ? "bg-white/[0.18]" : "bg-[#eadbd1]")} />
              <div className={cn("route-skeleton h-2.5 w-3/5 rounded-full", adminLike ? "bg-white/10" : "bg-[#f1e7e1]")} />
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="rounded-2xl border border-[#eadbd1] bg-white p-4 shadow-sm">
              <div className="route-skeleton h-2.5 w-1/2 rounded-full bg-[#eee2db]" />
              <div className="route-skeleton mt-3 h-5 w-3/4 rounded-full bg-[#e7d8cf]" />
              <div className="route-skeleton mt-3 h-2 w-full rounded-full bg-[#f3ebe6]" />
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-3 rounded-3xl border border-[#eadbd1] bg-white p-4 shadow-sm">
          {[0, 1, 2].map((item) => (
            <div key={item} className="flex items-center gap-3 border-b border-[#f2e8e2] pb-3 last:border-0 last:pb-0">
              <div className="route-skeleton h-10 w-10 shrink-0 rounded-xl bg-[#f0e2da]" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="route-skeleton h-3 w-3/5 rounded-full bg-[#eadbd1]" />
                <div className="route-skeleton h-2.5 w-4/5 rounded-full bg-[#f3ebe6]" />
              </div>
            </div>
          ))}
        </div>

        <p className="mt-4 flex items-center justify-center gap-2 text-xs font-medium text-[#8a7a72]">
          <LoaderCircle size={14} className="animate-spin text-[#9f1d20]" />
          {COPY[context]}
        </p>
      </div>
    </div>
  );
}
