import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

type Mode = "uat" | "production";
type Status = "PASS" | "WARN" | "FAIL";
type Check = { group: string; name: string; status: Status; detail: string };

function modeFromArgs(): Mode {
  const value = process.argv.find((argument) => argument.startsWith("--mode="))?.split("=")[1];
  if (value === "production" || value === "uat") return value;
  throw new Error("Dùng --mode=uat hoặc --mode=production.");
}

function isPlaceholder(value: string | undefined) {
  if (!value?.trim()) return true;
  return /(replace|example|changeme|your-|demo-secret|postgres:postgres)/i.test(value);
}

function safeHost(databaseUrl: string | undefined) {
  if (!databaseUrl) return "chưa cấu hình";
  try {
    const url = new URL(databaseUrl);
    return `${url.hostname}:${url.port || "5432"}/${url.pathname.replace(/^\//, "")}`;
  } catch {
    return "URL không hợp lệ";
  }
}

const mode = modeFromArgs();
const checks: Check[] = [];
const add = (group: string, name: string, status: Status, detail: string) => checks.push({ group, name, status, detail });
const required = (group: string, name: string, envName: string, minLength = 1) => {
  const value = process.env[envName];
  const ok = !isPlaceholder(value) && (value?.length ?? 0) >= minLength;
  add(group, name, ok ? "PASS" : "FAIL", ok ? `${envName} đã cấu hình` : `${envName} thiếu, là placeholder hoặc quá ngắn`);
};
const integration = (name: string, envNames: string[], productionRequired = true) => {
  const configured = envNames.every((envName) => !isPlaceholder(process.env[envName]));
  const status: Status = configured ? "PASS" : mode === "production" && productionRequired ? "FAIL" : "WARN";
  add("Tích hợp", name, status, configured ? "Đã có đủ biến cấu hình" : `Còn thiếu: ${envNames.filter((envName) => isPlaceholder(process.env[envName])).join(", ")}`);
};

required("Nền tảng", "Kết nối PostgreSQL", "DATABASE_URL", 20);
required("Bảo mật", "Khóa phiên", "SESSION_SECRET", 32);
required("Bảo mật", "Khóa rate limit", "RATE_LIMIT_SECRET", 32);
required("Bảo mật", "Khóa cron", "CRON_SECRET", 32);
required("Bảo mật", "Khóa mã hóa MFA", "MFA_ENCRYPTION_KEY", 40);
required("Nền tảng", "URL ứng dụng", "NEXT_PUBLIC_APP_URL", 12);

add(
  "Nền tảng",
  "Đúng môi trường",
  process.env.APP_ENV === mode ? "PASS" : "FAIL",
  `APP_ENV=${process.env.APP_ENV ?? "chưa cấu hình"}; yêu cầu ${mode}`,
);
add(
  "Bảo mật",
  "Cookie chỉ qua HTTPS",
  process.env.SESSION_COOKIE_SECURE === "true" ? "PASS" : "FAIL",
  `SESSION_COOKIE_SECURE=${process.env.SESSION_COOKIE_SECURE ?? "chưa cấu hình"}`,
);
add(
  "Thanh toán",
  "Không mô phỏng giao dịch trên production",
  mode === "production"
    ? process.env.ENABLE_UAT_PAYMENT_SIMULATION !== "true" ? "PASS" : "FAIL"
    : process.env.ENABLE_UAT_PAYMENT_SIMULATION === "true" ? "PASS" : "WARN",
  `ENABLE_UAT_PAYMENT_SIMULATION=${process.env.ENABLE_UAT_PAYMENT_SIMULATION ?? "chưa cấu hình"}`,
);
add(
  "Nền tảng",
  "Ép HTTPS",
  process.env.FORCE_HTTPS === "true" ? "PASS" : mode === "production" ? "FAIL" : "WARN",
  `FORCE_HTTPS=${process.env.FORCE_HTTPS ?? "chưa cấu hình"}`,
);
add(
  "Bảo mật",
  "MFA quản lý bắt buộc",
  process.env.ADMIN_MFA_ENFORCEMENT === "required-management" ? "PASS" : mode === "production" ? "FAIL" : "WARN",
  `ADMIN_MFA_ENFORCEMENT=${process.env.ADMIN_MFA_ENFORCEMENT ?? "chưa cấu hình"}`,
);

