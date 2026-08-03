import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fdf8f3] px-5 text-[#281b18]">
      <section className="w-full max-w-md rounded-3xl border border-[#e7d6ca] bg-white p-6 text-center shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#c64b32]">404 · Tâm An Center</p>
        <h1 className="mt-2 text-xl font-semibold">Không tìm thấy nội dung này</h1>
        <p className="mt-2 text-sm leading-6 text-[#68574f]">Liên kết có thể đã hết hạn, được thay đổi hoặc không thuộc quyền truy cập của bạn.</p>
        <Link href="/" className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-[#c64b32] px-4 py-3 text-sm font-semibold text-white">
          Về trang chủ
        </Link>
      </section>
    </main>
  );
}
