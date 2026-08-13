import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const permissions = source("lib/admin-auth.ts");
assert.ok(permissions.includes('const RECEPTIONIST_PERMISSIONS: AdminSectionSlug[] = ['), "Phải khai báo quyền riêng cho Lễ tân.");
assert.ok(permissions.includes('"customers",'), "Lễ tân phải được truy cập hồ sơ khách hàng.");

const route = source("app/api/customers/route.ts");
assert.ok(route.includes('["OWNER", "BRANCH_MANAGER", "RECEPTIONIST"].includes(session.role)'), "API phải cho phép đúng Admin, Quản lý và Lễ tân tạo khách.");
assert.ok(route.includes("createAccount: z.boolean().optional().default(false)"), "Tạo tài khoản phải là lựa chọn, không được ép khách vãng lai.");
assert.ok(route.includes("if (!value.acceptTerms)"), "Tài khoản hỗ trợ tại quầy phải có đồng ý điều khoản.");
assert.ok(route.includes("if (!value.acceptPrivacy)"), "Tài khoản hỗ trợ tại quầy phải có đồng ý bảo vệ dữ liệu.");
assert.ok(route.includes("customerAccount.findUnique"), "API phải kiểm tra tài khoản trùng theo số điện thoại.");
assert.ok(route.includes("createCustomerMembership(tx"), "Tài khoản tại quầy phải dùng chung nghiệp vụ thành viên chính thức.");
assert.ok(route.includes('action: input.createAccount ? "CRM_CUSTOMER_ACCOUNT_CREATED"'), "Phải lưu audit riêng khi nhân viên tạo tài khoản hộ khách.");
assert.ok(route.includes("hashPassword(input.pin"), "Không được lưu Mã PIN dạng rõ.");

const ui = source("components/admin-quick-actions.tsx");
assert.ok(ui.includes("Tạo tài khoản thành viên hộ khách"), "Form Lễ tân phải có lựa chọn tạo tài khoản hộ.");
assert.ok(ui.includes('createAccount ? "Tạo tài khoản thành viên" : "Tạo hồ sơ vãng lai"'), "CTA phải phân biệt rõ tài khoản và hồ sơ vãng lai.");
assert.ok(ui.includes('type="password"'), "Mã PIN phải được che trên giao diện.");
assert.ok(ui.includes("Hai lần nhập Mã PIN chưa trùng nhau."), "Form phải xác nhận Mã PIN hai lần.");
assert.ok(ui.includes("Không đọc to, ghi giấy hoặc lưu Mã PIN của khách."), "Giao diện phải hướng dẫn Lễ tân bảo vệ Mã PIN.");

console.log("✓ Lễ tân có thể tạo hồ sơ vãng lai hoặc tài khoản thành viên có PIN, consent, chống trùng và audit.");
