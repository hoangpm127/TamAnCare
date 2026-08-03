import { Suspense } from "react";
import { OrdersClient } from "./orders-client";

export const metadata = {
  title: "Đơn của tôi | Tâm An Center",
};

export default function OrdersPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#fdf8f3] p-6">Đang tải đơn của bạn...</div>}>
      <OrdersClient />
    </Suspense>
  );
}
