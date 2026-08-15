/**
 * Thông tin này được hiển thị công khai trên màn hình chuyển khoản và VietQR.
 * Không đặt webhook secret, API token hoặc thông tin xác thực trong module này.
 */
const generalProductionDefault = {
  bankId: "TPB",
  bankName: "TPBank",
  accountNumber: "88888888188",
  accountHolder: "CTCP DAU TU VA PT CONG NGHE XGROUP",
};

const packageProductionDefault = {
  bankId: "MBBank",
  bankName: "MBBank",
  accountNumber: "766996789",
  accountHolder: "NGUYEN VAN NGOC",
};

export type PaymentPurpose = "general" | "package";

function publicValue(value: string | undefined, fallback: string) {
  return value?.trim() || fallback;
}

export const generalPaymentConfig = {
  bankId: publicValue(process.env.NEXT_PUBLIC_PAYMENT_BANK_ID, generalProductionDefault.bankId),
  bankName: publicValue(process.env.NEXT_PUBLIC_PAYMENT_BANK_NAME, generalProductionDefault.bankName),
  accountNumber: publicValue(process.env.NEXT_PUBLIC_PAYMENT_ACCOUNT_NUMBER, generalProductionDefault.accountNumber),
  accountHolder: publicValue(process.env.NEXT_PUBLIC_PAYMENT_ACCOUNT_HOLDER, generalProductionDefault.accountHolder),
  configured: true,
  usesDemoFallback: false,
} as const;

export const packagePaymentConfig = {
  bankId: publicValue(process.env.NEXT_PUBLIC_PACKAGE_PAYMENT_BANK_ID, packageProductionDefault.bankId),
  bankName: publicValue(process.env.NEXT_PUBLIC_PACKAGE_PAYMENT_BANK_NAME, packageProductionDefault.bankName),
  accountNumber: publicValue(process.env.NEXT_PUBLIC_PACKAGE_PAYMENT_ACCOUNT_NUMBER, packageProductionDefault.accountNumber),
  accountHolder: publicValue(process.env.NEXT_PUBLIC_PACKAGE_PAYMENT_ACCOUNT_HOLDER, packageProductionDefault.accountHolder),
  configured: true,
  usesDemoFallback: false,
} as const;

export function getPublicPaymentConfig(purpose: PaymentPurpose = "general") {
  return purpose === "package" ? packagePaymentConfig : generalPaymentConfig;
}

// Giữ alias này để mọi luồng hiện hữu tiếp tục mặc định dùng tài khoản general.
export const publicPaymentConfig = generalPaymentConfig;
