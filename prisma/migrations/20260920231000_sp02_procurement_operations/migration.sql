-- SP-02 Procurement Operations & Fulfillment
-- Add branch ownership and commercial document fields to the canonical Procurement Finance PO.
-- Historical branch values are recovered only from accepted AC-14 provenance. No synthetic branch is permitted.

ALTER TABLE "proc_purchase_orders" ADD COLUMN "branch_id" TEXT;
ALTER TABLE "proc_purchase_orders" ADD COLUMN "order_date" DATE;
ALTER TABLE "proc_purchase_orders" ADD COLUMN "expected_date" DATE;
ALTER TABLE "proc_purchase_orders" ADD COLUMN "currency" TEXT;
ALTER TABLE "proc_purchase_orders" ADD COLUMN "external_reference" TEXT;
ALTER TABLE "proc_purchase_orders" ADD COLUMN "notes" TEXT;

ALTER TABLE "proc_purchase_order_lines" ADD COLUMN "description" TEXT;
ALTER TABLE "proc_purchase_order_lines" ADD COLUMN "unit_price" DECIMAL(38,18);
ALTER TABLE "proc_purchase_order_lines" ADD COLUMN "tax_code" TEXT;

ALTER TABLE "proc_po_history" ADD COLUMN "previous_received_quantity" DECIMAL(38,18);
ALTER TABLE "proc_po_history" ADD COLUMN "resulting_received_quantity" DECIMAL(38,18);

UPDATE "proc_purchase_orders" AS po
SET "branch_id" = provenance."branch_id"
FROM "proc_historical_imports" AS provenance
WHERE provenance."collection" = 'purchaseOrders'
  AND provenance."company_id" = po."company_id"
  AND provenance."source_id" = po."id"
  AND provenance."branch_id" IS NOT NULL
  AND po."branch_id" IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "proc_purchase_orders" WHERE "branch_id" IS NULL) THEN
    RAISE EXCEPTION 'SP-02 migration blocked: existing purchase order lacks authoritative branch provenance';
  END IF;
END $$;

ALTER TABLE "proc_purchase_orders" ALTER COLUMN "branch_id" SET NOT NULL;

CREATE INDEX "proc_purchase_orders_company_id_branch_id_status_idx"
  ON "proc_purchase_orders"("company_id","branch_id","status");

ALTER TABLE "proc_purchase_orders" DROP CONSTRAINT IF EXISTS "proc_po_number_key";
DROP INDEX IF EXISTS "proc_purchase_orders_company_id_number_key";
CREATE UNIQUE INDEX "proc_purchase_orders_company_id_branch_id_number_key"
  ON "proc_purchase_orders"("company_id","branch_id","number");

CREATE TABLE "proc_po_number_counters" (
  "company_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "next_value" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "proc_po_number_counters_pkey" PRIMARY KEY ("company_id","branch_id","year")
);

INSERT INTO "proc_po_number_counters" ("company_id","branch_id","year","next_value")
SELECT
  "company_id",
  "branch_id",
  split_part("number", '-', 2)::INTEGER AS "year",
  MAX(split_part("number", '-', 3)::INTEGER) AS "next_value"
FROM "proc_purchase_orders"
WHERE "number" ~ '^PO-[0-9]{4}-[0-9]{6}

CREATE TABLE "pf_fulfillment_records" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "purchase_order_id" TEXT NOT NULL,
  "line_id" TEXT NOT NULL,
  "supplier_id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "requested_quantity" DECIMAL(38,18) NOT NULL,
  "previous_received_quantity" DECIMAL(38,18),
  "resulting_received_quantity" DECIMAL(38,18),
  "correction_of_id" TEXT,
  "reason" TEXT,
  "note" TEXT,
  "attachment_ids" JSONB NOT NULL,
  "actor_id" TEXT NOT NULL,
  "request_hash" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL,
  "applied_at" TIMESTAMP(3),
  CONSTRAINT "pf_fulfillment_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pf_fulfillment_records_company_id_id_key"
  ON "pf_fulfillment_records"("company_id","id");
CREATE INDEX "pf_fulfillment_records_company_id_branch_id_purchase_order_id_created_at_idx"
  ON "pf_fulfillment_records"("company_id","branch_id","purchase_order_id","created_at");
CREATE INDEX "pf_fulfillment_records_company_id_correction_of_id_idx"
  ON "pf_fulfillment_records"("company_id","correction_of_id");

GROUP BY "company_id","branch_id",split_part("number", '-', 2)::INTEGER
ON CONFLICT ("company_id","branch_id","year")
DO UPDATE SET "next_value" = GREATEST(
  "proc_po_number_counters"."next_value",
  EXCLUDED."next_value"
);


CREATE TABLE "pf_fulfillment_records" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "purchase_order_id" TEXT NOT NULL,
  "line_id" TEXT NOT NULL,
  "supplier_id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "requested_quantity" DECIMAL(38,18) NOT NULL,
  "previous_received_quantity" DECIMAL(38,18),
  "resulting_received_quantity" DECIMAL(38,18),
  "correction_of_id" TEXT,
  "reason" TEXT,
  "note" TEXT,
  "attachment_ids" JSONB NOT NULL,
  "actor_id" TEXT NOT NULL,
  "request_hash" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL,
  "applied_at" TIMESTAMP(3),
  CONSTRAINT "pf_fulfillment_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pf_fulfillment_records_company_id_id_key"
  ON "pf_fulfillment_records"("company_id","id");
CREATE INDEX "pf_fulfillment_records_company_id_branch_id_purchase_order_id_created_at_idx"
  ON "pf_fulfillment_records"("company_id","branch_id","purchase_order_id","created_at");
CREATE INDEX "pf_fulfillment_records_company_id_correction_of_id_idx"
  ON "pf_fulfillment_records"("company_id","correction_of_id");
