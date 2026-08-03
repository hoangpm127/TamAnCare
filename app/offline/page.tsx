import Link from "next/link";
import { RefreshCw, WifiOff } from "lucide-react";

export const metadata = {
  title: "Mất kết nối | Tâm An Center",
};

export default function OfflinePage() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#fffaf6] px-5 text-[#191414]">
      <section className="w-full max-w-sm rounded-2xl border border-[#eadbd1] bg-white p-6 text-center shadow-sm">
        <WifiOff className="mx-auto text-[#d13f1f]" size={34} />
        <h1 className="mt-3 text-xl font-semibold">Thiết bị đang mất kết nối</h1>
        <p className="mt-2 text-sm leading-6 text-[#665b55]">Đặt lịch, thanh toán và dữ liệu tài khoản cần Internet để luôn chính xác. Vui lòng kết nối lại rồi thử lại.</p>
        <Link href="/" className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-[#d13f1f] px-5 py-3 text-sm font-semibold text-white"><RefreshCw size={16} /> Thử tải lại</Link>
      </section>
    </main>
  );
}
