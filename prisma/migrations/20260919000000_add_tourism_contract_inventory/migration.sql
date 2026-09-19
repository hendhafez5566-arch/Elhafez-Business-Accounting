-- CreateTable
CREATE TABLE "tci_contracts" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "supplier_id" TEXT,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source_reference" JSONB,

    CONSTRAINT "tci_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tci_contract_versions" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "terms" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_current" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "tci_contract_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tci_hotel_inventory" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "hotel_id" TEXT NOT NULL,
    "room_id" TEXT,
    "service_date" TIMESTAMP(3) NOT NULL,
    "contracted_quantity" DECIMAL(38,18) NOT NULL,
    "allocated_quantity" DECIMAL(38,18) NOT NULL,
    "available_quantity" DECIMAL(38,18) NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "tci_hotel_inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tci_flight_blocks" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "flight_number" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "departure_date" TIMESTAMP(3) NOT NULL,
    "total_seats" DECIMAL(38,18) NOT NULL,
    "consumed_seats" DECIMAL(38,18) NOT NULL,
    "available_seats" DECIMAL(38,18) NOT NULL,

    CONSTRAINT "tci_flight_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tci_flight_block_consumption" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "flight_block_id" TEXT NOT NULL,
    "program" JSONB NOT NULL,
    "consumed_seats" DECIMAL(38,18) NOT NULL,
    "consumed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source_reference" JSONB,

    CONSTRAINT "tci_flight_block_consumption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tci_transport_capacity" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "capacity_units" DECIMAL(38,18) NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "consumed_units" DECIMAL(38,18) NOT NULL,

    CONSTRAINT "tci_transport_capacity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tci_visa_quotas" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "visa_type" TEXT NOT NULL,
    "nationality" TEXT,
    "quota_total" DECIMAL(38,18) NOT NULL,
    "quota_consumed" DECIMAL(38,18) NOT NULL,
    "quota_remaining" DECIMAL(38,18) NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tci_visa_quotas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tci_stop_sales" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tci_stop_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tci_allocations" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "contract_version_id" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "program" JSONB NOT NULL,
    "service_date" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3),
    "quantity" DECIMAL(38,18) NOT NULL,
    "status" TEXT NOT NULL,
    "release_blocker_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source_reference" JSONB,

    CONSTRAINT "tci_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tci_allocation_releases" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "allocation_id" TEXT NOT NULL,
    "released_quantity" DECIMAL(38,18) NOT NULL,
    "blocker_evidence" TEXT,
    "released_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,

    CONSTRAINT "tci_allocation_releases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tci_procurement_requests" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "program" JSONB NOT NULL,
    "residual_quantity" DECIMAL(38,18) NOT NULL,
    "procurement_type" TEXT NOT NULL,
    "external_reference" TEXT,
    "reference_data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source_reference" JSONB,

    CONSTRAINT "tci_procurement_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tci_idempotency_keys" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tci_idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tci_contract_history" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "aggregate_id" TEXT NOT NULL,
    "evidence" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tci_contract_history_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "tci_contracts_company_id_status_idx" ON "tci_contracts"("company_id", "status");

