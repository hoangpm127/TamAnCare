import "server-only";

const LEGACY_TEXT_REPLACEMENTS: Array<[RegExp, string]> = [
  [/Ch\?\s*Tu\?\s*T\?m\s*\?\s*UAT/gi, "Admin Tâm An"],
  [/Admin\s+Tu\?\s*T\?m/gi, "Admin Tâm An"],
  [/Tu\?\s*T\?m\s+Care/gi, "Tâm An Care"],
  [/Kh�ch\s+ki\?m\s+th\?\s+WELCOME/gi, "Khách kiểm thử WELCOME"],
  [/Kh\?ch\s+ki\?m\s+th\?\s+WELCOME/gi, "Khách kiểm thử WELCOME"],
  [/TAC-DEMO-(\d+)/gi, "Bill #$1"],
];

export function repairLegacyVisibleText(value: string) {
  return LEGACY_TEXT_REPLACEMENTS.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value);
}

export function looksLikeCorruptedVietnamese(value: string) {
  return value.includes("�") || /(?:Tu\?|T\?m|C\? s\?|Ã|Â|á»|áº)/i.test(value);
}
