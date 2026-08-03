ALTER TABLE "Voucher"
  ADD COLUMN "minimumSpend" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "maximumDiscount" INTEGER,
  ADD COLUMN "displayConstraint" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "accentColor" TEXT NOT NULL DEFAULT '#9f1d20',
  ADD COLUMN "firstVisitOnly" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "requiresAccount" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "minimumServiceDurationMin" INTEGER,
  ADD COLUMN "bookingStartMinuteMin" INTEGER,
  ADD COLUMN "bookingStartMinuteMax" INTEGER,
  ADD COLUMN "excludeWeekend" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "validWithinDaysAfterLastVisit" INTEGER;

ALTER TABLE "PackagePlan"
  ADD COLUMN "paidSessions" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "bonusSessions" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "badge" TEXT,
  ADD COLUMN "isHighlighted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

UPDATE "PackagePlan" SET "paidSessions" = "sessions";
UPDATE "PackagePlan" SET "paidSessions" = 9, "bonusSessions" = 1, "badge" = 'Mua 9 tặng 1', "isHighlighted" = true WHERE "id" = 'pkg-9';
UPDATE "PackagePlan" SET "paidSessions" = 19, "bonusSessions" = 3, "badge" = '1 người mua · tập thể dùng', "isHighlighted" = true WHERE "id" = 'pkg-19';
UPDATE "PackagePlan" SET "paidSessions" = 29, "bonusSessions" = 5, "badge" = 'Mua 29 tặng 5', "isHighlighted" = true WHERE "id" = 'pkg-29';
UPDATE "PackagePlan" SET "paidSessions" = 49, "bonusSessions" = 10, "badge" = 'Mua 49 tặng 10', "isHighlighted" = true WHERE "id" = 'pkg-49';

UPDATE "Voucher" SET "requiresAccount" = true, "minimumSpend" = 200000, "displayConstraint" = 'Một lần cho mỗi tài khoản mới', "accentColor" = '#8f241d' WHERE "code" = 'WELCOME100';
UPDATE "Voucher" SET "firstVisitOnly" = true, "minimumSpend" = 200000, "minimumServiceDurationMin" = 60, "displayConstraint" = 'Khách mới · dịch vụ từ 60 phút', "accentColor" = '#9f1d20' WHERE "code" = 'FIRST60';
UPDATE "Voucher" SET "minimumSpend" = 200000, "bookingStartMinuteMax" = 720, "displayConstraint" = 'Lịch bắt đầu trước 12:00', "accentColor" = '#b9862c' WHERE "code" = 'SANG70';
UPDATE "Voucher" SET "minimumSpend" = 100000, "displayConstraint" = 'Trong thời hạn phát hành từ sự kiện Business', "accentColor" = '#7a3e1d' WHERE "code" = 'OFFICE20';
UPDATE "Voucher" SET "minimumSpend" = 150000, "maximumDiscount" = 50000, "excludeWeekend" = true, "validWithinDaysAfterLastVisit" = 7, "displayConstraint" = 'Trong 7 ngày sau lần ghé · trừ cuối tuần', "accentColor" = '#b4232b' WHERE "code" = 'RETURN7';
UPDATE "Voucher" SET "minimumSpend" = 200000, "bookingStartMinuteMin" = 660, "bookingStartMinuteMax" = 840, "displayConstraint" = '11:00–14:00 · giờ nghỉ trưa', "accentColor" = '#8a5a12' WHERE "code" = 'DUYTAN50';
