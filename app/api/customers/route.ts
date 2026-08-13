import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@/app/generated/prisma/client";
import { canAccessAdminSection } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/server/admin-session";
import { notifyCustomer, notifyOperations } from "@/lib/server/notification-service";
import { isSameOriginMutation, privateIdentifierDigest, requestIp } from "@/lib/server/request-security";
import { customerPinError } from "@/lib/customer-pin";
import { hashPassword } from "@/lib/password";
import { createCustomerMembership } from "@/lib/server/customer-registration";

const createSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(8).max(20),
  branchId: z.string().min(1),
  relationship: z.enum(["WALK_IN", "FRIEND", "BOSS", "PARTNER"]),
  note: z.string().trim().max(1000).optional(),
  createAccount: z.boolean().optional().default(false),
  pin: z.string().optional(),
  acceptTerms: z.boolean().optional().default(false),
  acceptPrivacy: z.boolean().optional().default(false),
  marketingOptIn: z.boolean().optional().default(false),
}).superRefine((value, context) => {
  if (!value.createAccount) return;
  if (!value.pin || !/^\d{4}$/.test(value.pin)) {
    context.addIssue({ code: "custom", path: ["pin"], message: "Mã PIN phải gồm đúng 4 số." });
  }
  if (!value.acceptTerms) {
    context.addIssue({ code: "custom", path: ["acceptTerms"], message: "Khách cần đồng ý điều khoản sử dụng." });
  }
  if (!value.acceptPrivacy) {
    context.addIssue({ code: "custom", path: ["acceptPrivacy"], message: "Khách cần đồng ý chính sách bảo vệ dữ liệu." });
  }
});

const customerGroups = new Set(["ALL", "NEW", "RETURNING", "VIP", "LONG_TERM", "BUSINESS", "AFFILIATE"]);
const accountFilters = new Set(["ALL", "REGISTERED", "NO_ACCOUNT", "PIN_MISSING"]);
const sortOptions = new Set(["NEWEST", "VISITS", "SPEND"]);

function boundedInteger(value: string | null, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.min(Math.max(parsed, minimum), maximum) : fallback;
}

