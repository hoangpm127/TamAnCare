import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminSession } from "@/lib/server/admin-session";
import { opportunityUpdateSchema } from "@/lib/investment-opportunity-validation";
import { notifyInvestorsAboutOpportunity } from "@/lib/server/investor-notifications";
import { consumeRateLimit, isSameOriginMutation, privateIdentifierDigest, requestIp } from "@/lib/server/request-security";

export async function PATCH(request: Request, context: { params: Promise<{ opportunityId: string }> }) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const session = await requireAdminSession(["OWNER"]);
  if (!session) return NextResponse.json({ error: "Chỉ Chủ Tâm An được cập nhật cơ hội đầu tư." }, { status: 403 });
  const parsed = opportunityUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Nội dung cập nhật chưa hợp lệ.", issues: parsed.error.flatten() }, { status: 400 });
  const limit = await consumeRateLimit({ scope: "investment-opportunity-update", identifier: session.id, limit: 60, windowMs: 24 * 60 * 60_000 });
  if (!limit.allowed) return NextResponse.json({ error: "Đã cập nhật quá nhiều lần trong ngày." }, { status: 429 });
  const { opportunityId } = await context.params;
  const current = await db.investmentOpportunity.findUnique({ where: { id: opportunityId }, include: { checks: true } });
  if (!current) return NextResponse.json({ error: "Không tìm thấy cơ hội đầu tư." }, { status: 404 });
  const {
    checks,
    notifyInvestors: sendNotice,
    capitalNeed,
    expressedInterestCapital,
    minimumCommitment,
    ...changes
  } = parsed.data;
  const shouldPublish = changes.isPublished === true && !current.isPublished;
  const updated = await db.$transaction(async (tx) => {
    if (checks) {
      await tx.investmentOpportunityCheck.deleteMany({ where: { opportunityId } });
    }
    const item = await tx.investmentOpportunity.update({
      where: { id: opportunityId },
      data: {
        ...changes,
        ...(capitalNeed !== undefined ? { capitalNeed: BigInt(capitalNeed) } : {}),
        ...(expressedInterestCapital !== undefined ? { expressedInterestCapital: BigInt(expressedInterestCapital) } : {}),
        ...(minimumCommitment !== undefined ? { minimumCommitment: BigInt(minimumCommitment) } : {}),
        ...(shouldPublish ? { publishedAt: new Date() } : changes.isPublished === false ? { publishedAt: null } : {}),
        ...(checks ? { checks: { create: checks.map((check, index) => ({ ...check, sortOrder: index })) } } : {}),
      },
      include: { checks: { orderBy: { sortOrder: "asc" } } },
    });
    if (shouldPublish || (sendNotice && item.isPublished)) await notifyInvestorsAboutOpportunity(tx, item);
    await tx.adminAuditLog.create({
      data: {
        actorUserId: session.id,
        action: "INVESTMENT_OPPORTUNITY_UPDATE",
        entityType: "InvestmentOpportunity",
        entityId: item.id,
        before: { status: current.status, progressPercent: current.progressPercent, isPublished: current.isPublished },
        after: { status: item.status, progressPercent: item.progressPercent, isPublished: item.isPublished, noticeSent: Boolean(shouldPublish || sendNotice) },
        ipHash: privateIdentifierDigest(requestIp(request)),
      },
    });
    return item;
  });
  return NextResponse.json({
    persisted: true,
    opportunity: {
      ...updated,
      capitalNeed: Number(updated.capitalNeed),
      expressedInterestCapital: Number(updated.expressedInterestCapital),
      minimumCommitment: Number(updated.minimumCommitment),
    },
  });
}
