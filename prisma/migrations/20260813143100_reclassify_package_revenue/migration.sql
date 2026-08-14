UPDATE "LedgerEntry" AS ledger
SET "category" = 'PACKAGE_REVENUE'
FROM "PaymentTransaction" AS payment
JOIN "CustomerPackage" AS customer_package
  ON customer_package."paymentTransactionId" = payment."id"
WHERE ledger."paymentTransactionId" = payment."id"
  AND ledger."category" = 'SERVICE_REVENUE';
