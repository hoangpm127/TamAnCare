import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const TOTP_STEP_SECONDS = 30;
const TOTP_DIGITS = 6;

function base32Encode(input: Buffer) {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of input) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(input: string) {
  const normalized = input.toUpperCase().replace(/=+$/g, "").replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (const character of normalized) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index < 0) throw new Error("TOTP secret không hợp lệ.");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

function mfaEncryptionKey() {
  const configured = process.env.MFA_ENCRYPTION_KEY?.trim();
  if (configured) {
    const decoded = Buffer.from(configured, "base64");
    if (decoded.length !== 32) throw new Error("MFA_ENCRYPTION_KEY phải là 32 byte mã hóa Base64.");
    return decoded;
  }
  if (process.env.NODE_ENV === "production") throw new Error("MFA_ENCRYPTION_KEY chưa được cấu hình.");
  return createHash("sha256").update(process.env.SESSION_SECRET ?? "tam-an-local-mfa-key").digest();
}

export function encryptTotpSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", mfaEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

export function decryptTotpSecret(value: string) {
  const [version, ivValue, tagValue, encryptedValue] = value.split(":");
  if (version !== "v1" || !ivValue || !tagValue || !encryptedValue) throw new Error("Bí mật MFA không hợp lệ.");
  const decipher = createDecipheriv("aes-256-gcm", mfaEncryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function generateTotpSecret() {
  return base32Encode(randomBytes(20));
}

export function totpAtCounter(secret: string, counter: number) {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", base32Decode(secret)).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = (
    ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff)
  );
  return String(binary % (10 ** TOTP_DIGITS)).padStart(TOTP_DIGITS, "0");
}

export function verifyTotpCode(secret: string, input: string, now = Date.now()) {
  const code = input.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(code)) return null;
  const currentCounter = Math.floor(now / 1000 / TOTP_STEP_SECONDS);
  for (const offset of [-1, 0, 1]) {
    const counter = currentCounter + offset;
    const expected = Buffer.from(totpAtCounter(secret, counter));
    const actual = Buffer.from(code);
    if (expected.length === actual.length && timingSafeEqual(expected, actual)) return counter;
  }
  return null;
}

export function totpProvisioningUri(secret: string, username: string) {
  const issuer = "Tâm An Center";
  const label = `${issuer}:${username}`;
  const params = new URLSearchParams({ secret, issuer, algorithm: "SHA1", digits: String(TOTP_DIGITS), period: String(TOTP_STEP_SECONDS) });
  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
}

export function generateMfaRecoveryCodes(count = 10) {
  return Array.from({ length: count }, () => {
    const raw = base32Encode(randomBytes(10)).slice(0, 16);
    return raw.match(/.{1,4}/g)!.join("-");
  });
}

export function mfaRecoveryCodeHash(code: string) {
  const normalized = code.toUpperCase().replace(/[^A-Z2-7]/g, "");
  return createHmac("sha256", mfaEncryptionKey()).update(`recovery:${normalized}`).digest("hex");
}

export function isManagementMfaRequired(role: string) {
  return process.env.ADMIN_MFA_ENFORCEMENT === "required-management" && ["OWNER", "MANAGER", "XGROUP_SUPER_ADMIN", "DISTRICT_SALES_MANAGER"].includes(role);
}
