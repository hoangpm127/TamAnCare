CREATE TABLE "GuestSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GuestSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BookingAccessGrant" (
    "id" TEXT NOT NULL,
    "guestSessionId" TEXT NOT NULL,
    "bookingGroupId" TEXT,
    "bookingId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BookingAccessGrant_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BookingAccessGrant_exactly_one_target" CHECK (("bookingGroupId" IS NOT NULL) <> ("bookingId" IS NOT NULL))
);

CREATE UNIQUE INDEX "GuestSession_tokenHash_key" ON "GuestSession"("tokenHash");
CREATE INDEX "GuestSession_expiresAt_idx" ON "GuestSession"("expiresAt");
CREATE UNIQUE INDEX "BookingAccessGrant_guestSessionId_bookingGroupId_key" ON "BookingAccessGrant"("guestSessionId", "bookingGroupId");
CREATE UNIQUE INDEX "BookingAccessGrant_guestSessionId_bookingId_key" ON "BookingAccessGrant"("guestSessionId", "bookingId");
CREATE INDEX "BookingAccessGrant_bookingGroupId_expiresAt_idx" ON "BookingAccessGrant"("bookingGroupId", "expiresAt");
CREATE INDEX "BookingAccessGrant_bookingId_expiresAt_idx" ON "BookingAccessGrant"("bookingId", "expiresAt");

ALTER TABLE "BookingAccessGrant" ADD CONSTRAINT "BookingAccessGrant_guestSessionId_fkey" FOREIGN KEY ("guestSessionId") REFERENCES "GuestSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingAccessGrant" ADD CONSTRAINT "BookingAccessGrant_bookingGroupId_fkey" FOREIGN KEY ("bookingGroupId") REFERENCES "BookingGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingAccessGrant" ADD CONSTRAINT "BookingAccessGrant_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
