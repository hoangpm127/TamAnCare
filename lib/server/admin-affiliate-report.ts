import "server-only";

import { db } from "@/lib/db";
import { affiliateCustomerId, AFFILIATE_RECONCILIATION_DAYS } from "@/lib/referral-policy";
import { ledgerReportWhere } from "@/lib/server/ledger-reporting";
import {
  ADMIN_AFFILIATE_PERIOD_OPTIONS,
  type AdminAffiliateInvitedCustomer,
  type AdminAffiliatePeriod,
  type AdminAffiliateProfile,
  type AdminAffiliateReport,
  type AdminAffiliateTimelineItem,
} from "@/lib/admin-affiliate-types";

const DAY_MS = 24 * 60 * 60 * 1000;

function vietnamDateKey(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function reportRange(period: AdminAffiliatePeriod, now = new Date()) {
  const today = new Date(`${vietnamDateKey(now)}T00:00:00+07:00`);
  const dayCount = period === "today" ? 1 : Number(period.slice(0, -1));
  const start = new Date(today.getTime() - Math.max(0, dayCount - 1) * DAY_MS);
  return {
    start,
    end: now,
    label: ADMIN_AFFILIATE_PERIOD_OPTIONS.find((item) => item.value === period)?.label ?? "1 tháng qua",
  };
}

function payoutDueAt(occurredAt: Date) {
  return new Date(occurredAt.getTime() + AFFILIATE_RECONCILIATION_DAYS * DAY_MS);
}

function campaignCodeFromDescription(description: string) {
  return description.split("·")[1]?.trim() ?? "Affiliate";
}

type MutableInvitation = AdminAffiliateInvitedCustomer & { orderIds: Set<string> };

export async function getAdminAffiliateReport(input: {
  period: AdminAffiliatePeriod;
  showPaid: boolean;
}): Promise<AdminAffiliateReport> {
  const now = new Date();
  const range = reportRange(input.period, now);
  const [campaigns, commissions] = await Promise.all([
    db.campaign.findMany({
      where: { source: { startsWith: "AFFILIATE:" } },
      select: {
        id: true,
        code: true,
        source: true,
        createdAt: true,
        guestReferrals: {
          where: { referralClaimedCustomerId: { not: null } },
          select: {
            referralClaimedCustomerId: true,
            referralInstalledAt: true,
            referralClaimedCustomer: { select: { id: true, fullName: true, phone: true, createdAt: true } },
          },
        },
        bookings: {
          select: {
            id: true,
            groupId: true,
            customerId: true,
            startTime: true,
            status: true,
            totalAmount: true,
            customer: { select: { id: true, fullName: true, phone: true, createdAt: true } },
          },
          orderBy: { startTime: "desc" },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.ledgerEntry.findMany({
      where: {
        ...ledgerReportWhere(),
        category: "OPERATING_EXPENSE",
        direction: "OUT",
        description: { startsWith: "Hoa hồng Affiliate" },
        customerId: { not: null },
        occurredAt: { gte: range.start, lte: range.end },
      },
      include: {
        affiliatePayout: { include: { paidBy: { select: { name: true } } } },
        branch: { select: { id: true, name: true } },
        customer: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            area: true,
            createdAt: true,
            account: {
              select: {
                phoneVerifiedAt: true,
                affiliateArea: true,
                affiliateBankName: true,
                affiliateBankAccount: true,
                affiliateBankHolder: true,
              },
            },
          },
        },
        booking: {
          select: {
            bookingCode: true,
            customerId: true,
            customer: { select: { id: true, fullName: true, phone: true } },
            service: { select: { name: true } },
          },
        },
        bookingGroup: {
          select: {
            referenceCode: true,
            customerId: true,
            customer: { select: { id: true, fullName: true, phone: true } },
            bookings: { select: { service: { select: { name: true } } } },
          },
        },
      },
      orderBy: { occurredAt: "desc" },
    }),
  ]);

  const campaignOwnerIds = campaigns.map((campaign) => affiliateCustomerId(campaign.source)).filter((id): id is string => Boolean(id));
  const commissionOwnerIds = commissions.map((commission) => commission.customerId).filter((id): id is string => Boolean(id));
  const ownerIds = [...new Set([...campaignOwnerIds, ...commissionOwnerIds])];
  const owners = ownerIds.length
    ? await db.customer.findMany({
        where: { id: { in: ownerIds } },
        select: {
          id: true,
          fullName: true,
          phone: true,
          area: true,
          createdAt: true,
          account: {
            select: {
              phoneVerifiedAt: true,
              affiliateArea: true,
              affiliateBankName: true,
              affiliateBankAccount: true,
              affiliateBankHolder: true,
            },
          },
        },
      })
    : [];
  const ownerById = new Map(owners.map((owner) => [owner.id, owner]));

  const campaignsByOwner = new Map<string, typeof campaigns>();
  for (const campaign of campaigns) {
    const ownerId = affiliateCustomerId(campaign.source);
    if (!ownerId || ownerId === "") continue;
    const current = campaignsByOwner.get(ownerId) ?? [];
    current.push(campaign);
    campaignsByOwner.set(ownerId, current);
  }

  const invitedByOwner = new Map<string, Map<string, MutableInvitation>>();
  function invitationMap(ownerId: string) {
    const existing = invitedByOwner.get(ownerId);
    if (existing) return existing;
    const created = new Map<string, MutableInvitation>();
    invitedByOwner.set(ownerId, created);
    return created;
  }
  function ensureInvitation(ownerId: string, customer: { id: string; fullName: string; phone: string; createdAt: Date }, joinedAt: Date) {
    const items = invitationMap(ownerId);
    const existing = items.get(customer.id);
    if (existing) {
      if (joinedAt < new Date(existing.joinedAt)) existing.joinedAt = joinedAt.toISOString();
      return existing;
    }
    const created: MutableInvitation = {
      id: customer.id,
      name: customer.fullName,
      phone: customer.phone,
      joinedAt: joinedAt.toISOString(),
      lastBookingAt: null,
      bookingCount: 0,
      completedCount: 0,
      completedRevenue: 0,
      status: "REGISTERED",
      orderIds: new Set(),
    };
    items.set(customer.id, created);
    return created;
  }

  for (const [ownerId, ownerCampaigns] of campaignsByOwner) {
    for (const campaign of ownerCampaigns) {
      for (const referral of campaign.guestReferrals) {
        const customer = referral.referralClaimedCustomer;
        if (!customer || customer.id === ownerId) continue;
        ensureInvitation(ownerId, customer, referral.referralInstalledAt ?? customer.createdAt);
      }
      for (const booking of campaign.bookings) {
        if (booking.customerId === ownerId) continue;
        const invitation = ensureInvitation(ownerId, booking.customer, booking.customer.createdAt);
        const orderId = booking.groupId ?? booking.id;
        if (!invitation.orderIds.has(orderId)) {
          invitation.orderIds.add(orderId);
          invitation.bookingCount += 1;
          if (booking.status === "COMPLETED") {
            invitation.completedCount += 1;
            invitation.completedRevenue += booking.totalAmount;
          }
        }
        if (!invitation.lastBookingAt || booking.startTime > new Date(invitation.lastBookingAt)) invitation.lastBookingAt = booking.startTime.toISOString();
        invitation.status = invitation.completedCount > 0 ? "COMPLETED" : "BOOKED";
      }
    }
  }

  const timelineAll: AdminAffiliateTimelineItem[] = commissions.flatMap((commission) => {
    const affiliate = commission.customer;
    if (!affiliate) return [];
    const referredCustomer = commission.bookingGroup?.customer ?? commission.booking?.customer ?? null;
    const dueAt = commission.affiliatePayout?.dueAt ?? payoutDueAt(commission.occurredAt);
    const status = commission.affiliatePayout?.status ?? "PENDING";
    const serviceNames = commission.bookingGroup?.bookings.map((booking) => booking.service.name) ?? [];
    const serviceLabel = commission.booking?.service.name
      ?? (serviceNames.length > 1 ? `${serviceNames.length} dịch vụ · ${[...new Set(serviceNames)].join(", ")}` : serviceNames[0])
      ?? "Dịch vụ Tâm An";
    return [{
      id: commission.id,
      amount: commission.amount,
      occurredAt: commission.occurredAt.toISOString(),
      dueAt: dueAt.toISOString(),
      status,
      isOverdue: status === "PENDING" && dueAt < now,
      affiliateId: affiliate.id,
      affiliateName: affiliate.fullName,
      affiliatePhone: affiliate.phone,
      referredCustomerId: referredCustomer?.id ?? null,
      referredCustomerName: referredCustomer?.fullName ?? "Khách được giới thiệu",
      referredCustomerPhone: referredCustomer?.phone ?? "",
      referenceCode: commission.bookingGroup?.referenceCode ?? commission.booking?.bookingCode ?? "Bút toán Affiliate",
      serviceLabel,
      branchId: commission.branch.id,
      branchLabel: commission.branch.name.replace(/^Tâm An Center · /, ""),
      campaignCode: campaignCodeFromDescription(commission.description),
      paidAt: commission.affiliatePayout?.paidAt?.toISOString() ?? null,
      paidByName: commission.affiliatePayout?.paidBy?.name ?? null,
      transferReference: commission.affiliatePayout?.transferReference ?? null,
      payoutNote: commission.affiliatePayout?.note ?? null,
    }];
  });

  const earningsByOwner = new Map<string, { earned: number; pending: number; paid: number; count: number }>();
  for (const item of timelineAll) {
    const current = earningsByOwner.get(item.affiliateId) ?? { earned: 0, pending: 0, paid: 0, count: 0 };
    current.earned += item.amount;
    current.count += 1;
    if (item.status === "PAID") current.paid += item.amount;
    else current.pending += item.amount;
    earningsByOwner.set(item.affiliateId, current);
  }

  const affiliates: AdminAffiliateProfile[] = ownerIds.flatMap((ownerId) => {
    const owner = ownerById.get(ownerId);
    if (!owner) return [];
    const account = owner.account;
    const bankName = account?.affiliateBankName ?? null;
    const bankAccount = account?.affiliateBankAccount ?? null;
    const bankHolder = account?.affiliateBankHolder ?? null;
    const earnings = earningsByOwner.get(ownerId) ?? { earned: 0, pending: 0, paid: 0, count: 0 };
    const invitedCustomers = [...(invitedByOwner.get(ownerId)?.values() ?? [])]
      .map((customer) => ({
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        joinedAt: customer.joinedAt,
        lastBookingAt: customer.lastBookingAt,
        bookingCount: customer.bookingCount,
        completedCount: customer.completedCount,
        completedRevenue: customer.completedRevenue,
        status: customer.status,
      }))
      .sort((a, b) => new Date(b.lastBookingAt ?? b.joinedAt).getTime() - new Date(a.lastBookingAt ?? a.joinedAt).getTime());
    return [{
      id: owner.id,
      name: owner.fullName,
      phone: owner.phone,
      area: account?.affiliateArea ?? owner.area,
      joinedAt: owner.createdAt.toISOString(),
      phoneVerified: Boolean(account?.phoneVerifiedAt),
      campaignCodes: (campaignsByOwner.get(ownerId) ?? []).map((campaign) => campaign.code),
      bank: {
        name: bankName,
        account: bankAccount,
        holder: bankHolder,
        complete: Boolean(bankName && bankAccount && bankHolder),
      },
      invitedCustomers,
      periodEarnings: earnings.earned,
      periodPending: earnings.pending,
      periodPaid: earnings.paid,
      periodCommissionCount: earnings.count,
    }];
  }).sort((a, b) => b.periodPending - a.periodPending || b.invitedCustomers.length - a.invitedCustomers.length || a.name.localeCompare(b.name, "vi"));

  const pending = timelineAll.filter((item) => item.status === "PENDING");
  const paid = timelineAll.filter((item) => item.status === "PAID");
  const referredCustomerIds = new Set(affiliates.flatMap((affiliate) => affiliate.invitedCustomers.map((customer) => customer.id)));
  return {
    generatedAt: now.toISOString(),
    range: {
      period: input.period,
      label: range.label,
      from: range.start.toISOString(),
      to: range.end.toISOString(),
    },
    showPaid: input.showPaid,
    stats: {
      pendingAmount: pending.reduce((sum, item) => sum + item.amount, 0),
      paidAmount: paid.reduce((sum, item) => sum + item.amount, 0),
      earnedAmount: timelineAll.reduce((sum, item) => sum + item.amount, 0),
      overdueAmount: pending.filter((item) => item.isOverdue).reduce((sum, item) => sum + item.amount, 0),
      pendingCount: pending.length,
      paidCount: paid.length,
      affiliateCount: affiliates.length,
      referredCustomerCount: referredCustomerIds.size,
    },
    timeline: timelineAll.filter((item) => input.showPaid ? item.status === "PAID" : item.status === "PENDING"),
    affiliates,
  };
}
