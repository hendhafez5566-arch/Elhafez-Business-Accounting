CREATE TABLE "ps_number_counters" (
  "company_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "next_value" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "ps_number_counters_pkey" PRIMARY KEY ("company_id","branch_id","kind")
);

CREATE TABLE "ps_requisitions" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "requested_by" TEXT NOT NULL,
  "need_by_date" DATE,
  "currency" TEXT,
  "notes" TEXT,
  "approved_by" TEXT,
  "approved_at" TIMESTAMP(3),
  "approval_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ps_requisitions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ps_requisitions_company_id_branch_id_id_key" ON "ps_requisitions"("company_id","branch_id","id");
CREATE UNIQUE INDEX "ps_requisitions_company_id_branch_id_number_key" ON "ps_requisitions"("company_id","branch_id","number");
CREATE INDEX "ps_requisitions_company_id_branch_id_status_created_at_idx" ON "ps_requisitions"("company_id","branch_id","status","created_at");

CREATE TABLE "ps_requisition_lines" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "requisition_id" TEXT NOT NULL,
  "item_reference" TEXT NOT NULL,
  "description" TEXT,
  "quantity" DECIMAL(30,18) NOT NULL,
  "target_unit_price" DECIMAL(30,18),
  "required_date" DATE,
  CONSTRAINT "ps_requisition_lines_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ps_requisition_lines_company_id_branch_id_requisition_id_id_key" ON "ps_requisition_lines"("company_id","branch_id","requisition_id","id");
CREATE INDEX "ps_requisition_lines_company_id_branch_id_requisition_id_idx" ON "ps_requisition_lines"("company_id","branch_id","requisition_id");

CREATE TABLE "ps_rfqs" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "requisition_id" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "response_deadline" DATE NOT NULL,
  "notes" TEXT,
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sent_at" TIMESTAMP(3),
  "closed_at" TIMESTAMP(3),
  CONSTRAINT "ps_rfqs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ps_rfqs_company_id_branch_id_id_key" ON "ps_rfqs"("company_id","branch_id","id");
CREATE UNIQUE INDEX "ps_rfqs_company_id_branch_id_number_key" ON "ps_rfqs"("company_id","branch_id","number");
CREATE INDEX "ps_rfqs_company_id_branch_id_requisition_id_status_idx" ON "ps_rfqs"("company_id","branch_id","requisition_id","status");

CREATE TABLE "ps_rfq_suppliers" (
  "company_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "rfq_id" TEXT NOT NULL,
  "supplier_party_id" TEXT NOT NULL,
  CONSTRAINT "ps_rfq_suppliers_pkey" PRIMARY KEY ("company_id","branch_id","rfq_id","supplier_party_id")
);
CREATE INDEX "ps_rfq_suppliers_company_id_branch_id_supplier_party_id_idx" ON "ps_rfq_suppliers"("company_id","branch_id","supplier_party_id");

CREATE TABLE "ps_supplier_bids" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "rfq_id" TEXT NOT NULL,
  "supplier_party_id" TEXT NOT NULL,
  "currency" TEXT NOT NULL,
  "valid_until" DATE,
  "delivery_date" DATE,
  "terms" TEXT,
  "status" TEXT NOT NULL,
  "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ps_supplier_bids_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ps_supplier_bids_company_id_branch_id_id_key" ON "ps_supplier_bids"("company_id","branch_id","id");
CREATE INDEX "ps_supplier_bids_company_id_branch_id_rfq_id_status_idx" ON "ps_supplier_bids"("company_id","branch_id","rfq_id","status");
CREATE INDEX "ps_supplier_bids_company_id_branch_id_rfq_id_supplier_party_id_idx" ON "ps_supplier_bids"("company_id","branch_id","rfq_id","supplier_party_id");

CREATE TABLE "ps_supplier_bid_lines" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "bid_id" TEXT NOT NULL,
  "requisition_line_id" TEXT NOT NULL,
  "quantity" DECIMAL(30,18) NOT NULL,
  "unit_price" DECIMAL(30,18) NOT NULL,
  "tax_code" TEXT,
  CONSTRAINT "ps_supplier_bid_lines_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ps_supplier_bid_lines_company_id_branch_id_bid_id_id_key" ON "ps_supplier_bid_lines"("company_id","branch_id","bid_id","id");
CREATE INDEX "ps_supplier_bid_lines_company_id_branch_id_bid_id_idx" ON "ps_supplier_bid_lines"("company_id","branch_id","bid_id");

CREATE TABLE "ps_awards" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "requisition_id" TEXT NOT NULL,
  "rfq_id" TEXT NOT NULL,
  "bid_id" TEXT NOT NULL,
  "supplier_party_id" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "awarded_by" TEXT NOT NULL,
  "awarded_at" TIMESTAMP(3) NOT NULL,
  "purchase_order_id" TEXT,
  CONSTRAINT "ps_awards_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ps_awards_company_id_branch_id_id_key" ON "ps_awards"("company_id","branch_id","id");
CREATE UNIQUE INDEX "ps_awards_company_id_branch_id_rfq_id_key" ON "ps_awards"("company_id","branch_id","rfq_id");
CREATE INDEX "ps_awards_company_id_branch_id_requisition_id_idx" ON "ps_awards"("company_id","branch_id","requisition_id");

ALTER TABLE "ps_requisition_lines" ADD CONSTRAINT "ps_requisition_lines_company_id_branch_id_requisition_id_fkey" FOREIGN KEY ("company_id","branch_id","requisition_id") REFERENCES "ps_requisitions"("company_id","branch_id","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ps_rfqs" ADD CONSTRAINT "ps_rfqs_company_id_branch_id_requisition_id_fkey" FOREIGN KEY ("company_id","branch_id","requisition_id") REFERENCES "ps_requisitions"("company_id","branch_id","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ps_rfq_suppliers" ADD CONSTRAINT "ps_rfq_suppliers_company_id_branch_id_rfq_id_fkey" FOREIGN KEY ("company_id","branch_id","rfq_id") REFERENCES "ps_rfqs"("company_id","branch_id","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ps_supplier_bids" ADD CONSTRAINT "ps_supplier_bids_company_id_branch_id_rfq_id_fkey" FOREIGN KEY ("company_id","branch_id","rfq_id") REFERENCES "ps_rfqs"("company_id","branch_id","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ps_supplier_bid_lines" ADD CONSTRAINT "ps_supplier_bid_lines_company_id_branch_id_bid_id_fkey" FOREIGN KEY ("company_id","branch_id","bid_id") REFERENCES "ps_supplier_bids"("company_id","branch_id","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ps_awards" ADD CONSTRAINT "ps_awards_company_id_branch_id_requisition_id_fkey" FOREIGN KEY ("company_id","branch_id","requisition_id") REFERENCES "ps_requisitions"("company_id","branch_id","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ps_awards" ADD CONSTRAINT "ps_awards_company_id_branch_id_rfq_id_fkey" FOREIGN KEY ("company_id","branch_id","rfq_id") REFERENCES "ps_rfqs"("company_id","branch_id","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ps_awards" ADD CONSTRAINT "ps_awards_company_id_branch_id_bid_id_fkey" FOREIGN KEY ("company_id","branch_id","bid_id") REFERENCES "ps_supplier_bids"("company_id","branch_id","id") ON DELETE RESTRICT ON UPDATE CASCADE;
