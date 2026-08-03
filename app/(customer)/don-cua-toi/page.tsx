import { Suspense } from "react";
import { OrdersClient } from "./orders-client";

export const metadata = {
  title: "Đơn của tôi | Tâm An Care",
};

export default function OrdersPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#fffaf6] p-6">Đang tải đơn của bạn...</div>}>
      <OrdersClient />
    </Suspense>
  );
}