export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session || session.mustChangePassword || !canAccessAdminSection(session, "customers")) {
    return NextResponse.json({ error: "Bạn không có quyền xem danh sách khách hàng." }, { status: 403 });
  }

  const url = new URL(request.url);
  const page = boundedInteger(url.searchParams.get("page"), 1, 1, 100000);
  const limit = boundedInteger(url.searchParams.get("limit"), 50, 1, 100);
  const query = (url.searchParams.get("query") ?? "").trim().slice(0, 100);
  const requestedGroup = (url.searchParams.get("group") ?? "ALL").toUpperCase();
  const requestedAccount = (url.searchParams.get("account") ?? "ALL").toUpperCase();
  const requestedSort = (url.searchParams.get("sort") ?? "NEWEST").toUpperCase();
  const group = customerGroups.has(requestedGroup) ? requestedGroup : "ALL";
  const account = accountFilters.has(requestedAccount) ? requestedAccount : "ALL";
  const sort = sortOptions.has(requestedSort) ? requestedSort : "NEWEST";
  const conditions: Prisma.CustomerWhereInput[] = [];

  if (query) {
    const phoneQuery = query.replace(/[^\d+]/g, "");
    conditions.push({
      OR: [
        { fullName: { contains: query, mode: "insensitive" } },
        { phone: { contains: phoneQuery || query } },
        { email: { contains: query, mode: "insensitive" } },
        { zalo: { contains: query, mode: "insensitive" } },
        { account: { is: { affiliateArea: { contains: query, mode: "insensitive" } } } },
      ],
    });
  }

  if (["NEW", "RETURNING", "VIP"].includes(group)) conditions.push({ segment: group });
  if (group === "LONG_TERM") conditions.push({ OR: [{ segment: "LONG_TERM" }, { packages: { some: { status: "ACTIVE" } } }] });
  if (group === "BUSINESS") conditions.push({ OR: [{ segment: "BUSINESS" }, { officeEvents: { some: {} } }] });
  if (group === "AFFILIATE") conditions.push({
    OR: [
      { segment: "AFFILIATE" },
      {
        account: {
          is: {
            affiliateArea: { not: null },
            affiliateBankAccount: { not: null },
          },
        },
      },
    ],
  });

  if (account === "REGISTERED") conditions.push({ account: { isNot: null } });
  if (account === "NO_ACCOUNT") conditions.push({ account: { is: null } });
  if (account === "PIN_MISSING") conditions.push({ account: { is: { pinHash: null } } });

  const where: Prisma.CustomerWhereInput = conditions.length ? { AND: conditions } : {};
  const orderBy: Prisma.CustomerOrderByWithRelationInput[] = sort === "SPEND"
    ? [{ totalSpend: "desc" }, { createdAt: "desc" }]
    : sort === "VISITS"
      ? [{ totalVisits: "desc" }, { createdAt: "desc" }]
      : [{ createdAt: "desc" }, { id: "desc" }];

  const [summary, customers] = await db.$transaction([
    db.customer.aggregate({
      where,
      _count: { _all: true },
      _sum: { totalVisits: true, totalSpend: true },
    }),
    db.customer.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        createdAt: true,
        segment: true,
        totalVisits: true,
        totalSpend: true,
        internalNote: true,
        firstSource: true,
        lastVisitAt: true,
        account: {
          select: {
            createdAt: true,
            phoneVerifiedAt: true,
            pinHash: true,
            affiliateArea: true,
            affiliateBankAccount: true,
          },
        },
        favoriteTherapist: { select: { fullName: true } },
        packages: {
          where: { status: "ACTIVE" },
          select: { id: true, planNameSnapshot: true, packagePlan: { select: { name: true } } },
        },
        bookings: {
          where: session.role === "OWNER" ? {} : { branchId: session.branchId ?? "__none__" },
          orderBy: { startTime: "desc" },
          take: 5,
          select: {
            id: true,
            branchId: true,
            startTime: true,
            totalAmount: true,
            status: true,
            branch: { select: { name: true } },
            service: { select: { name: true } },
            therapist: { select: { fullName: true } },
          },
        },
        _count: { select: { officeEvents: true } },
      },
    }),
  ]);

  return NextResponse.json({
    customers: customers.map((customer) => {
      const groups = new Set<string>();
      if (customerGroups.has(customer.segment) && customer.segment !== "ALL") groups.add(customer.segment);
      if (customer.packages.length) groups.add("LONG_TERM");
      if (customer.segment === "BUSINESS" || customer._count.officeEvents > 0) groups.add("BUSINESS");
      const affiliateConfigured = Boolean(customer.account?.affiliateArea && customer.account.affiliateBankAccount);
      if (affiliateConfigured) groups.add("AFFILIATE");
      if (!groups.size) groups.add("NEW");

      const customerAccount = customer.account;
      return {
        ...customer,
        _count: undefined,
        groups: [...groups],
        account: customerAccount ? {
          registeredAt: customerAccount.createdAt,
          phoneVerified: Boolean(customerAccount.phoneVerifiedAt),
          pinConfigured: Boolean(customerAccount.pinHash),
          affiliateConfigured,
        } : null,
      };
    }),
    pagination: {
      page,
      pageSize: limit,
      total: summary._count._all,
      pageCount: Math.max(1, Math.ceil(summary._count._all / limit)),
    },
    summary: {
      customers: summary._count._all,
      visits: summary._sum.totalVisits ?? 0,
      spend: summary._sum.totalSpend ?? 0,
    },
  });
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const session = await getAdminSession();
  if (!session || session.mustChangePassword || !["OWNER", "BRANCH_MANAGER", "RECEPTIONIST"].includes(session.role)) {
    return NextResponse.json({ error: "Chỉ Admin, Quản lý hoặc Lễ tân được tạo hồ sơ khách." }, { status: 403 });
  }
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Thông tin khách hàng chưa hợp lệ.", issues: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;
  if (session.role !== "OWNER" && input.branchId !== session.branchId) {
    return NextResponse.json({ error: "Bạn chỉ được tiếp nhận khách tại cơ sở mình phụ trách." }, { status: 403 });
  }
  const branch = await db.branch.findUnique({ where: { id: input.branchId } });
  if (!branch) return NextResponse.json({ error: "Không tìm thấy cơ sở tiếp nhận." }, { status: 404 });

  const normalizedPhone = input.phone.replace(/\s+/g, "");
  if (input.createAccount) {
    const pinError = customerPinError(input.pin ?? "");
    if (pinError) return NextResponse.json({ error: pinError }, { status: 400 });
    const existingAccount = await db.customerAccount.findUnique({ where: { phone: normalizedPhone } });
    if (existingAccount) {
      return NextResponse.json({ error: "Số điện thoại này đã có tài khoản. Hãy mở hồ sơ khách để cấp lại Mã PIN khi cần." }, { status: 409 });
    }
  }

  const consentAt = new Date();
  const ipHash = privateIdentifierDigest(requestIp(request));
  const userAgent = request.headers.get("user-agent")?.trim();
  const userAgentHash = userAgent ? privateIdentifierDigest(userAgent) : undefined;
  const firstSource = `CRM_${input.relationship}:${input.branchId}` as const;

  const result = await db.$transaction(async (tx) => {
    let created;
    let createdAccountId: string | null = null;
    if (input.createAccount) {
      const membership = await createCustomerMembership(tx, {
        fullName: input.fullName,
        phone: normalizedPhone,
        passwordHash: null,
        pinHash: hashPassword(input.pin ?? ""),
        phoneVerifiedAt: null,
        marketingOptIn: input.marketingOptIn,
        consentAt,
        subjectHash: privateIdentifierDigest(normalizedPhone),
        ipHash,
        userAgentHash,
        firstSource,
      });
      createdAccountId = membership.id;
      created = await tx.customer.update({
        where: { id: membership.customerId },
        data: { internalNote: input.note || undefined },
      });
    } else {
      created = await tx.customer.upsert({
        where: { phone: normalizedPhone },
        create: {
          fullName: input.fullName,
          phone: normalizedPhone,
          firstSource,
          internalNote: input.note,
          commonIssues: [],
        },
        update: {
          fullName: input.fullName,
          firstSource,
          internalNote: input.note || undefined,
        },
      });
      await notifyCustomer(tx, created.id, {
        branchId: input.branchId,
        type: "SYSTEM",
        title: `${branch.name.replace(/^Tâm An Center · /, "")} đã tiếp nhận hồ sơ của bạn`,
        body: input.note ? "Ghi chú chăm sóc đã được chuyển tới đội ngũ vận hành." : "Đội ngũ đã sẵn sàng hỗ trợ bạn đặt lịch phù hợp.",
        actionUrl: "/booking",
      });
    }
    await notifyOperations(tx, {
      branchId: input.branchId,
      type: input.relationship === "PARTNER" ? "INVITATION" : "SYSTEM",
      title: `${input.createAccount ? "Thành viên tại quầy" : "CRM mới"} · ${created.fullName}`,
      body: `${created.phone} · ${input.relationship === "WALK_IN" ? "Khách đến trực tiếp" : input.relationship === "FRIEND" ? "Bạn giới thiệu" : input.relationship === "BOSS" ? "Mời sếp/đồng nghiệp" : "Đối tác/Affiliate"}${input.createAccount ? " · Đã tạo Mã PIN cùng Lễ tân." : "."}`,
      actionUrl: "/admin/customers",
    });
    await tx.adminAuditLog.create({
      data: {
        actorUserId: session.id,
        branchId: input.branchId,
        action: input.createAccount ? "CRM_CUSTOMER_ACCOUNT_CREATED" : "CRM_CUSTOMER_UPSERT",
        entityType: input.createAccount ? "CustomerAccount" : "Customer",
        entityId: createdAccountId ?? created.id,
        after: {
          fullName: created.fullName,
          phoneMasked: `${created.phone.slice(0, 3)}***${created.phone.slice(-3)}`,
          relationship: input.relationship,
          accountCreated: input.createAccount,
          requiredConsentGranted: input.createAccount ? true : undefined,
        },
        ipHash,
      },
    });
    return { customer: created, accountCreated: input.createAccount };
  });
  return NextResponse.json({ persisted: true, ...result }, { status: 201 });
}
