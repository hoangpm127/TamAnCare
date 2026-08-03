import { createHash, randomBytes } from "node:crypto";
import { db } from "../lib/db";
import { hashPassword } from "../lib/password";

const BASE_URL = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
const marker = `EVIDENCE${Date.now().toString(36).toUpperCase()}`;
const userIds: string[] = [];
const expenseIds: string[] = [];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function sessionHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function createSession(role: "OWNER" | "MANAGER", branchId: string | null) {
  const token = randomBytes(32).toString("base64url");
  const user = await db.user.create({
    data: {
      name: `${role} ${marker}`,
      email: `${role.toLowerCase()}-${marker.toLowerCase()}@example.test`,
      username: `${role.toLowerCase()}_${marker.toLowerCase()}`,
      passwordHash: hashPassword(`Expense!${marker}`),
      passwordChangedAt: new Date(),
      role,
      branchId,
    },
  });
  userIds.push(user.id);
  await db.adminSession.create({
    data: { userId: user.id, tokenHash: sessionHash(token), expiresAt: new Date(Date.now() + 60 * 60_000) },
  });
  return `tt_admin_session_v2=${token}`;
}

async function upload(cookie: string, branchId: string, bytes: Uint8Array, name: string, type: string) {
  const form = new FormData();
  form.append("branchId", branchId);
  const body = bytes.slice().buffer as ArrayBuffer;
  form.append("file", new Blob([body], { type }), name);
  const response = await fetch(`${BASE_URL}/api/expense-evidence`, {
    method: "POST",
    headers: { Cookie: cookie, Origin: BASE_URL },
    body: form,
  });
  const payload = await response.json().catch(() => ({})) as {
    error?: string;
    evidence?: {
      id: string;
      scanStatus: string;
      duplicateWarning: boolean;
      url: string;
    };
  };
  return { response, payload };
}

async function createExpense(cookie: string, input: Record<string, unknown>) {
  const response = await fetch(`${BASE_URL}/api/expenses`, {
    method: "POST",
    headers: { Cookie: cookie, Origin: BASE_URL, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = await response.json().catch(() => ({})) as {
    error?: string;
    code?: string;
    expenses?: Array<{ id: string; amount: number; branchId: string }>;
  };
  for (const expense of payload.expenses ?? []) expenseIds.push(expense.id);
  return { response, payload };
}

async function cleanup() {
  if (!userIds.length) return;
  const persistedExpenses = await db.expense.findMany({ where: { createdByUserId: { in: userIds } }, select: { id: true } });
  const allExpenseIds = [...new Set([...expenseIds, ...persistedExpenses.map((item) => item.id)])];
  await db.$transaction(async (tx) => {
    if (allExpenseIds.length) {
      await tx.ledgerEntry.deleteMany({ where: { expenseId: { in: allExpenseIds } } });
      await tx.expense.deleteMany({ where: { id: { in: allExpenseIds } } });
    }
    await tx.expenseEvidence.deleteMany({ where: { createdByUserId: { in: userIds } } });
    await tx.notification.deleteMany({ where: { body: { contains: marker } } });
    await tx.adminAuditLog.deleteMany({ where: { actorUserId: { in: userIds } } });
    await tx.adminSession.deleteMany({ where: { userId: { in: userIds } } });
    await tx.user.deleteMany({ where: { id: { in: userIds } } });
  });
}

async function main() {
  const branches = await db.branch.findMany({ orderBy: { id: "asc" }, take: 2 });
  assert(branches.length === 2, "Cần hai cơ sở để kiểm thử phân quyền chứng từ.");
  const ownerCookie = await createSession("OWNER", null);
  const otherManagerCookie = await createSession("MANAGER", branches[1].id);
  const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlLsAAAAASUVORK5CYII=", "base64"));

  const invalid = await upload(ownerCookie, branches[0].id, new TextEncoder().encode("<svg></svg>"), "fake.png", "image/png");
  assert(invalid.response.status === 415, `Tệp đổi đuôi phải bị chặn, nhận ${invalid.response.status}.`);

  const firstUpload = await upload(ownerCookie, branches[0].id, png, `${marker}.png`, "image/png");
  assert(firstUpload.response.status === 201 && firstUpload.payload.evidence, firstUpload.payload.error ?? "Không tải được chứng từ hợp lệ.");
  assert(firstUpload.payload.evidence.scanStatus === "AI_UNAVAILABLE", "CI không có khóa AI phải chuyển sang xác nhận thủ công, không dựng OCR giả.");
  assert(!firstUpload.payload.evidence.duplicateWarning, "Chứng từ đầu tiên không được báo trùng.");

  const denied = await fetch(`${BASE_URL}${firstUpload.payload.evidence.url}`, { headers: { Cookie: otherManagerCookie } });
  assert(denied.status === 403, `Quản lý cơ sở khác phải bị chặn, nhận ${denied.status}.`);
  const viewed = await fetch(`${BASE_URL}${firstUpload.payload.evidence.url}`, { headers: { Cookie: ownerCookie } });
  assert(viewed.status === 200 && viewed.headers.get("content-type") === "image/png", "Owner phải xem được đúng MIME của ảnh bill.");
  assert(Buffer.compare(Buffer.from(await viewed.arrayBuffer()), Buffer.from(png)) === 0, "Ảnh đọc lại phải trùng byte đã tải.");

  const expenseInput = {
    amount: 1_234_567,
    description: `Kiểm thử chứng từ ${marker}`,
    categoryLabel: "Vật tư tiêu hao",
    branchId: branches[0].id,
    occurredAt: new Date().toISOString(),
    evidenceId: firstUpload.payload.evidence.id,
  };
  const firstExpense = await createExpense(ownerCookie, expenseInput);
  assert(firstExpense.response.status === 201 && firstExpense.payload.expenses?.length === 1, firstExpense.payload.error ?? "Không ghi được khoản chi có chứng từ.");

  const reused = await createExpense(ownerCookie, expenseInput);
  assert(reused.response.status === 409, `Tái sử dụng cùng evidenceId phải bị chặn, nhận ${reused.response.status}.`);

  const duplicateUpload = await upload(ownerCookie, branches[0].id, png, `${marker}-duplicate.png`, "image/png");
  assert(duplicateUpload.response.status === 201 && duplicateUpload.payload.evidence?.duplicateWarning, "Ảnh cùng SHA-256 phải được cảnh báo trùng.");
  const duplicateInput = { ...expenseInput, evidenceId: duplicateUpload.payload.evidence.id };
  const duplicateRejected = await createExpense(ownerCookie, duplicateInput);
  assert(duplicateRejected.response.status === 409 && duplicateRejected.payload.code === "DUPLICATE_EVIDENCE_CONFIRMATION_REQUIRED", "Bill trùng phải cần xác nhận rõ ràng.");
  const duplicateConfirmed = await createExpense(ownerCookie, { ...duplicateInput, confirmDuplicateEvidence: true });
  assert(duplicateConfirmed.response.status === 201, duplicateConfirmed.payload.error ?? "Không ghi được bill trùng sau xác nhận chủ động.");

  console.log("✓ Ảnh bill thật: kiểm MIME, lưu/đọc byte, phân quyền cơ sở");
  console.log("✓ Hạch toán: chặn tái sử dụng và cảnh báo SHA-256 trùng bill");
  console.log("✓ Không có khóa AI: chuyển sang xác nhận thủ công, không tạo kết quả giả");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup();
    await db.$disconnect();
  });
