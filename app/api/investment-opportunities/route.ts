import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { opportunitySchema } from "@/lib/investment-opportunity-validation";
import { requireAdminSession } from "@/lib/server/admin-session";
import { notifyInvestorsAboutOpportunity } from "@/lib/server/investor-notifications";
import {
  consumeRateLimit,
  isSameOriginMutation,
  privateIdentifierDigest,
  requestIp,
} from "@/lib/server/request-security";

function slugify(value: string) {
  const base = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 54);
  return `${base || "co-hoi"}-${Date.now().toString(36)}`;
}

export async function GET() {
  const session = await requireAdminSession(["OWNER"]);
  if (!session) return NextResponse.json({ error: "Chỉ Chủ Tâm An được quản lý cơ hội đầu tư." }, { status: 403 });
  const opportunities = await db.investmentOpportunity.findMany({
    include: { checks: { orderBy: { sortOrder: "asc" } } },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({
    opportunities: opportunities.map((item) => ({
      ...item,
      capitalNeed: Number(item.capitalNeed),
      expressedInterestCapital: Number(item.expressedInterestCapital),
      minimumCommitment: Number(item.minimumCommitment),
    })),
  });
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const session = await requireAdminSession(["OWNER"]);
  if (!session) return NextResponse.json({ error: "Chỉ Chủ Tâm An được tạo cơ hội đầu tư." }, { status: 403 });
  const parsed = opportunitySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Hồ sơ cơ hội chưa hợp lệ.", issues: parsed.error.flatten() }, { status: 400 });
  const limit = await consumeRateLimit({ scope: "investment-opportunity-create", identifier: session.id, limit: 15, windowMs: 24 * 60 * 60_000 });
  if (!limit.allowed) return NextResponse.json({ error: "Đã tạo quá nhiều hồ sơ trong ngày." }, { status: 429 });
  const now = new Date();
  const opportunity = await db.$transaction(async (tx) => {
    const created = await tx.investmentOpportunity.create({
      data: {
        slug: slugify(parsed.data.name),
        type: parsed.data.type,
        name: parsed.data.name,
        area: parsed.data.area,
        status: parsed.data.status,
        statusLabel: parsed.data.statusLabel,
        progressPercent: parsed.data.progressPercent,
        capitalNeed: BigInt(parsed.data.capitalNeed),
        expressedInterestCapital: BigInt(parsed.data.expressedInterestCapital),
        minimumCommitment: BigInt(parsed.data.minimumCommitment),
        targetReturnRange: parsed.data.targetReturnRange,
        expectedPaybackPeriod: parsed.data.expectedPaybackPeriod,
        expectedOpening: parsed.data.expectedOpening,
        nextUpdate: parsed.data.nextUpdate,
        aiAssessment: parsed.data.aiAssessment,
        highlights: parsed.data.highlights,
        isPublished: parsed.data.isPublished,
        publishedAt: parsed.data.isPublished ? now : null,
        createdByUserId: session.id,
        checks: { create: parsed.data.checks.map((item, index) => ({ ...item, sortOrder: index })) },
      },
      include: { checks: { orderBy: { sortOrder: "asc" } } },
    });
    if (created.isPublished) await notifyInvestorsAboutOpportunity(tx, created);
    await tx.adminAuditLog.create({
      data: {
        actorUserId: session.id,
        action: "INVESTMENT_OPPORTUNITY_CREATE",
        entityType: "InvestmentOpportunity",
        entityId: created.id,
        after: { name: created.name, status: created.status, isPublished: created.isPublished, capitalNeed: Number(created.capitalNeed) },
        ipHash: privateIdentifierDigest(requestIp(request)),
      },
    });
    return created;
  });
  return NextResponse.json({
    persisted: true,
    opportunity: {
      ...opportunity,
      capitalNeed: Number(opportunity.capitalNeed),
      expressedInterestCapital: Number(opportunity.expressedInterestCapital),
      minimumCommitment: Number(opportunity.minimumCommitment),
    },
  }, { status: 201 });
}
