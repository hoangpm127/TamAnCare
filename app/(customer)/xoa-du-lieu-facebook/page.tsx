import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Hướng dẫn xóa dữ liệu Facebook · Tâm An Center",
  description: "Hướng dẫn yêu cầu ngắt liên kết Facebook và xóa dữ liệu tài khoản Tâm An Center.",
};

export default function FacebookDataDeletionPage() {
  return (
    <main className="bg-[#fdf8f3] px-4 py-6 text-[#231b18] sm:px-6 sm:py-10">
      <article className="mx-auto max-w-3xl overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-[#e7d6ca]">
        <header className="bg-gradient-to-br from-[#2d1815] via-[#63281c] to-[#c64b32] px-5 py-7 text-white sm:px-8 sm:py-9">
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/75 hover:text-white">
            <ArrowLeft size={14} /> Về Trang chủ
          </Link>
          <p className="mt-5 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#f4d87e]">
            <ShieldCheck size={16} /> Tâm An Center
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Yêu cầu xóa dữ liệu Facebook</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75">
            Hướng dẫn ngắt liên kết Facebook và gửi yêu cầu xóa dữ liệu đã cung cấp cho Tâm An Center.
          </p>
        </header>

        <div className="space-y-7 px-5 py-6 text-sm leading-7 text-[#554842] sm:px-8 sm:py-8">
          <section>
            <h2 className="text-base font-semibold text-[#7e201b] sm:text-lg">1. Thu hồi quyền Facebook</h2>
            <ol className="mt-3 space-y-2 pl-5 marker:font-semibold marker:text-[#c64b32]">
              <li className="list-decimal pl-1">Mở phần Cài đặt và quyền riêng tư trong tài khoản Facebook của bạn.</li>
              <li className="list-decimal pl-1">Chọn Cài đặt, sau đó mở Ứng dụng và trang web.</li>
              <li className="list-decimal pl-1">Chọn Tâm An Center và gỡ ứng dụng để thu hồi quyền truy cập. Việc gỡ ứng dụng không tự động xóa lịch sử booking hoặc giao dịch cần lưu theo nghĩa vụ pháp lý.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#7e201b] sm:text-lg">2. Yêu cầu xóa dữ liệu tài khoản</h2>
            <p className="mt-2">
              Sau khi đăng nhập, hãy liên hệ bộ phận hỗ trợ Tâm An Center qua kênh hỗ trợ hiển thị trên nền tảng và yêu cầu “Xóa dữ liệu Facebook”. Cung cấp số điện thoại của tài khoản để chúng tôi xác minh chủ thể yêu cầu; không gửi mật khẩu Facebook hoặc mã OTP.
            </p>
            <p className="mt-2">
              Sau khi xác minh, chúng tôi sẽ xóa liên kết Facebook, định danh Facebook, ảnh đại diện và dữ liệu hồ sơ nhận từ Facebook trong phạm vi pháp luật cho phép. Dữ liệu booking, thanh toán hoặc nhật ký chống gian lận có thể được giữ lại trong thời hạn bắt buộc và sẽ được hạn chế sử dụng.
            </p>
          </section>

          <section className="rounded-2xl border border-[#e7d6ca] bg-[#fcf3ed] p-4">
            <h2 className="font-semibold text-[#7e201b]">Theo dõi yêu cầu</h2>
            <p className="mt-1">
              Bộ phận hỗ trợ sẽ xác nhận đã tiếp nhận, thông báo kết quả hoặc lý do cần giữ lại một phần dữ liệu. Bạn có thể dùng cùng số điện thoại tài khoản để hỏi trạng thái xử lý.
            </p>
          </section>

          <Link href="/tai-khoan" className="inline-flex rounded-full bg-[#8f201c] px-5 py-2.5 font-semibold text-white hover:bg-[#731915]">
            Đi tới Tài khoản
          </Link>
        </div>
      </article>
    </main>
  );
}
