import { CheckoutPaymentFlow } from "./checkout-payment-flow";

export default async function CheckoutPaymentPage({ params }: { params: Promise<{ bookingCode: string }> }) {
  const { bookingCode } = await params;
  return <CheckoutPaymentFlow bookingCode={bookingCode} />;
}
