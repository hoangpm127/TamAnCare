import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serviceMutationSchema } from "@/lib/service-admin";
import { requireAdminSession } from "@/lib/server/admin-session";
import { privateIdentifierDigest, isSameOriginMutation, requestIp } from "@/lib/server/request-security";
import { slugify } from "@/lib/utils";

async function uniqueSlug(name: string) {
  const base = slugify(name) || "dich-vu";
  const matches = await db.service.findMany({
    where: { slug: { startsWith: base } },
    select: { slug: true },
  });
  const used = new Set(matches.map((item) => item.slug));
  if (!used.has(base)) return base;
  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  }
  const session = await requireAdminSession(["OWNER"]);
  if (!session) {
    return NextResponse.json({ error: "Chỉ Admin toàn hệ thống được thêm dịch vụ." }, { status: 403 });
  }
  const parsed = serviceMutationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Thông tin dịch vụ chưa hợp lệ.", issues: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;
  const slug = await uniqueSlug(input.name);
  const service = await db.$transaction(async (tx) => {
    const created = await tx.service.create({
      data: {
        ...input,
        imageUrl: input.imageUrl || null,
        isOnline: input.isActive && input.isOnline,
        slug,
      },
      include: { _count: { select: { bookings: true, packagePlans: true, therapists: true, vouchers: true } } },
    });
    await tx.adminAuditLog.create({
      data: {
        actorUserId: session.id,
        action: "SERVICE_CREATE",
        entityType: "Service",
        entityId: created.id,
        after: created,
        ipHash: privateIdentifierDigest(requestIp(request)),
      },
    });
    return created;
  });
  revalidateTag("public-catalog", { expire: 0 });
  return NextResponse.json({ service }, { status: 201 });
}
