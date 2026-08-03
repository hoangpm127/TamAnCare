import Link from "next/link";
import { AlertTriangle, ArrowLeft, FileCheck2 } from "lucide-react";
import { LEGAL_APPROVAL_REQUIRED, type LegalDocument } from "@/lib/server/legal-documents";

export function LegalDocumentPage({ document }: { document: LegalDocument }) {
  return (
    <main className="bg-[#fdf8f3] px-4 py-6 text-[#231b18] sm:px-6 sm:py-10">
      <article className="mx-auto max-w-3xl overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-[#e7d6ca]">
        <header className="bg-gradient-to-br from-[#2d1815] via-[#63281c] to-[#c64b32] px-5 py-7 text-white sm:px-8 sm:py-9">
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/75 hover:text-white">
            <ArrowLeft size={14} /> Về Trang chủ
          </Link>
          <p className="mt-5 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#f4d87e]">
            <FileCheck2 size={16} /> Tâm An Center · {document.version}
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{document.title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75">{document.summary}</p>
          <p className="mt-3 text-xs text-white/55">Ngày hiệu lực: {document.effectiveDate}</p>
        </header>

        <div className="px-5 py-6 sm:px-8 sm:py-8">
          <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            <AlertTriangle className="mt-0.5 shrink-0 text-amber-700" size={18} />
            <p><strong>Trạng thái pháp lý:</strong> {LEGAL_APPROVAL_REQUIRED}</p>
          </div>

          <div className="mt-7 space-y-7">
            {document.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="text-base font-semibold text-[#7e201b] sm:text-lg">{section.heading}</h2>
                {section.paragraphs?.map((paragraph) => (
                  <p key={paragraph} className="mt-2 text-sm leading-7 text-[#554842]">{paragraph}</p>
                ))}
                {section.bullets ? (
                  <ul className="mt-3 space-y-2 pl-5 text-sm leading-7 text-[#554842] marker:text-[#c64b32]">
                    {section.bullets.map((item) => <li key={item} className="list-disc pl-1">{item}</li>)}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>

          <nav className="mt-8 grid gap-2 border-t border-[#e7d6ca] pt-5 text-center text-xs font-semibold text-[#8a3a31] sm:grid-cols-3">
            <Link href="/dieu-khoan" className="rounded-full bg-[#f8ebe5] px-3 py-2.5">Điều khoản sử dụng</Link>
            <Link href="/chinh-sach-rieng-tu" className="rounded-full bg-[#f8ebe5] px-3 py-2.5">Bảo vệ dữ liệu</Link>
            <Link href="/chinh-sach-dat-lich" className="rounded-full bg-[#f8ebe5] px-3 py-2.5">Đặt lịch & đặt cọc</Link>
          </nav>
        </div>
      </article>
    </main>
  );
}
