import { ReviewForm } from "./review-form";

export default async function ReviewPage({ params }: { params: Promise<{ bookingCode: string }> }) {
  const { bookingCode } = await params;
  return <ReviewForm bookingCode={bookingCode} />;
}
