/**
 * Thông tin này được hiển thị công khai trên màn hình chuyển khoản và VietQR.
 * Không đặt webhook secret, API token hoặc thông tin xác thực trong module này.
 */
const productionDefault = {
  bankId: "TPB",
  bankName: "TPBank",
  accountNumber: "88888888188",
  accountHolder: "CTCP DAU TU VA PT CONG NGHE XGROUP",
};

function publicValue(name: string, fallback: string) {
  const value = process.env[name]?.trim();
  return value || fallback;
}

export const publicPaymentConfig = {
  bankId: publicValue("NEXT_PUBLIC_PAYMENT_BANK_ID", productionDefault.bankId),
  bankName: publicValue("NEXT_PUBLIC_PAYMENT_BANK_NAME", productionDefault.bankName),
  accountNumber: publicValue("NEXT_PUBLIC_PAYMENT_ACCOUNT_NUMBER", productionDefault.accountNumber),
  accountHolder: publicValue("NEXT_PUBLIC_PAYMENT_ACCOUNT_HOLDER", productionDefault.accountHolder),
  configured: true,
  usesDemoFallback: false,
} as const;
