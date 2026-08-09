import { TherapistNav } from "@/components/therapist-nav";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/server/admin-session";

export default async function TherapistLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session || session.role !== "THERAPIST") redirect("/dang-nhap-quan-tri");
  if (session.mustChangePassword) redirect("/doi-mat-khau-quan-tri");
  return (
    <main className="min-h-screen bg-[#fdf8f3] text-[#281b18]">
      <TherapistNav branchLabel={session.branchLabel} />
      <div className="pb-20">{children}</div>
    </main>
  );
}
