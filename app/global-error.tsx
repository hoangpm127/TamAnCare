"use client";

import { useEffect, useState } from "react";
import { BrandWordmark } from "@/components/brand-wordmark";
import {
  CUSTOMER_LANGUAGE_STORAGE_KEY,
  isCustomerLanguage,
  translateCustomerText,
  type CustomerLanguage,
} from "@/lib/customer-i18n";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [language, setLanguage] = useState<CustomerLanguage>("vi");

  useEffect(() => {
    console.error("ui.global_error", { digest: error.digest, name: error.name });
    let timer: number | undefined;
    try {
      const stored = window.localStorage.getItem(CUSTOMER_LANGUAGE_STORAGE_KEY);
      if (isCustomerLanguage(stored)) timer = window.setTimeout(() => setLanguage(stored), 0);
    } catch {
      // Vietnamese remains the safe fallback when browser storage is unavailable.
    }
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [error]);

  const t = (source: string) => translateCustomerText(source, language);

  return (
    <html lang={language === "zh" ? "zh-CN" : language}>
      <body className="m-0 bg-[#fdf8f3] font-sans text-[#281b18]">
        <main className="flex min-h-screen items-center justify-center px-5">
          <section className="w-full max-w-md rounded-3xl border border-[#e7d6ca] bg-white p-6 text-center shadow-xl">
            <BrandWordmark className="mx-auto h-[21px] w-40 text-[#c64b32]" />
            <h1 className="mt-2 text-xl font-semibold">{t("Màn hình vừa gặp sự cố")}</h1>
            <p className="mt-2 text-sm leading-6 text-[#68574f]">
              {t("Dữ liệu giao dịch chưa được tự động thay đổi. Bạn có thể thử tải lại; nếu lỗi lặp lại, hãy báo lễ tân hoặc quản lý.")}
            </p>
            {error.digest ? <p className="mt-2 text-[10px] text-[#826f66]">{t("Mã tra soát:")} {error.digest}</p> : null}
            <button type="button" onClick={reset} className="mt-5 w-full rounded-full bg-[#c64b32] px-4 py-3 text-sm font-semibold text-white">
              {t("Thử tải lại")}
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
