import { BookingPaymentFlow } from "./booking-payment-flow";

export default async function BookingSuccessPage({ params }: { params: Promise<{ bookingCode: string }> }) {
  const { bookingCode } = await params;
  return <BookingPaymentFlow referenceCode={bookingCode} />;
}
