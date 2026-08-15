import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import {
  referralPathForLanguage,
  resolveReferralLanguage,
} from "../lib/referral-language";
import { absoluteAffiliateLink } from "../lib/affiliate-link";
import { translateCustomerText } from "../lib/customer-i18n";

assert.equal(referralPathForLanguage("ALICE50", "vi"), "/r/ALICE50");
assert.equal(referralPathForLanguage("ALICE50", "zh"), "/r/ALICE50?lang=zh");
assert.equal(referralPathForLanguage("ALICE50", "en"), "/r/ALICE50?lang=en");
assert.equal(referralPathForLanguage("ALICE50", "ko"), "/r/ALICE50?lang=ko");
assert.equal(absoluteAffiliateLink("/r/ALICE50"), "https://tamancenter.io.vn/r/ALICE50");
assert.equal(absoluteAffiliateLink("/r/ALICE50?lang=en"), "https://tamancenter.io.vn/r/ALICE50?lang=en");
assert.equal(absoluteAffiliateLink("/xg-ref/CEO-CG-001"), "https://tamancenter.io.vn/xg-ref/CEO-CG-001");

assert.equal(resolveReferralLanguage("zh", "vi"), "zh", "URL language must take priority.");
assert.equal(resolveReferralLanguage("invalid", "en"), "en", "Invalid URL language must fall back to the owner profile.");
assert.equal(resolveReferralLanguage(undefined, "zh"), "zh", "A legacy link must inherit the owner language.");
assert.equal(resolveReferralLanguage(undefined, "invalid"), "vi", "Vietnamese must remain the safe fallback.");
assert.equal(resolveReferralLanguage(["en", "zh"], "vi"), "en", "The first valid query value must win.");
assert.equal(translateCustomerText("Qua Safari", "zh"), "通过 Safari");
assert.equal(translateCustomerText("Qua Chrome", "en"), "Via Chrome");
assert.match(
  translateCustomerText("Mã PIN dùng để đăng nhập, sử dụng voucher, affiliate,... Nếu quý khách quên mã PIN, xin vui lòng đến quầy lễ tân để cấp lại mã PIN!", "zh"),
  /PIN码用于登录.+前台办理重置/,
);

const sharePage = readFileSync(new URL("../app/(customer)/ru-ban/page.tsx", import.meta.url), "utf8");
const landingPage = readFileSync(new URL("../app/(customer)/r/[code]/page.tsx", import.meta.url), "utf8");
const landingClient = readFileSync(new URL("../app/(customer)/r/[code]/referral-landing-client.tsx", import.meta.url), "utf8");
const provider = readFileSync(new URL("../components/customer-language-provider.tsx", import.meta.url), "utf8");
const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");

assert.ok(sharePage.includes("referralPathForLanguage(referral.code, language)"), "Share link and QR must use Alice's current language.");
assert.ok(sharePage.includes("absoluteAffiliateLink(referralPath)"), "Share link and QR must use the dedicated affiliate domain.");
assert.ok(landingPage.includes("resolveReferralLanguage(query.lang, owner?.preferredLanguage)"), "Landing must prioritize the query and fall back to Alice's profile.");
assert.ok(landingClient.includes("setLanguage(targetLanguage)"), "Bob's browser language must be initialized on landing.");
assert.ok(provider.includes('fetch("/api/customer-language"'), "Authenticated language changes must be persisted.");
assert.match(schema, /preferredLanguage\s+String\s+@default\("vi"\)/);

async function verifyMigration() {
  const database = new PGlite();

  try {
    await database.exec(`CREATE TABLE "CustomerAccount" ("id" TEXT PRIMARY KEY); INSERT INTO "CustomerAccount" ("id") VALUES ('alice');`);
    const migration = readFileSync(new URL("../prisma/migrations/20260812190000_customer_preferred_language/migration.sql", import.meta.url), "utf8");
    await database.exec(migration);
    const migrated = await database.query<{ preferredLanguage: string }>(`SELECT "preferredLanguage" FROM "CustomerAccount" WHERE "id" = 'alice'`);
    assert.equal(migrated.rows[0]?.preferredLanguage, "vi", "Existing customer accounts must receive the safe Vietnamese default.");
  } finally {
    await database.close();
  }

  console.log("Affiliate language inheritance verified: clean Vietnamese links, explicit locale priority, database fallback, and browser persistence.");
}

verifyMigration().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
