-- Publish the initial Tâm An Center offer catalog without touching bookings,
-- payments, customers, or other operational history.
INSERT INTO "Voucher" (
  "id", "code", "name", "description", "discountType", "discountValue",
  "minimumSpend", "maximumDiscount", "displayConstraint", "accentColor",
  "firstVisitOnly", "requiresAccount", "requiresVerifiedPhone",
  "minimumServiceDurationMin", "bookingStartMinuteMin", "bookingStartMinuteMax",
  "excludeWeekend", "validWithinDaysAfterLastVisit", "maxUsage", "maxPerCustomer",
  "startsAt", "endsAt", "isActive", "createdAt", "updatedAt"
)
VALUES
  (
    'voucher-tam-an-welcome100', 'WELCOME100', 'Thành viên mới nhận 100K',
    'Tặng 100.000đ cho lần đặt dịch vụ đầu tiên sau khi tạo tài khoản và xác minh số điện thoại.',
    'FIXED', 100000, 350000, NULL, 'Tài khoản mới · xác minh số điện thoại một lần', '#b4232b',
    false, true, true, NULL, NULL, NULL, false, NULL, 500, 1,
    NULL, CURRENT_TIMESTAMP + INTERVAL '365 days', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    'voucher-tam-an-first60', 'FIRST60', 'Ưu đãi khách mới 60 phút',
    'Giảm 50.000đ cho khách lần đầu đặt dịch vụ chăm sóc từ 60 phút qua link Affiliate hoặc nền tảng.',
    'FIXED', 50000, 350000, NULL, 'Khách mới · dịch vụ từ 60 phút', '#d13f1f',
    true, true, true, 60, NULL, NULL, false, NULL, 500, 1,
    NULL, CURRENT_TIMESTAMP + INTERVAL '365 days', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    'voucher-tam-an-sang70', 'SANG70', 'Thư giãn buổi sáng trước 12h',
    'Giảm 70.000đ cho lịch bắt đầu trước 12:00, phù hợp khi muốn chọn khung giờ yên tĩnh.',
    'FIXED', 70000, 390000, NULL, 'Lịch bắt đầu trước 12:00', '#b86b1f',
    false, true, true, NULL, NULL, 720, false, NULL, 300, 1,
    NULL, CURRENT_TIMESTAMP + INTERVAL '365 days', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    'voucher-tam-an-return7', 'RETURN7', 'Quay lại trong 7 ngày',
    'Giảm 10% khi đặt lịch trong 7 ngày kể từ lần ghé gần nhất, tối đa 50.000đ.',
    'PERCENT', 10, 350000, 50000, 'Trong 7 ngày sau lần ghé · trừ cuối tuần', '#8f241d',
    false, true, true, NULL, NULL, NULL, true, 7, 300, 1,
    NULL, CURRENT_TIMESTAMP + INTERVAL '365 days', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  )
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "discountType" = EXCLUDED."discountType",
  "discountValue" = EXCLUDED."discountValue",
  "minimumSpend" = EXCLUDED."minimumSpend",
  "maximumDiscount" = EXCLUDED."maximumDiscount",
  "displayConstraint" = EXCLUDED."displayConstraint",
  "accentColor" = EXCLUDED."accentColor",
  "firstVisitOnly" = EXCLUDED."firstVisitOnly",
  "requiresAccount" = EXCLUDED."requiresAccount",
  "requiresVerifiedPhone" = EXCLUDED."requiresVerifiedPhone",
  "minimumServiceDurationMin" = EXCLUDED."minimumServiceDurationMin",
  "bookingStartMinuteMin" = EXCLUDED."bookingStartMinuteMin",
  "bookingStartMinuteMax" = EXCLUDED."bookingStartMinuteMax",
  "excludeWeekend" = EXCLUDED."excludeWeekend",
  "validWithinDaysAfterLastVisit" = EXCLUDED."validWithinDaysAfterLastVisit",
  "maxUsage" = EXCLUDED."maxUsage",
  "maxPerCustomer" = EXCLUDED."maxPerCustomer",
  "startsAt" = EXCLUDED."startsAt",
  "endsAt" = EXCLUDED."endsAt",
  "isActive" = EXCLUDED."isActive",
  "updatedAt" = CURRENT_TIMESTAMP;

-- Long-term plans follow the proven Tuệ Tâm structure, but each plan is tied
-- to an official Tâm An service so a low-priced session cannot be redeemed
-- against a higher-priced treatment by mistake.
INSERT INTO "PackagePlan" (
  "id", "name", "serviceId", "sessions", "paidSessions", "bonusSessions",
  "validityDays", "price", "badge", "isHighlighted", "isActive",
  "shareable", "transferable", "createdAt", "updatedAt"
)
VALUES
  ('pkg-3', 'Khởi động Cổ Vai Gáy 3 buổi', 'svc-neck-60', 3, 3, 0, 45, 1110000, 'Tiết kiệm 60K', false, true, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('pkg-5', 'Chăm sóc Body 5 buổi', 'svc-body-60', 5, 5, 0, 75, 2050000, 'Tiết kiệm 200K', false, true, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('pkg-9', 'Dài hạn Cổ Vai Gáy 9+1', 'svc-neck-60', 10, 9, 1, 150, 3510000, 'Mua 9 tặng 1', true, true, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('pkg-19', 'Combo tập thể Body 19+3', 'svc-body-60', 22, 19, 3, 240, 8550000, '1 người mua · tập thể dùng', true, true, true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('pkg-29', 'Đồng hành Body 29+5', 'svc-body-60', 34, 29, 5, 365, 13050000, 'Mua 29 tặng 5', true, true, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('pkg-49', 'Bền vững Body 49+10', 'svc-body-60', 59, 49, 10, 540, 22050000, 'Mua 49 tặng 10', true, true, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "serviceId" = EXCLUDED."serviceId",
  "sessions" = EXCLUDED."sessions",
  "paidSessions" = EXCLUDED."paidSessions",
  "bonusSessions" = EXCLUDED."bonusSessions",
  "validityDays" = EXCLUDED."validityDays",
  "price" = EXCLUDED."price",
  "badge" = EXCLUDED."badge",
  "isHighlighted" = EXCLUDED."isHighlighted",
  "isActive" = EXCLUDED."isActive",
  "shareable" = EXCLUDED."shareable",
  "transferable" = EXCLUDED."transferable",
  "updatedAt" = CURRENT_TIMESTAMP;

-- Keep Business and package receipts on the real Tâm An accounting branch.
INSERT INTO "SystemSetting" (
  "id", "key", "scopeKey", "category", "label", "value", "valueType",
  "description", "branchId", "isActive", "createdAt", "updatedAt"
)
VALUES (
  'setting-tam-an-business-accounting-branch',
  'business.accounting_branch_id',
  'GLOBAL:business.accounting_branch_id',
  'BUSINESS',
  'Cơ sở hạch toán Tâm An Business',
  'tam-an-center-tay-ho',
  'TEXT',
  'Cơ sở nhận giao dịch cọc và thanh toán Business.',
  'tam-an-center-tay-ho',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("scopeKey") DO UPDATE SET
  "value" = EXCLUDED."value",
  "branchId" = EXCLUDED."branchId",
  "label" = EXCLUDED."label",
  "description" = EXCLUDED."description",
  "isActive" = true,
  "updatedAt" = CURRENT_TIMESTAMP;
