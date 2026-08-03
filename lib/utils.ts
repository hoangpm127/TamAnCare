import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

export function displayBookingCode(code: string) {
  const demoMatch = code.match(/^TAC-DEMO-(\d+)$/i);
  if (demoMatch) return `HĐ-260721-${demoMatch[1].padStart(3, "0")}`;
  if (/^TAC-/i.test(code)) {
    let hash = 2166136261;
    for (let index = 0; index < code.length; index += 1) {
      hash ^= code.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `HĐ-${String(hash >>> 0).padStart(10, "0")}`;
  }
  return code;
}

export function minutesToTime(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (totalMinutes % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function makeBookingCode(prefix = "TAC") {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${stamp}-${rand}`;
}

export function stripDurationFromName(name: string) {
  return name.replace(/\s*-?\s*\d+\s*phút\s*$/i, "").trim();
}

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}
