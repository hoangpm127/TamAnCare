import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import { hashPassword } from "../lib/password";

function requiredValue(name: "DATABASE_URL" | "DEMO_ACCOUNT_PASSWORD", minimumLength = 1) {
  const value = process.env[name];
  if (!value || value.length < minimumLength) throw new Error(`${name} chưa được cấu hình hợp lệ.`);
  return value;
}

const databaseUrl = requiredValue("DATABASE_URL");
const password = requiredValue("DEMO_ACCOUNT_PASSWORD", 8);

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

async function main() {
  const branches = await prisma.branch.findMany({ orderBy: { createdAt: "asc" }, take: 2 });
  if (branches.length < 2) throw new Error("Cần có hai cơ sở trước khi đồng bộ tài khoản demo.");
  const therapists = await Promise.all(branches.map((branch) => prisma.therapist.findFirst({
    where: { branchId: branch.id, status: "ACTIVE" },
    orderBy: { fullName: "asc" },
  })));
  if (!therapists[0] || !therapists[1]) throw new Error("Mỗi cơ sở cần có ít nhất một KTV hoạt động.");

  const definitions = [
    { username: "admin", name: "Admin Tâm An", role: "OWNER", branchId: null, therapistId: null },
    { username: "quanlycs1", name: "Quản lý Cơ sở 1", role: "MANAGER", branchId: branches[0].id, therapistId: null },
    { username: "quanlycs2", name: "Quản lý Cơ sở 2", role: "MANAGER", branchId: branches[1].id, therapistId: null },
    { username: "letancs1", name: "Lễ tân Cơ sở 1", role: "RECEPTIONIST", branchId: branches[0].id, therapistId: null },
    { username: "letancs2", name: "Lễ tân Cơ sở 2", role: "RECEPTIONIST", branchId: branches[1].id, therapistId: null },
    { username: "ktvcs1", name: therapists[0].fullName, role: "THERAPIST", branchId: branches[0].id, therapistId: therapists[0].id },
    { username: "ktvcs2", name: therapists[1].fullName, role: "THERAPIST", branchId: branches[1].id, therapistId: therapists[1].id },
    { username: "nhadaututaman", name: "Nhà đầu tư Tâm An", role: "INVESTOR", branchId: null, therapistId: null },
  ] as const;

  const accounts = [];
  for (const definition of definitions) {
    accounts.push(await prisma.user.upsert({
      where: { username: definition.username },
      create: {
        ...definition,
        email: `${definition.username}@demo.tamancare.local`,
        passwordHash: hashPassword(password),
        passwordChangedAt: new Date(),
        isActive: true,
      },
      update: {
        name: definition.name,
        role: definition.role,
        branchId: definition.branchId,
        therapistId: definition.therapistId,
        passwordHash: hashPassword(password),
        passwordChangedAt: new Date(),
        failedLoginCount: 0,
        lockedUntil: null,
        isActive: true,
      },
      select: { id: true, username: true },
    }));
  }

  const userIds = accounts.map((account) => account.id);
  await prisma.$transaction([
    prisma.adminSession.deleteMany({ where: { userId: { in: userIds } } }),
  ]);

  const investor = accounts.find((account) => account.username === "nhadaututaman");
  if (!investor) throw new Error("Không đồng bộ được tài khoản nhà đầu tư.");
  const profile = await prisma.investorProfile.upsert({
    where: { userId: investor.id },
    create: {
      userId: investor.id,
      investedAmount: 1_500_000_000,
      ownershipPercent: 25,
      profitSharePercent: 25,
      targetAnnualReturn: 22,
      startDate: new Date("2026-01-01T00:00:00+07:00"),
      note: "Hồ sơ nhà đầu tư dùng kiểm thử vận hành.",
    },
    update: {},
  });
  for (const [index, branch] of branches.entries()) {
    await prisma.investorAllocation.upsert({
      where: { investorProfileId_branchId: { investorProfileId: profile.id, branchId: branch.id } },
      create: {
        investorProfileId: profile.id,
        branchId: branch.id,
        allocatedCapital: index === 0 ? 700_000_000 : 800_000_000,
        ownershipPercent: 25,
      },
      update: {},
    });
  }
  console.log(`Đã đồng bộ mật khẩu cho ${accounts.length} tài khoản demo; toàn bộ phiên cũ đã được thu hồi.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