-- CreateIndex
CREATE INDEX "tci_contracts_company_id_type_idx" ON "tci_contracts"("company_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "tci_contracts_company_id_id_key" ON "tci_contracts"("company_id", "id");

-- CreateIndex
CREATE INDEX "tci_contract_versions_company_id_contract_id_is_current_idx" ON "tci_contract_versions"("company_id", "contract_id", "is_current");

-- CreateIndex
CREATE UNIQUE INDEX "tci_contract_versions_company_id_id_key" ON "tci_contract_versions"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "tci_contract_versions_company_id_contract_id_version_number_key" ON "tci_contract_versions"("company_id", "contract_id", "version_number");

-- CreateIndex
CREATE INDEX "tci_hotel_inventory_company_id_contract_id_status_idx" ON "tci_hotel_inventory"("company_id", "contract_id", "status");

-- CreateIndex
CREATE INDEX "tci_hotel_inventory_company_id_service_date_status_idx" ON "tci_hotel_inventory"("company_id", "service_date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "tci_hotel_inventory_company_id_id_key" ON "tci_hotel_inventory"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "tci_hotel_inventory_company_id_contract_id_hotel_id_service_key" ON "tci_hotel_inventory"("company_id", "contract_id", "hotel_id", "service_date");

-- CreateIndex
CREATE INDEX "tci_flight_blocks_company_id_contract_id_idx" ON "tci_flight_blocks"("company_id", "contract_id");

-- CreateIndex
CREATE INDEX "tci_flight_blocks_company_id_flight_number_departure_date_idx" ON "tci_flight_blocks"("company_id", "flight_number", "departure_date");

-- CreateIndex
CREATE UNIQUE INDEX "tci_flight_blocks_company_id_id_key" ON "tci_flight_blocks"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "tci_flight_blocks_company_id_contract_id_flight_number_depa_key" ON "tci_flight_blocks"("company_id", "contract_id", "flight_number", "departure_date");

-- CreateIndex
CREATE INDEX "tci_flight_block_consumption_company_id_flight_block_id_idx" ON "tci_flight_block_consumption"("company_id", "flight_block_id");

-- CreateIndex
CREATE UNIQUE INDEX "tci_flight_block_consumption_company_id_id_key" ON "tci_flight_block_consumption"("company_id", "id");

-- CreateIndex
CREATE INDEX "tci_transport_capacity_company_id_period_start_period_end_idx" ON "tci_transport_capacity"("company_id", "period_start", "period_end");

-- CreateIndex
CREATE UNIQUE INDEX "tci_transport_capacity_company_id_id_key" ON "tci_transport_capacity"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "tci_transport_capacity_company_id_contract_id_vehicle_id_pe_key" ON "tci_transport_capacity"("company_id", "contract_id", "vehicle_id", "period_start", "period_end");

-- CreateIndex
CREATE UNIQUE INDEX "tci_visa_quotas_company_id_id_key" ON "tci_visa_quotas"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "tci_visa_quotas_company_id_contract_id_visa_type_nationalit_key" ON "tci_visa_quotas"("company_id", "contract_id", "visa_type", "nationality", "effective_from", "effective_to");

-- CreateIndex
CREATE INDEX "tci_stop_sales_company_id_contract_id_is_active_idx" ON "tci_stop_sales"("company_id", "contract_id", "is_active");

-- CreateIndex
CREATE INDEX "tci_stop_sales_company_id_effective_from_effective_to_idx" ON "tci_stop_sales"("company_id", "effective_from", "effective_to");

-- CreateIndex
CREATE UNIQUE INDEX "tci_stop_sales_company_id_id_key" ON "tci_stop_sales"("company_id", "id");

-- CreateIndex
CREATE INDEX "tci_allocations_company_id_resource_type_resource_id_servic_idx" ON "tci_allocations"("company_id", "resource_type", "resource_id", "service_date", "period_end", "status");

-- CreateIndex
CREATE INDEX "tci_allocations_company_id_contract_id_status_idx" ON "tci_allocations"("company_id", "contract_id", "status");

-- CreateIndex
CREATE INDEX "tci_allocations_company_id_program_status_idx" ON "tci_allocations"("company_id", "program", "status");

-- CreateIndex
CREATE UNIQUE INDEX "tci_allocations_company_id_id_key" ON "tci_allocations"("company_id", "id");

-- CreateIndex
CREATE INDEX "tci_allocation_releases_company_id_allocation_id_idx" ON "tci_allocation_releases"("company_id", "allocation_id");

-- CreateIndex
CREATE UNIQUE INDEX "tci_allocation_releases_company_id_id_key" ON "tci_allocation_releases"("company_id", "id");

-- CreateIndex
CREATE INDEX "tci_procurement_requests_company_id_program_created_at_idx" ON "tci_procurement_requests"("company_id", "program", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "tci_procurement_requests_company_id_id_key" ON "tci_procurement_requests"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "tci_idempotency_keys_company_id_id_key" ON "tci_idempotency_keys"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "tci_idempotency_keys_company_id_key_key" ON "tci_idempotency_keys"("company_id", "key");

-- CreateIndex
CREATE INDEX "tci_contract_history_company_id_contract_id_created_at_idx" ON "tci_contract_history"("company_id", "contract_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "tci_contract_history_company_id_id_key" ON "tci_contract_history"("company_id", "id");

-- AddForeignKey
ALTER TABLE "tci_contract_versions" ADD CONSTRAINT "tci_contract_versions_company_id_contract_id_fkey" FOREIGN KEY ("company_id", "contract_id") REFERENCES "tci_contracts"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tci_hotel_inventory" ADD CONSTRAINT "tci_hotel_inventory_company_id_contract_id_fkey" FOREIGN KEY ("company_id", "contract_id") REFERENCES "tci_contracts"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tci_flight_blocks" ADD CONSTRAINT "tci_flight_blocks_company_id_contract_id_fkey" FOREIGN KEY ("company_id", "contract_id") REFERENCES "tci_contracts"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tci_flight_block_consumption" ADD CONSTRAINT "tci_flight_block_consumption_company_id_flight_block_id_fkey" FOREIGN KEY ("company_id", "flight_block_id") REFERENCES "tci_flight_blocks"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tci_transport_capacity" ADD CONSTRAINT "tci_transport_capacity_company_id_contract_id_fkey" FOREIGN KEY ("company_id", "contract_id") REFERENCES "tci_contracts"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tci_visa_quotas" ADD CONSTRAINT "tci_visa_quotas_company_id_contract_id_fkey" FOREIGN KEY ("company_id", "contract_id") REFERENCES "tci_contracts"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tci_stop_sales" ADD CONSTRAINT "tci_stop_sales_company_id_contract_id_fkey" FOREIGN KEY ("company_id", "contract_id") REFERENCES "tci_contracts"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tci_allocations" ADD CONSTRAINT "tci_allocations_company_id_contract_id_fkey" FOREIGN KEY ("company_id", "contract_id") REFERENCES "tci_contracts"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tci_allocations" ADD CONSTRAINT "tci_allocations_company_id_contract_version_id_fkey" FOREIGN KEY ("company_id", "contract_version_id") REFERENCES "tci_contract_versions"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tci_allocation_releases" ADD CONSTRAINT "tci_allocation_releases_company_id_allocation_id_fkey" FOREIGN KEY ("company_id", "allocation_id") REFERENCES "tci_allocations"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tci_contract_history" ADD CONSTRAINT "tci_contract_history_company_id_contract_id_fkey" FOREIGN KEY ("company_id", "contract_id") REFERENCES "tci_contracts"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Domain invariants not expressible by Prisma's schema language.
ALTER TABLE "tci_hotel_inventory" ADD CONSTRAINT "tci_hotel_quantity_nonnegative" CHECK ("contracted_quantity" >= 0 AND "allocated_quantity" >= 0 AND "available_quantity" >= 0 AND "allocated_quantity" + "available_quantity" = "contracted_quantity");
ALTER TABLE "tci_flight_blocks" ADD CONSTRAINT "tci_flight_quantity_nonnegative" CHECK ("total_seats" >= 0 AND "consumed_seats" >= 0 AND "available_seats" >= 0 AND "consumed_seats" + "available_seats" = "total_seats");
ALTER TABLE "tci_transport_capacity" ADD CONSTRAINT "tci_transport_capacity_positive" CHECK ("capacity_units" > 0 AND "consumed_units" >= 0 AND "period_start" < "period_end");
ALTER TABLE "tci_visa_quotas" ADD CONSTRAINT "tci_visa_quantity_nonnegative" CHECK ("quota_total" >= 0 AND "quota_consumed" >= 0 AND "quota_remaining" >= 0 AND "quota_consumed" + "quota_remaining" = "quota_total");
ALTER TABLE "tci_allocations" ADD CONSTRAINT "tci_allocation_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "tci_allocation_releases" ADD CONSTRAINT "tci_release_quantity_nonnegative" CHECK ("released_quantity" >= 0);
CREATE UNIQUE INDEX "tci_one_current_contract_version" ON "tci_contract_versions" ("company_id", "contract_id") WHERE "is_current" = TRUE;
