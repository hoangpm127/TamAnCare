// Parses labels shaped like "HH:mm dd/MM" or "HH:mm dd/MM/yyyy" into a Date.
// Missing year defaults to the current year, which is fine for same-year delay comparisons.
function parseVnTimeLabel(label: string): Date | null {
  const match = label.match(/(\d{2}):(\d{2})\s+(\d{2})\/(\d{2})(?:\/(\d{4}))?/);
  if (!match) return null;
  const [, hh, mm, dd, MM, yyyy] = match;
  const year = yyyy ? Number(yyyy) : new Date().getFullYear();
  return new Date(year, Number(MM) - 1, Number(dd), Number(hh), Number(mm));
}

export function computeDelayMinutes(scheduledLabel?: string, actualLabel?: string): number | null {
  if (!scheduledLabel || !actualLabel) return null;
  const scheduled = parseVnTimeLabel(scheduledLabel);
  const actual = parseVnTimeLabel(actualLabel);
  if (!scheduled || !actual) return null;
  return Math.round((actual.getTime() - scheduled.getTime()) / 60000);
}

// Thời lượng khách thực sự dùng dịch vụ: giờ check-in thực tế -> giờ thanh toán (check-out).
export function computeActualServiceMinutes(checkinLabel?: string, paymentDate?: string, paymentTime?: string): number | null {
  if (!checkinLabel || !paymentDate || !paymentTime) return null;
  const checkin = parseVnTimeLabel(checkinLabel);
  const checkout = parseVnTimeLabel(`${paymentTime} ${paymentDate}`);
  if (!checkin || !checkout) return null;
  return Math.round((checkout.getTime() - checkin.getTime()) / 60000);
}
