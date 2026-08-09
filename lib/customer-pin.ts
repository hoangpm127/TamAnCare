export const CUSTOMER_PIN_LENGTH = 4;

const EASY_SEQUENCES = new Set([
  "0123", "1234", "2345", "3456", "4567", "5678", "6789",
  "9876", "8765", "7654", "6543", "5432", "4321", "3210",
]);

export function normalizeCustomerPin(value: string) {
  return value.replace(/\D/g, "").slice(0, CUSTOMER_PIN_LENGTH);
}

export function customerPinError(pin: string, phone?: string | null) {
  if (!new RegExp(`^\\d{${CUSTOMER_PIN_LENGTH}}$`).test(pin)) return "Mã PIN phải gồm đúng 4 số.";
  const repeatedDigit = new Set(pin).size === 1;
  const phoneDigits = phone?.replace(/\D/g, "") ?? "";
  if (repeatedDigit || EASY_SEQUENCES.has(pin) || (phoneDigits.length >= 4 && pin === phoneDigits.slice(-4))) {
    return "Mã PIN này quá dễ đoán. Hãy chọn 4 số khác.";
  }
  return null;
}
