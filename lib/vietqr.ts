import { publicPaymentConfig as bankAccount } from "@/lib/public-payment-config";

export type VietQrBankApp = {
  appId: string;
  appLogo: string;
  appName: string;
  bankName: string;
  deeplink: string;
  autofill?: number;
};

export function buildVietQrImageUrl(amount: number, transferContent: string) {
  const path = `${bankAccount.bankId}-${bankAccount.accountNumber}-compact2.png`;
  const params = new URLSearchParams({
    amount: String(Math.round(amount)),
    addInfo: transferContent.slice(0, 25),
    accountName: bankAccount.accountHolder,
  });

  return `https://img.vietqr.io/image/${path}?${params.toString()}`;
}

export function buildVietQrBankAppUrl({
  app,
  amount,
  transferContent,
  returnUrl,
}: {
  app: Pick<VietQrBankApp, "deeplink">;
  amount: number;
  transferContent: string;
  returnUrl: string;
}) {
  const url = new URL(app.deeplink);
  url.searchParams.set("ba", `${bankAccount.accountNumber}@${bankAccount.bankId.toLowerCase()}`);
  url.searchParams.set("am", String(Math.round(amount)));
  url.searchParams.set("tn", transferContent.slice(0, 50));
  url.searchParams.set("bn", bankAccount.accountHolder);
  url.searchParams.set("url", returnUrl);
  return url.toString();
}