integration("Tài khoản nhận VietQR", [
  "NEXT_PUBLIC_PAYMENT_BANK_ID",
  "NEXT_PUBLIC_PAYMENT_BANK_NAME",
  "NEXT_PUBLIC_PAYMENT_ACCOUNT_NUMBER",
  "NEXT_PUBLIC_PAYMENT_ACCOUNT_HOLDER",
]);
integration("Đối soát SePay", ["SEPAY_WEBHOOK_SECRET", "SEPAY_ACCOUNT_NUMBERS"]);
const customerOauthEnabled = process.env.CUSTOMER_OAUTH_ENABLED === "true";
if (customerOauthEnabled) integration("Đăng nhập Google", ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "OAUTH_STATE_SECRET"]);
else add("Tích hợp", "Đăng nhập mạng xã hội", "PASS", "Đã tắt theo thiết kế số điện thoại + Mã PIN Tâm An");
const facebookConfigured = ["FACEBOOK_APP_ID", "FACEBOOK_APP_SECRET", "OAUTH_STATE_SECRET"].every((envName) => !isPlaceholder(process.env[envName]));
const facebookPublic = process.env.FACEBOOK_LOGIN_PUBLIC === "true";
add(
  "Tích hợp",
  "Đăng nhập Facebook",
  !customerOauthEnabled ? "PASS" : facebookConfigured && facebookPublic ? "PASS" : "WARN",
  !customerOauthEnabled
    ? "Đã tắt theo thiết kế đăng nhập khách hiện tại"
    : facebookConfigured && facebookPublic
    ? "Đã cấu hình và cho phép khách production sử dụng"
    : facebookConfigured
      ? "Đã có khóa nhưng đang ẩn cho tới khi Meta xác minh và phát hành ứng dụng"
      : "Chưa cấu hình; giao diện không hiển thị Facebook Login",
);
const otpProvider = process.env.OTP_PROVIDER?.trim().toUpperCase();
const otpRequired = process.env.PHONE_VERIFICATION_REQUIRED === "true";
const otpTemplatesApproved = otpProvider !== "ESMS" || process.env.ESMS_TEMPLATES_APPROVED === "true";
const otpCredentials = otpProvider === "ESMS"
  ? ["ESMS_API_KEY", "ESMS_SECRET_KEY"]
  : otpProvider === "SPEEDSMS"
    ? ["SPEEDSMS_ACCESS_TOKEN"]
  : otpProvider === "FIREBASE"
    ? ["FIREBASE_PHONE_API_KEY", "FIREBASE_PHONE_AUTH_DOMAIN", "FIREBASE_PHONE_PROJECT_ID", "FIREBASE_PHONE_APP_ID"]
  : otpProvider === "WEBHOOK"
    ? ["OTP_DELIVERY_WEBHOOK_URL", "OTP_DELIVERY_WEBHOOK_TOKEN"]
    : [];
const otpConfigured = ["ESMS", "SPEEDSMS", "FIREBASE", "WEBHOOK"].includes(otpProvider ?? "")
  && otpCredentials.every((envName) => !isPlaceholder(process.env[envName]))
  && !(mode === "production" && otpProvider === "ESMS" && process.env.ESMS_SANDBOX === "true")
  && !(mode === "production" && !otpTemplatesApproved)
  && !(otpProvider === "ESMS" && process.env.ESMS_SMS_TYPE === "2" && isPlaceholder(process.env.ESMS_BRANDNAME))
  && !(otpProvider === "ESMS" && (!process.env.ESMS_CALLBACK_URL?.trim() || !process.env.ESMS_CALLBACK_TOKEN?.trim()));

function isOtpTemplate(content: string) {
  const normalized = content.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return /\{\{?(?:OTP|CODE|P)(?::\d+)?\}?\}/i.test(content) && (normalized.includes("otp") || normalized.includes("ma xac"));
}

