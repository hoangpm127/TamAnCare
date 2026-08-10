type PaymentBreakdownInput = {
  originalAmount: number;
  discountAmount: number;
  depositPercent: number;
  prepaid?: boolean;
};

/**
 * Quy tắc thanh toán thống nhất của Tâm An Center:
 * - cọc = tỷ lệ trên giá trị cuối cùng sau toàn bộ ưu đãi;
 * - còn lại = giá trị cuối cùng trừ tiền cọc;
 * - lượt gói đã trả trước không phát sinh cọc hoặc công nợ.
 */
export function calculatePaymentBreakdown({
  originalAmount,
  discountAmount,
  depositPercent,
  prepaid = false,
}: PaymentBreakdownInput) {
  const safeOriginal = Math.max(0, Math.round(originalAmount));
  const safeDiscount = Math.min(safeOriginal, Math.max(0, Math.round(discountAmount)));

  if (prepaid) {
    return {
      originalAmount: safeOriginal,
      discountAmount: safeOriginal,
      totalAmount: 0,
      depositAmount: 0,
      balanceAmount: 0,
    };
  }

  const totalAmount = Math.max(0, safeOriginal - safeDiscount);
  const requestedDeposit = Math.round(totalAmount * Math.max(0, depositPercent) / 100);
  const depositAmount = Math.min(totalAmount, requestedDeposit);

  return {
    originalAmount: safeOriginal,
    discountAmount: safeDiscount,
    totalAmount,
    depositAmount,
    balanceAmount: Math.max(0, totalAmount - depositAmount),
  };
}
