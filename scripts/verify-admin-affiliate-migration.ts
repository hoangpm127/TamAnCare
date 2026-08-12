import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const database = new PGlite();
await database.exec(`
  CREATE TABLE "Customer" ("id" TEXT PRIMARY KEY);
  CREATE TABLE "Branch" ("id" TEXT PRIMARY KEY);
  CREATE TABLE "User" ("id" TEXT PRIMARY KEY);
  CREATE TABLE "LedgerEntry" (
    "id" TEXT PRIMARY KEY,
    "branchId" TEXT NOT NULL,
    "customerId" TEXT,
    "category" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL
  );
  INSERT INTO "Customer" ("id") VALUES ('affiliate-1');
  INSERT INTO "Branch" ("id") VALUES ('branch-1');
  INSERT INTO "User" ("id") VALUES ('owner-1');
  INSERT INTO "LedgerEntry" ("id", "branchId", "customerId", "category", "direction", "description", "occurredAt")
  VALUES
    ('commission-1', 'branch-1', 'affiliate-1', 'OPERATING_EXPENSE', 'OUT', 'Hoa hồng Affiliate · TEST · HD-001', '2026-08-01T00:00:00Z'),
    ('expense-1', 'branch-1', 'affiliate-1', 'OPERATING_EXPENSE', 'OUT', 'Chi phí marketing khác', '2026-08-01T00:00:00Z');
`);

const migration = readFileSync(new URL("../prisma/migrations/20260812163000_admin_affiliate_reconciliation/migration.sql", import.meta.url), "utf8");
await database.exec(migration);
const payout = await database.query<{ commissionLedgerEntryId: string; status: string; dueAt: Date }>(
  `SELECT "commissionLedgerEntryId", "status", "dueAt" FROM "AffiliatePayout"`,
);
assert.equal(payout.rows.length, 1, "Migration chỉ được đưa bút toán hoa hồng vào sổ đối soát.");
assert.equal(payout.rows[0].commissionLedgerEntryId, "commission-1");
assert.equal(payout.rows[0].status, "PENDING");
assert.equal(new Date(payout.rows[0].dueAt).toISOString().slice(0, 10), "2026-08-16");
await database.close();

console.log("Admin Affiliate migration verified on an isolated PostgreSQL-compatible database.");