async function otpProviderCheck() {
  const statusWhenUnavailable: Status = otpRequired && mode === "production" ? "FAIL" : "WARN";
  if (!otpConfigured) {
    add(
      "Tích hợp",
      "Xác minh và khôi phục qua OTP",
      statusWhenUnavailable,
      otpRequired
        ? `PHONE_VERIFICATION_REQUIRED=true nhưng ${otpProvider || "OTP_PROVIDER"} chưa sẵn sàng`
        : "Chưa bật xác minh bắt buộc; booking vãng lai không bị ảnh hưởng",
    );
    return;
  }
  if (otpProvider !== "ESMS") {
    add("Tích hợp", "Xác minh và khôi phục qua OTP", "PASS", `${otpProvider} đã có đủ biến cấu hình`);
    return;
  }
  try {
    const response = await fetch("https://rest.esms.vn/MainService.svc/json/GetTemplate/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ApiKey: process.env.ESMS_API_KEY,
        SecretKey: process.env.ESMS_SECRET_KEY,
        Brandname: process.env.ESMS_BRANDNAME?.trim() ?? "",
        OAId: "",
        SmsType: process.env.ESMS_SMS_TYPE === "2" ? "2" : "8",
      }),
      signal: AbortSignal.timeout(8_000),
    });
    const payload = await response.json() as {
      CodeResult?: string | number;
      BrandnameTemplates?: Array<{ TempId?: number; TempContent?: string }>;
    };
    const configuredTemplateId = Number(process.env.ESMS_OTP_TEMPLATE_ID?.trim() || 0);
    const approved = (payload.BrandnameTemplates ?? []).find((item) => {
      if (configuredTemplateId > 0 && item.TempId !== configuredTemplateId) return false;
      return isOtpTemplate(item.TempContent ?? "");
    });
    const ready = response.ok && String(payload.CodeResult) === "100" && Boolean(approved);
    add(
      "Tích hợp",
      "Xác minh và khôi phục qua OTP",
      ready ? "PASS" : statusWhenUnavailable,
      ready ? `eSMS đã đối chiếu mẫu OTP ${approved?.TempId ?? "hợp lệ"}` : "eSMS chưa trả về mẫu OTP đã duyệt; hệ thống sẽ không gửi nội dung mặc định",
    );
  } catch {
    add("Tích hợp", "Xác minh và khôi phục qua OTP", statusWhenUnavailable, "Không thể đối chiếu mẫu OTP trực tiếp với eSMS");
  }
}
integration("Lưu ảnh chứng từ quy mô lớn", [
  "OBJECT_STORAGE_ENDPOINT",
  "OBJECT_STORAGE_BUCKET",
  "OBJECT_STORAGE_ACCESS_KEY_ID",
  "OBJECT_STORAGE_SECRET_ACCESS_KEY",
], false);
integration("Giám sát lỗi", ["SENTRY_DSN"], false);
integration("AI đọc chứng từ", ["OPENAI_API_KEY"], false);

const databaseUrl = process.env.DATABASE_URL;
const prisma = databaseUrl ? new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) }) : null;

