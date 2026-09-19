import { Module, Global } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { TourismContractInventoryApplicationServiceImpl } from './application/tourism-contract-inventory.application-service.impl.js';
import {
  PrismaTourismContractRepository,
  PrismaContractVersionRepository,
  PrismaHotelInventoryRepository,
  PrismaFlightBlockRepository,
  PrismaFlightBlockConsumptionRepository,
  PrismaTransportCapacityRepository,
  PrismaVisaQuotaRepository,
  PrismaStopSaleRepository,
  PrismaAllocationRepository,
  PrismaAllocationReleaseRepository,
  PrismaProcurementRequestRepository,
  PrismaIdempotencyKeyRepository,
  PrismaContractHistoryRepository
} from './infrastructure/prisma-inventory.repository.js';

@Global()
@Module({
  providers: [
    PrismaClient,
    PrismaTourismContractRepository,
    PrismaContractVersionRepository,
    PrismaHotelInventoryRepository,
    PrismaFlightBlockRepository,
    PrismaFlightBlockConsumptionRepository,
    PrismaTransportCapacityRepository,
    PrismaVisaQuotaRepository,
    PrismaStopSaleRepository,
    PrismaAllocationRepository,
    PrismaAllocationReleaseRepository,
    PrismaProcurementRequestRepository,
    PrismaIdempotencyKeyRepository,
    PrismaContractHistoryRepository,
    {
      provide: 'TOURISM_CONTRACT_INVENTORY_SERVICE',
      useFactory: (
        prisma: PrismaClient,
        contractRepo: PrismaTourismContractRepository,
        versionRepo: PrismaContractVersionRepository,
        hotelRepo: PrismaHotelInventoryRepository,
        flightBlockRepo: PrismaFlightBlockRepository,
        flightBlockConsumptionRepo: PrismaFlightBlockConsumptionRepository,
        transportRepo: PrismaTransportCapacityRepository,
        visaRepo: PrismaVisaQuotaRepository,
        stopSaleRepo: PrismaStopSaleRepository,
        allocationRepo: PrismaAllocationRepository,
        allocationReleaseRepo: PrismaAllocationReleaseRepository,
        procurementRepo: PrismaProcurementRequestRepository,
        idempotencyRepo: PrismaIdempotencyKeyRepository,
        historyRepo: PrismaContractHistoryRepository
      ) => new TourismContractInventoryApplicationServiceImpl(
        prisma,
        contractRepo,
        versionRepo,
        hotelRepo,
        flightBlockRepo,
        flightBlockConsumptionRepo,
        transportRepo,
        visaRepo,
        stopSaleRepo,
        allocationRepo,
        allocationReleaseRepo,
        procurementRepo,
        idempotencyRepo,
        historyRepo
      ),
      inject: [
        PrismaClient,
        PrismaTourismContractRepository,
        PrismaContractVersionRepository,
        PrismaHotelInventoryRepository,
        PrismaFlightBlockRepository,
        PrismaFlightBlockConsumptionRepository,
        PrismaTransportCapacityRepository,
        PrismaVisaQuotaRepository,
        PrismaStopSaleRepository,
        PrismaAllocationRepository,
        PrismaAllocationReleaseRepository,
        PrismaProcurementRequestRepository,
        PrismaIdempotencyKeyRepository,
        PrismaContractHistoryRepository
      ]
    }
  ],
  exports: ['TOURISM_CONTRACT_INVENTORY_SERVICE']
})
export class TourismContractInventoryModule {}
