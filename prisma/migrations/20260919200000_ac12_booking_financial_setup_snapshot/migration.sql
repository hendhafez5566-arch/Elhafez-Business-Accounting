-- BLOCKER-5: Add financial setup snapshot to booking reference
-- Confirmed bookings preserve their financial configuration at confirmation time

ALTER TABLE "tfo_booking_references" ADD COLUMN "financial_setup" JSONB;

COMMENT ON COLUMN "tfo_booking_references"."financial_setup" IS 'Snapshotted financial configuration from confirmation time (BR-066)';
