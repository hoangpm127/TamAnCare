export const BOOKING_UI_DRAFT_KEY = "taman.booking.ui-draft.v2";
export const BOOKING_UI_RESET_EVENT = "taman:booking-ui-reset";

export function clearBookingUiDraft(notify = true) {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(BOOKING_UI_DRAFT_KEY);
  if (notify) window.dispatchEvent(new CustomEvent(BOOKING_UI_RESET_EVENT));
}
