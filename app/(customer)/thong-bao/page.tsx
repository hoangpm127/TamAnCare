import { Bell } from "lucide-react";
import { NotificationsList } from "./notifications-list";

export const metadata = {
  title: "Thông báo | Tâm An Care",
};

export default function NotificationsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-6 text-[#191414] sm:px-6">
      <div className="mb-4 flex items-center gap-2">
        <Bell className="text-[#9f1d20]" size={20} />
        <h1 className="text-xl font-semibold tracking-tight">Thông báo</h1>
      </div>
      <NotificationsList />
    </main>
  );
}
