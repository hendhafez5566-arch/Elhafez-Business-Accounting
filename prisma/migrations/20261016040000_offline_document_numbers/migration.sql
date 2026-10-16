CREATE TABLE "dn_number_allocations" (
 "company_id" TEXT NOT NULL,
 "request_id" TEXT NOT NULL,
 "request_hash" TEXT NOT NULL,
 "allocation" JSONB NOT NULL,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY ("company_id","request_id")
);
