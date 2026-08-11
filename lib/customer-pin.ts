export const CUSTOMER_PIN_LENGTH = 4;

export function normalizeCustomerPin(value: string) {
  return value.replace(/\D/g, "").slice(0, CUSTOMER_PIN_LENGTH);
}

export function customerPinError(pin: string) {
  if (!new RegExp(`^\\d{${CUSTOMER_PIN_LENGTH}}$`).test(pin)) return "Mã PIN phải gồm đúng 4 số.";
  return null;
}
