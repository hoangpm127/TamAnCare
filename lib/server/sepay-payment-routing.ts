import {
  generalPaymentConfig,
  packagePaymentConfig,
  type PaymentPurpose,
} from "@/lib/public-payment-config";

export type SepayAccountPurpose = "GENERAL" | "PACKAGE" | "REVIEW";

export function normalizeAccountNumber(value: string) {
  return value.replace(/\D/g, "");
}

export function classifySepayAccount(accountNumber: string): SepayAccountPurpose {
  const incoming = normalizeAccountNumber(accountNumber);
  const packageAccount = normalizeAccountNumber(packagePaymentConfig.accountNumber);

  // Tài khoản gói phải luôn được xét trước allowlist chung, kể cả khi biến môi trường chứa cả hai.
  if (incoming && incoming === packageAccount) return "PACKAGE";

  const configuredGeneralAccounts = (process.env.SEPAY_ACCOUNT_NUMBERS?.trim()
    || generalPaymentConfig.accountNumber)
    .split(",")
    .map(normalizeAccountNumber)
    .filter((value) => value && value !== packageAccount);

  return configuredGeneralAccounts.includes(incoming) ? "GENERAL" : "REVIEW";
}

export function paymentPurposeFromRelation(hasCustomerPackage: boolean): Uppercase<PaymentPurpose> {
  return hasCustomerPackage ? "PACKAGE" : "GENERAL";
}

export function accountPurposeMatchesPayment(
  accountPurpose: Exclude<SepayAccountPurpose, "REVIEW">,
  hasCustomerPackage: boolean,
) {
  return accountPurpose === paymentPurposeFromRelation(hasCustomerPackage);
}
