CREATE TABLE "cuf_field_definitions" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "field_type" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "options" JSONB NOT NULL DEFAULT '[]',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cuf_field_definitions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cuf_field_definitions_company_id_id_key"
ON "cuf_field_definitions"("company_id", "id");
CREATE UNIQUE INDEX "cuf_field_definitions_company_id_entity_type_key_key"
ON "cuf_field_definitions"("company_id", "entity_type", "key");
CREATE INDEX "cuf_field_definitions_company_id_entity_type_active_idx"
ON "cuf_field_definitions"("company_id", "entity_type", "active");

CREATE TABLE "cuf_field_values" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "definition_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "value_json" JSONB NOT NULL,
    "updated_by" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cuf_field_values_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cuf_field_values_company_id_definition_id_entity_id_key"
ON "cuf_field_values"("company_id", "definition_id", "entity_id");
CREATE INDEX "cuf_field_values_company_id_entity_type_entity_id_idx"
ON "cuf_field_values"("company_id", "entity_type", "entity_id");
ALTER TABLE "cuf_field_values"
ADD CONSTRAINT "cuf_field_values_company_id_definition_id_fkey"
FOREIGN KEY ("company_id", "definition_id")
REFERENCES "cuf_field_definitions"("company_id", "id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "dn_numbering_policies" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "branch_scope" TEXT NOT NULL,
    "prefix_template" TEXT NOT NULL,
    "padding" INTEGER NOT NULL,
    "reset_period" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "dn_numbering_policies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "dn_numbering_policies_company_id_id_key"
ON "dn_numbering_policies"("company_id", "id");
CREATE UNIQUE INDEX "dn_numbering_policies_company_id_document_type_branch_scope_key"
ON "dn_numbering_policies"("company_id", "document_type", "branch_scope");
CREATE INDEX "dn_numbering_policies_company_id_document_type_active_idx"
ON "dn_numbering_policies"("company_id", "document_type", "active");

CREATE TABLE "dn_numbering_counters" (
    "company_id" TEXT NOT NULL,
    "policy_id" TEXT NOT NULL,
    "period_key" TEXT NOT NULL,
    "current_value" INTEGER NOT NULL,
    CONSTRAINT "dn_numbering_counters_pkey" PRIMARY KEY ("company_id", "policy_id", "period_key")
);

ALTER TABLE "dn_numbering_counters"
ADD CONSTRAINT "dn_numbering_counters_company_id_policy_id_fkey"
FOREIGN KEY ("company_id", "policy_id")
REFERENCES "dn_numbering_policies"("company_id", "id")
ON DELETE RESTRICT ON UPDATE CASCADE;
