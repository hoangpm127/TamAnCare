import { redirect } from "next/navigation";

export default function LegacyCheckInPage() {
  redirect("/don-cua-toi?tab=upcoming");
}