async function databaseChecks() {
  if (!prisma) return;
  try {
    await prisma.$queryRaw`SELECT 1`;
    add("CSDL", "Kết nối", "PASS", safeHost(databaseUrl));
  } catch {
    add("CSDL", "Kết nối", "FAIL", `Không kết nối được ${safeHost(databaseUrl)}`);
    return;
  }

  try {
    const [migrationRows, branches, serviceCount, roleCounts, activeUatUsers] = await Promise.all([
      prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*)::bigint AS count FROM "_prisma_migrations" WHERE "finished_at" IS NOT NULL AND "rolled_back_at" IS NULL`,
      prisma.branch.findMany({
        include: {
          rooms: { where: { status: "ACTIVE" }, select: { type: true } },
          _count: { select: { therapists: { where: { status: "ACTIVE" } }, rooms: { where: { status: "ACTIVE" } } } },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.service.count({ where: { isActive: true, isOnline: true } }),
      prisma.user.groupBy({ by: ["role"], where: { isActive: true }, _count: { _all: true } }),
      prisma.user.count({ where: { isActive: true, username: { startsWith: "uat." } } }),
    ]);

    const migrationCount = Number(migrationRows[0]?.count ?? 0);
    add("CSDL", "Migration", migrationCount > 0 ? "PASS" : "FAIL", `${migrationCount} migration đã hoàn tất`);
    add("Danh mục", "Số cơ sở đang cấu hình", branches.some((branch) => branch.id === "tam-an-center-tay-ho") ? "PASS" : "FAIL", `${branches.length} cơ sở; cơ sở 2 mới ở trạng thái đề xuất`);
    add("Danh mục", "Dịch vụ online", serviceCount > 0 ? "PASS" : "FAIL", `${serviceCount} dịch vụ đang nhận lịch`);
    for (const branch of branches) {
      const isTamAnCenter = branch.id === "tam-an-center-tay-ho";
      const expectedSeats = isTamAnCenter ? 6 : branch.seatCapacity;
      add(
        "Danh mục",
        `${branch.name} · sức chứa`,
        branch.seatCapacity === expectedSeats ? "PASS" : "WARN",
        `${branch.seatCapacity} ghế/giường; mốc kiểm thử ${expectedSeats}`,
      );
      add(
        "Danh mục",
        `${branch.name} · KTV`,
        branch._count.therapists >= (isTamAnCenter ? 3 : 1) ? "PASS" : "FAIL",
        `${branch._count.therapists} KTV hoạt động; yêu cầu tối thiểu ${isTamAnCenter ? 3 : 1}`,
      );
      add(
        "Danh mục",
        `${branch.name} · giờ hoạt động`,
        !isTamAnCenter || (branch.openTime === "09:00" && branch.closeTime === "21:00" && branch.lastBookingTime === "20:45") ? "PASS" : "FAIL",
        `${branch.openTime}–${branch.closeTime}; ca cuối ${branch.lastBookingTime}`,
      );
      add(
        "Danh mục",
        `${branch.name} · tài nguyên đặt chỗ`,
        branch._count.rooms === expectedSeats ? "PASS" : "FAIL",
        `${branch._count.rooms}/${expectedSeats} giường đang hoạt động`,
      );
      if (isTamAnCenter) {
        const headSpaBeds = branch.rooms.filter((room) => room.type === "HEAD_SPA_BED").length;
        const footBeds = branch.rooms.filter((room) => room.type === "FOOT_CHAIR").length;
        const bodyBeds = branch.rooms.filter((room) => room.type === "MASSAGE_BED").length;
        const layoutMatches = headSpaBeds === 0 && footBeds === 0 && bodyBeds === 6;
        add(
          "Danh mục",
          `${branch.name} · cơ cấu giường`,
          layoutMatches ? "PASS" : "FAIL",
          `${headSpaBeds} gội · ${footBeds} Foot · ${bodyBeds} massage; yêu cầu 0/0/6`,
        );
      }
    }

    const countFor = (role: string) => roleCounts.find((item) => item.role === role)?._count._all ?? 0;
    // Giai đoạn vận hành ban đầu chỉ có hai tài khoản nội bộ bắt buộc:
    // Admin (OWNER) và Lễ tân. Khách hàng dùng CustomerAccount riêng; các vai
    // trò mở rộng được giữ trong kiến trúc nhưng không chặn phát hành.
    for (const [role, minimum] of [["OWNER", 1], ["RECEPTIONIST", 1]] as const) {
      const count = countFor(role);
      add("Phân quyền", role, count >= minimum ? "PASS" : "FAIL", `${count} tài khoản hoạt động; yêu cầu tối thiểu ${minimum}`);
    }
    for (const role of ["MANAGER", "INVESTOR", "XGROUP_SUPER_ADMIN", "DISTRICT_SALES_MANAGER"] as const) {
      const count = countFor(role);
      add(
        "Phân quyền",
        `${role} (mở rộng)`,
        count > 0 ? "PASS" : "WARN",
        count > 0 ? `${count} tài khoản hoạt động` : "Chưa cấp tài khoản; không ảnh hưởng quy trình Khách hàng - Lễ tân - Admin",
      );
    }
    const activeTherapistUsers = countFor("THERAPIST");
    add(
      "Phân quyền",
      "KTV không đăng nhập hệ thống",
      activeTherapistUsers === 0 ? "PASS" : "FAIL",
      activeTherapistUsers === 0 ? "KTV chỉ còn là hồ sơ nhân sự để phân công" : `${activeTherapistUsers} tài khoản KTV vẫn đang hoạt động`,
    );
    add(
      "Phân quyền",
      "Tài khoản UAT",
      mode === "uat" ? (activeUatUsers >= 5 ? "PASS" : "FAIL") : (activeUatUsers === 0 ? "PASS" : "FAIL"),
      mode === "uat" ? `${activeUatUsers}/5 tài khoản nội bộ UAT` : `${activeUatUsers} tài khoản UAT còn hoạt động trên production`,
    );

    const managementWithoutMfa = await prisma.user.count({
      where: {
        isActive: true,
        role: { in: ["OWNER", "MANAGER", "XGROUP_SUPER_ADMIN", "DISTRICT_SALES_MANAGER"] },
        mfaEnabledAt: null,
      },
    });
    add(
      "Bảo mật",
      "Owner/Quản lý đã bật MFA",
      managementWithoutMfa === 0 ? "PASS" : mode === "production" ? "FAIL" : "WARN",
      managementWithoutMfa === 0 ? "Tất cả tài khoản quản lý đã thiết lập MFA" : `${managementWithoutMfa} tài khoản chưa thiết lập MFA`,
    );

    const [demoLedgerCount, liveLedgerIssues, staleBusinessEvents, maintenanceHeartbeat, activeUsers] = await Promise.all([
      prisma.ledgerEntry.count({ where: { dataOrigin: "DEMO" } }),
      prisma.ledgerEntry.count({
        where: {
          dataOrigin: "LIVE",
          OR: [
            { category: "SERVICE_REVENUE", bookingId: null, bookingGroupId: null, officeEventId: null, paymentTransactionId: null },
            { category: "TIP_PAYABLE", bookingId: null, officeEventId: null, paymentTransactionId: null },
            { category: "OPERATING_EXPENSE", expenseId: null, customerId: null, bookingId: null, bookingGroupId: null, officeEventId: null },
          ],
        },
      }),
      prisma.officeEvent.count({
        where: { status: "READY", totalAmount: 0, leadTherapistId: null, startsAt: { lt: new Date() } },
      }),
      prisma.systemSetting.findUnique({ where: { scopeKey: "GLOBAL:operations.maintenance_last_success_at" } }),
      prisma.user.findMany({
        where: {
          isActive: true,
          role: { in: ["OWNER", "MANAGER", "RECEPTIONIST", "INVESTOR", "XGROUP_SUPER_ADMIN", "DISTRICT_SALES_MANAGER"] },
        },
        select: { passwordHash: true, passwordChangedAt: true },
      }),
    ]);
    add(
      "Tài chính",
      "Không lẫn dữ liệu DEMO",
      mode === "production" ? (demoLedgerCount === 0 ? "PASS" : "FAIL") : "PASS",
      mode === "production" ? `${demoLedgerCount} bút toán DEMO còn trong CSDL` : `${demoLedgerCount} bút toán DEMO được cô lập và chỉ hiển thị ở UAT`,
    );
    add(
      "Tài chính",
      "Bút toán LIVE truy vết được",
      liveLedgerIssues === 0 ? "PASS" : "FAIL",
      liveLedgerIssues === 0 ? "Mọi bút toán LIVE đều có nguồn nghiệp vụ" : `${liveLedgerIssues} bút toán LIVE chưa gắn nguồn nghiệp vụ`,
    );
    add(
      "Tâm An Business",
      "Không còn hồ sơ mẫu quá hạn",
      staleBusinessEvents === 0 ? "PASS" : mode === "production" ? "FAIL" : "WARN",
      `${staleBusinessEvents} hồ sơ READY đã quá lịch, Bill 0đ và chưa có KTV trưởng`,
    );

    const businessSettings = await prisma.systemSetting.findMany({
      where: {
        scopeKey: {
          in: [
            "GLOBAL:business.trial_packages",
            "GLOBAL:business.package_tiers",
            "GLOBAL:business.transport",
            "GLOBAL:business.deposit_percent",
            "GLOBAL:business.onsite_program",
            "GLOBAL:business.accounting_branch_id",
          ],
        },
        isActive: true,
      },
    });
    const businessValue = (key: string) => businessSettings.find((item) => item.scopeKey === `GLOBAL:${key}`)?.value;
    let businessCatalogValid = businessSettings.length === 6;
    try {
      const onsiteProgram = JSON.parse(businessValue("business.onsite_program") ?? "null") as {
        durationOptionsMin?: number[];
        priceOptions?: number[];
        minimumTherapistsPerSession?: number;
        requiredAssets?: string[];
        returnVoucher?: { code?: string; amount?: number };
      } | null;
      businessCatalogValid = businessCatalogValid
        && Array.isArray(JSON.parse(businessValue("business.trial_packages") ?? "null"))
        && Array.isArray(JSON.parse(businessValue("business.package_tiers") ?? "null"))
        && Boolean(JSON.parse(businessValue("business.transport") ?? "null"))
        && Number(businessValue("business.deposit_percent")) >= 0
        && Number(businessValue("business.deposit_percent")) <= 100
        && onsiteProgram?.durationOptionsMin?.join(",") === "10,15,20,30"
        && onsiteProgram?.priceOptions?.join(",") === "0,29000,59000,89000,129000"
        && onsiteProgram?.minimumTherapistsPerSession === 5
        && Boolean(onsiteProgram?.requiredAssets?.length)
        && onsiteProgram?.returnVoucher?.code === "RETURN100"
        && onsiteProgram?.returnVoucher?.amount === 100000
        && Boolean(await prisma.branch.findUnique({ where: { id: businessValue("business.accounting_branch_id") ?? "" }, select: { id: true } }));
    } catch {
      businessCatalogValid = false;
    }
    add(
      "Tâm An Business",
      "Bảng giá và cơ sở hạch toán động",
      businessCatalogValid ? "PASS" : "FAIL",
      businessCatalogValid ? "Đủ 6 cấu hình hợp lệ trong CSDL" : "Thiếu hoặc sai cấu trúc bảng giá/onsite/cơ sở hạch toán",
    );

    const [expiredHolds, activeBookingAllocationIssues, activeBookingClockIssues, completedPaymentIssues, activeBusinessIssues, tipPayoutIssues] = await Promise.all([
      prisma.bookingGroup.count({ where: { status: "PENDING", holdExpiresAt: { lt: new Date() } } }),
      prisma.booking.count({ where: { status: { in: ["CONFIRMED", "IN_SERVICE"] }, OR: [{ therapistId: null }, { roomId: null }] } }),
      prisma.booking.count({ where: { status: "IN_SERVICE", checkedInAt: null } }),
      prisma.booking.count({ where: { status: "COMPLETED", paymentStatus: { not: "PAID" } } }),
      prisma.officeEvent.count({ where: { status: "IN_SERVICE", OR: [{ leadTherapistId: null }, { actualStartedAt: null }, { expectedEndAt: null }] } }),
      prisma.booking.count({ where: { status: "COMPLETED", tipAmount: { gt: 0 }, tipPayout: { is: null } } }),
    ]);
    add("Nghiệp vụ", "Không còn giữ chỗ quá hạn", expiredHolds === 0 ? "PASS" : "FAIL", `${expiredHolds} nhóm lịch quá hạn chưa được giải phóng`);
    add("Nghiệp vụ", "Lịch đã xác nhận có KTV và giường", activeBookingAllocationIssues === 0 ? "PASS" : "FAIL", `${activeBookingAllocationIssues} lịch đang hoạt động thiếu phân công`);
    add("Nghiệp vụ", "Ca đang phục vụ có giờ check-in", activeBookingClockIssues === 0 ? "PASS" : "FAIL", `${activeBookingClockIssues} ca đang phục vụ thiếu mốc bắt đầu`);
    add("Nghiệp vụ", "Ca hoàn tất đã thanh toán", completedPaymentIssues === 0 ? "PASS" : "FAIL", `${completedPaymentIssues} ca hoàn tất chưa ở trạng thái đã thanh toán`);
    add("Tâm An Business", "Ca đang phục vụ có KTV trưởng và đồng hồ", activeBusinessIssues === 0 ? "PASS" : "FAIL", `${activeBusinessIssues} ca Business đang chạy thiếu dữ liệu điều phối`);
    add("Tài chính", "Tip ngoài Bill có khoản phải trả KTV", tipPayoutIssues === 0 ? "PASS" : "FAIL", `${tipPayoutIssues} ca có Tip nhưng chưa tạo khoản chi trả KTV`);

    const maintenanceAt = maintenanceHeartbeat?.value ? new Date(maintenanceHeartbeat.value) : null;
    const maintenanceAgeMinutes = maintenanceAt && !Number.isNaN(maintenanceAt.getTime()) ? Math.round((Date.now() - maintenanceAt.getTime()) / 60_000) : null;
    const maintenanceHealthy = maintenanceAgeMinutes !== null && maintenanceAgeMinutes >= 0 && maintenanceAgeMinutes <= 12;
    add(
      "Vận hành",
      "Tác vụ nền mỗi 5 phút",
      maintenanceHealthy ? "PASS" : mode === "production" ? "FAIL" : "WARN",
      maintenanceAgeMinutes === null ? "Chưa có heartbeat" : `Lần chạy gần nhất cách ${maintenanceAgeMinutes} phút`,
    );

    const passwordGroups = new Map<string, number>();
    for (const user of activeUsers) if (user.passwordHash) passwordGroups.set(user.passwordHash, (passwordGroups.get(user.passwordHash) ?? 0) + 1);
    const largestSharedPasswordGroup = Math.max(0, ...passwordGroups.values());
    const mustChangePassword = activeUsers.filter((user) => !user.passwordChangedAt).length;
    add(
      "Bảo mật",
      "Mật khẩu nhân sự không dùng chung",
      largestSharedPasswordGroup <= 1 ? "PASS" : mode === "production" ? "FAIL" : "WARN",
      `Nhóm dùng chung lớn nhất: ${largestSharedPasswordGroup} tài khoản`,
    );
    add(
      "Bảo mật",
      "Nhân sự đã đổi mật khẩu lần đầu",
      mustChangePassword === 0 ? "PASS" : mode === "production" ? "FAIL" : "WARN",
      `${mustChangePassword} tài khoản còn phải đổi mật khẩu`,
    );
  } catch (error) {
    add("CSDL", "Kiểm kê dữ liệu", "FAIL", error instanceof Error ? error.message : "Lỗi không xác định");
  }
}

function printReport() {
  const icons: Record<Status, string> = { PASS: "✓", WARN: "!", FAIL: "×" };
  console.log(`\nTâm An Center · kiểm tra sẵn sàng ${mode.toUpperCase()}\n`);
  let currentGroup = "";
  for (const check of checks) {
    if (check.group !== currentGroup) {
      currentGroup = check.group;
      console.log(`[${currentGroup}]`);
    }
    console.log(` ${icons[check.status]} ${check.name}: ${check.detail}`);
  }
  const totals = {
    pass: checks.filter((check) => check.status === "PASS").length,
    warn: checks.filter((check) => check.status === "WARN").length,
    fail: checks.filter((check) => check.status === "FAIL").length,
  };
  console.log(`\nKết quả: ${totals.pass} đạt · ${totals.warn} cảnh báo · ${totals.fail} chưa đạt.`);
  if (totals.fail > 0) process.exitCode = 1;
}

Promise.all([databaseChecks(), otpProviderCheck()])
  .finally(async () => prisma?.$disconnect())
  .then(printReport)
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
