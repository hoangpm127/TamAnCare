import { redirect } from "next/navigation";
import { TherapistProfileEditor } from "@/components/therapist-profile-editor";
import { getAdminSession } from "@/lib/server/admin-session";
import { therapistForSession } from "@/lib/server/therapist-session";

export const dynamic = "force-dynamic";

export default async function TherapistMePage() {
  const session = await getAdminSession();
  if (!session || session.role !== "THERAPIST") redirect("/dang-nhap-quan-tri");
  const therapist = await therapistForSession(session);
  if (!therapist) return null;
  return <TherapistProfileEditor branchLabel={session.branchLabel} initial={{
    fullName: therapist.fullName,
    phone: therapist.phone ?? "Chưa cập nhật",
    avatarUrl: therapist.avatarUrl,
    publicBio: therapist.publicBio,
    publicStrengths: therapist.publicStrengths,
    proposedAvatarUrl: therapist.proposedAvatarUrl,
    proposedBio: therapist.proposedBio,
    proposedStrengths: therapist.proposedStrengths,
    approvalStatus: therapist.profileApprovalStatus,
    reviewNote: therapist.profileReviewNote,
  }} />;
}
