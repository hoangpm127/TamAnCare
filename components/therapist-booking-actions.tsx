export function TherapistBookingActions({ initialStatus }: { bookingCode: string; initialStatus: string }) {
  const message = initialStatus === "CONFIRMED"
    ? "Lịch đã sẵn sàng. Chờ lễ tân xác nhận khách có mặt."
    : initialStatus === "CHECKED_IN"
      ? "Khách đã được tiếp nhận. Lễ tân sẽ xác nhận khi khách lên giường và bắt đầu ca."
      : initialStatus === "IN_SERVICE"
        ? "Ca đang phục vụ. Lễ tân sẽ xác nhận check-out và thanh toán khi kết thúc."
        : "Trạng thái ca được đồng bộ từ quầy lễ tân.";

  return <p className="mt-5 rounded-xl bg-[#fbf2e7] p-3 text-sm font-semibold leading-6 text-[#76551d]">{message}</p>;
}
