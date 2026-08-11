export const WELCOME_VOUCHER_CODE = "WELCOME150";
export const WELCOME_VOUCHER_VALIDITY_DAYS = 7;
export const WELCOME_VOUCHER_VALIDITY_MS = WELCOME_VOUCHER_VALIDITY_DAYS * 24 * 60 * 60 * 1000;

type WelcomeCreditAccount = {
  creditBalance: number;
  welcomeCreditGrantedAt: Date | null;
};

export function welcomeVoucherExpiresAt(grantedAt: Date | null) {
  if (!grantedAt || Number.isNaN(grantedAt.getTime())) return null;
  return new Date(grantedAt.getTime() + WELCOME_VOUCHER_VALIDITY_MS);
}

export function welcomeVoucherGrantedCutoff(now: Date) {
  return new Date(now.getTime() - WELCOME_VOUCHER_VALIDITY_MS);
}

export function hasActiveWelcomeVoucher(account: WelcomeCreditAccount | null | undefined, now = new Date()) {
  if (!account || account.creditBalance <= 0) return false;
  const expiresAt = welcomeVoucherExpiresAt(account.welcomeCreditGrantedAt);
  return Boolean(expiresAt && now.getTime() < expiresAt.getTime());
}
