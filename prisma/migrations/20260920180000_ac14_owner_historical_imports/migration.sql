CREATE TABLE "cfx_historical_imports" (
  "id" TEXT NOT NULL, "run_id" TEXT NOT NULL, "collection" TEXT NOT NULL, "source_id" TEXT NOT NULL, "source_payload_hash" TEXT NOT NULL, "company_id" TEXT NOT NULL, "branch_id" TEXT, "payload" JSONB NOT NULL, "payload_json" TEXT NOT NULL, "debit" DECIMAL(38,18) NOT NULL, "credit" DECIMAL(38,18) NOT NULL, "amount" DECIMAL(38,18) NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cfx_historical_imports_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "cfx_historical_imports_run_id_collection_source_id_key" ON "cfx_historical_imports"("run_id", "collection", "source_id");
CREATE INDEX "cfx_historical_imports_run_id_company_id_idx" ON "cfx_historical_imports"("run_id", "company_id");

CREATE TABLE "cba_historical_imports" (
  "id" TEXT NOT NULL, "run_id" TEXT NOT NULL, "collection" TEXT NOT NULL, "source_id" TEXT NOT NULL, "source_payload_hash" TEXT NOT NULL, "company_id" TEXT NOT NULL, "branch_id" TEXT, "payload" JSONB NOT NULL, "payload_json" TEXT NOT NULL, "debit" DECIMAL(38,18) NOT NULL, "credit" DECIMAL(38,18) NOT NULL, "amount" DECIMAL(38,18) NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cba_historical_imports_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "cba_historical_imports_run_id_collection_source_id_key" ON "cba_historical_imports"("run_id", "collection", "source_id");
CREATE INDEX "cba_historical_imports_run_id_company_id_idx" ON "cba_historical_imports"("run_id", "company_id");

CREATE TABLE "period_historical_imports" (
  "id" TEXT NOT NULL, "run_id" TEXT NOT NULL, "collection" TEXT NOT NULL, "source_id" TEXT NOT NULL, "source_payload_hash" TEXT NOT NULL, "company_id" TEXT NOT NULL, "branch_id" TEXT, "payload" JSONB NOT NULL, "payload_json" TEXT NOT NULL, "debit" DECIMAL(38,18) NOT NULL, "credit" DECIMAL(38,18) NOT NULL, "amount" DECIMAL(38,18) NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "period_historical_imports_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "period_historical_imports_run_id_collection_source_id_key" ON "period_historical_imports"("run_id", "collection", "source_id");
CREATE INDEX "period_historical_imports_run_id_company_id_idx" ON "period_historical_imports"("run_id", "company_id");

CREATE TABLE "gl_historical_imports" (
  "id" TEXT NOT NULL, "run_id" TEXT NOT NULL, "collection" TEXT NOT NULL, "source_id" TEXT NOT NULL, "source_payload_hash" TEXT NOT NULL, "company_id" TEXT NOT NULL, "branch_id" TEXT, "payload" JSONB NOT NULL, "payload_json" TEXT NOT NULL, "debit" DECIMAL(38,18) NOT NULL, "credit" DECIMAL(38,18) NOT NULL, "amount" DECIMAL(38,18) NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "gl_historical_imports_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "gl_historical_imports_run_id_collection_source_id_key" ON "gl_historical_imports"("run_id", "collection", "source_id");
CREATE INDEX "gl_historical_imports_run_id_company_id_idx" ON "gl_historical_imports"("run_id", "company_id");

CREATE TABLE "tax_historical_imports" (
  "id" TEXT NOT NULL, "run_id" TEXT NOT NULL, "collection" TEXT NOT NULL, "source_id" TEXT NOT NULL, "source_payload_hash" TEXT NOT NULL, "company_id" TEXT NOT NULL, "branch_id" TEXT, "payload" JSONB NOT NULL, "payload_json" TEXT NOT NULL, "debit" DECIMAL(38,18) NOT NULL, "credit" DECIMAL(38,18) NOT NULL, "amount" DECIMAL(38,18) NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tax_historical_imports_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tax_historical_imports_run_id_collection_source_id_key" ON "tax_historical_imports"("run_id", "collection", "source_id");
CREATE INDEX "tax_historical_imports_run_id_company_id_idx" ON "tax_historical_imports"("run_id", "company_id");

CREATE TABLE "bill_historical_imports" (
  "id" TEXT NOT NULL, "run_id" TEXT NOT NULL, "collection" TEXT NOT NULL, "source_id" TEXT NOT NULL, "source_payload_hash" TEXT NOT NULL, "company_id" TEXT NOT NULL, "branch_id" TEXT, "payload" JSONB NOT NULL, "payload_json" TEXT NOT NULL, "debit" DECIMAL(38,18) NOT NULL, "credit" DECIMAL(38,18) NOT NULL, "amount" DECIMAL(38,18) NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bill_historical_imports_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "bill_historical_imports_run_id_collection_source_id_key" ON "bill_historical_imports"("run_id", "collection", "source_id");
CREATE INDEX "bill_historical_imports_run_id_company_id_idx" ON "bill_historical_imports"("run_id", "company_id");

CREATE TABLE "treasury_historical_imports" (
  "id" TEXT NOT NULL, "run_id" TEXT NOT NULL, "collection" TEXT NOT NULL, "source_id" TEXT NOT NULL, "source_payload_hash" TEXT NOT NULL, "company_id" TEXT NOT NULL, "branch_id" TEXT, "payload" JSONB NOT NULL, "payload_json" TEXT NOT NULL, "debit" DECIMAL(38,18) NOT NULL, "credit" DECIMAL(38,18) NOT NULL, "amount" DECIMAL(38,18) NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "treasury_historical_imports_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "treasury_historical_imports_run_id_collection_source_id_key" ON "treasury_historical_imports"("run_id", "collection", "source_id");
CREATE INDEX "treasury_historical_imports_run_id_company_id_idx" ON "treasury_historical_imports"("run_id", "company_id");

CREATE TABLE "party_historical_imports" (
  "id" TEXT NOT NULL, "run_id" TEXT NOT NULL, "collection" TEXT NOT NULL, "source_id" TEXT NOT NULL, "source_payload_hash" TEXT NOT NULL, "company_id" TEXT NOT NULL, "branch_id" TEXT, "payload" JSONB NOT NULL, "payload_json" TEXT NOT NULL, "debit" DECIMAL(38,18) NOT NULL, "credit" DECIMAL(38,18) NOT NULL, "amount" DECIMAL(38,18) NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "party_historical_imports_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "party_historical_imports_run_id_collection_source_id_key" ON "party_historical_imports"("run_id", "collection", "source_id");
CREATE INDEX "party_historical_imports_run_id_company_id_idx" ON "party_historical_imports"("run_id", "company_id");

CREATE TABLE "ecr_historical_imports" (
  "id" TEXT NOT NULL, "run_id" TEXT NOT NULL, "collection" TEXT NOT NULL, "source_id" TEXT NOT NULL, "source_payload_hash" TEXT NOT NULL, "company_id" TEXT NOT NULL, "branch_id" TEXT, "payload" JSONB NOT NULL, "payload_json" TEXT NOT NULL, "debit" DECIMAL(38,18) NOT NULL, "credit" DECIMAL(38,18) NOT NULL, "amount" DECIMAL(38,18) NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ecr_historical_imports_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ecr_historical_imports_run_id_collection_source_id_key" ON "ecr_historical_imports"("run_id", "collection", "source_id");
CREATE INDEX "ecr_historical_imports_run_id_company_id_idx" ON "ecr_historical_imports"("run_id", "company_id");

CREATE TABLE "af_historical_imports" (
  "id" TEXT NOT NULL, "run_id" TEXT NOT NULL, "collection" TEXT NOT NULL, "source_id" TEXT NOT NULL, "source_payload_hash" TEXT NOT NULL, "company_id" TEXT NOT NULL, "branch_id" TEXT, "payload" JSONB NOT NULL, "payload_json" TEXT NOT NULL, "debit" DECIMAL(38,18) NOT NULL, "credit" DECIMAL(38,18) NOT NULL, "amount" DECIMAL(38,18) NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "af_historical_imports_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "af_historical_imports_run_id_collection_source_id_key" ON "af_historical_imports"("run_id", "collection", "source_id");
CREATE INDEX "af_historical_imports_run_id_company_id_idx" ON "af_historical_imports"("run_id", "company_id");

CREATE TABLE "proc_historical_imports" (
  "id" TEXT NOT NULL, "run_id" TEXT NOT NULL, "collection" TEXT NOT NULL, "source_id" TEXT NOT NULL, "source_payload_hash" TEXT NOT NULL, "company_id" TEXT NOT NULL, "branch_id" TEXT, "payload" JSONB NOT NULL, "payload_json" TEXT NOT NULL, "debit" DECIMAL(38,18) NOT NULL, "credit" DECIMAL(38,18) NOT NULL, "amount" DECIMAL(38,18) NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "proc_historical_imports_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "proc_historical_imports_run_id_collection_source_id_key" ON "proc_historical_imports"("run_id", "collection", "source_id");
CREATE INDEX "proc_historical_imports_run_id_company_id_idx" ON "proc_historical_imports"("run_id", "company_id");

CREATE TABLE "fc_historical_imports" (
  "id" TEXT NOT NULL, "run_id" TEXT NOT NULL, "collection" TEXT NOT NULL, "source_id" TEXT NOT NULL, "source_payload_hash" TEXT NOT NULL, "company_id" TEXT NOT NULL, "branch_id" TEXT, "payload" JSONB NOT NULL, "payload_json" TEXT NOT NULL, "debit" DECIMAL(38,18) NOT NULL, "credit" DECIMAL(38,18) NOT NULL, "amount" DECIMAL(38,18) NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fc_historical_imports_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "fc_historical_imports_run_id_collection_source_id_key" ON "fc_historical_imports"("run_id", "collection", "source_id");
CREATE INDEX "fc_historical_imports_run_id_company_id_idx" ON "fc_historical_imports"("run_id", "company_id");

CREATE TABLE "tci_historical_imports" (
  "id" TEXT NOT NULL, "run_id" TEXT NOT NULL, "collection" TEXT NOT NULL, "source_id" TEXT NOT NULL, "source_payload_hash" TEXT NOT NULL, "company_id" TEXT NOT NULL, "branch_id" TEXT, "payload" JSONB NOT NULL, "payload_json" TEXT NOT NULL, "debit" DECIMAL(38,18) NOT NULL, "credit" DECIMAL(38,18) NOT NULL, "amount" DECIMAL(38,18) NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tci_historical_imports_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tci_historical_imports_run_id_collection_source_id_key" ON "tci_historical_imports"("run_id", "collection", "source_id");
CREATE INDEX "tci_historical_imports_run_id_company_id_idx" ON "tci_historical_imports"("run_id", "company_id");

CREATE TABLE "tfo_historical_imports" (
  "id" TEXT NOT NULL, "run_id" TEXT NOT NULL, "collection" TEXT NOT NULL, "source_id" TEXT NOT NULL, "source_payload_hash" TEXT NOT NULL, "company_id" TEXT NOT NULL, "branch_id" TEXT, "payload" JSONB NOT NULL, "payload_json" TEXT NOT NULL, "debit" DECIMAL(38,18) NOT NULL, "credit" DECIMAL(38,18) NOT NULL, "amount" DECIMAL(38,18) NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tfo_historical_imports_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tfo_historical_imports_run_id_collection_source_id_key" ON "tfo_historical_imports"("run_id", "collection", "source_id");
CREATE INDEX "tfo_historical_imports_run_id_company_id_idx" ON "tfo_historical_imports"("run_id", "company_id");
