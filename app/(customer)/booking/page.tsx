import { Suspense } from "react";
import { getPublicCatalog } from "@/lib/server/public-catalog";
import { BookingClient } from "./booking-client";

// Railway build containers cannot reach the runtime-only private PostgreSQL host.
// Resolve the live catalog per request instead of prerendering it during image build.
export const dynamic = "force-dynamic";

export default async function BookingPage() {
  const catalog = await getPublicCatalog();
  if (!catalog.branches.length || !catalog.services.some((item) => item.category !== "OFFICE")) {
    return <main className="mx-auto min-h-[70dvh] max-w-lg px-4 py-12 text-center"><h1 className="text-xl font-semibold">Danh mục đặt lịch đang được cập nhật</h1><p className="mt-2 text-sm leading-6 text-[#8a7a72]">Tâm An Care chưa mở dịch vụ trực tuyến tại thời điểm này. Vui lòng quay lại sau hoặc liên hệ cơ sở.</p></main>;
  }
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#fffaf6] p-6">Đang tải lịch trống...</div>}>
      <BookingClient catalog={catalog} />
    </Suspense>
  );
}
