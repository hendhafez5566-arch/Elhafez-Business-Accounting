import type { PrismaClient } from '@prisma/client';
import type { CompanyId } from '@elhafez/contracts';
import type {
  TourismContract, ContractVersion, HotelInventory, FlightBlock, FlightBlockConsumption,
  TransportCapacity, VisaQuota, StopSale, Allocation, AllocationRelease, ProcurementRequest
} from '../domain/inventory.js';
import type {
  CreateTourismContractInput, AmendContractInput, CreateHotelInventoryInput,
  CreateFlightBlockInput, CreateTransportCapacityInput, CreateVisaQuotaInput,
  CreateStopSaleInput, AllocateCapacityInput, ReleaseAllocationInput,
  AdjustAllocationInput, ConsumeFlightBlockInput, InternalFirstFulfillmentInput,
  CheckAvailabilityInput, AvailabilityResult, AllocationResult, ReleaseResult,
  IdempotencyCheckResult, TourismContractInventoryApplicationService
} from './inventory.application-service.js';
import type {
  TourismContractRepository, ContractVersionRepository, HotelInventoryRepository,
  FlightBlockRepository, FlightBlockConsumptionRepository, TransportCapacityRepository,
  VisaQuotaRepository, StopSaleRepository, AllocationRepository, AllocationReleaseRepository,
  ProcurementRequestRepository, IdempotencyKeyRepository, ContractHistoryRepository
} from './inventory.repository.js';
import { sha256Hash } from './idempotency-hash.js';

export class TourismContractInventoryApplicationServiceImpl implements TourismContractInventoryApplicationService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly contractRepo: TourismContractRepository,
    private readonly versionRepo: ContractVersionRepository,
    private readonly hotelRepo: HotelInventoryRepository,
    private readonly flightBlockRepo: FlightBlockRepository,
    private readonly flightBlockConsumptionRepo: FlightBlockConsumptionRepository,
    private readonly transportRepo: TransportCapacityRepository,
    private readonly visaRepo: VisaQuotaRepository,
    private readonly stopSaleRepo: StopSaleRepository,
    private readonly allocationRepo: AllocationRepository,
    private readonly allocationReleaseRepo: AllocationReleaseRepository,
    private readonly procurementRepo: ProcurementRequestRepository,
    private readonly idempotencyRepo: IdempotencyKeyRepository,
    private readonly historyRepo: ContractHistoryRepository
  ) {}

  async createContract(input: CreateTourismContractInput, idempotencyKey?: string): Promise<TourismContract> {
    if (idempotencyKey) {
      const hash = await sha256Hash(JSON.stringify(input));
      const existing = await this.idempotencyRepo.findByKey(input.companyId, idempotencyKey);
      if (existing) {
        if (existing.requestHash !== hash) {
          throw new Error(`Idempotency conflict: key '${idempotencyKey}' was used with different payload`);
        }
        return existing.result.contract as TourismContract;
      }
    }

    const contract: TourismContract = {
      id: randomUUID() as any,
      companyId: input.companyId,
      type: input.type,
      status: 'DRAFT',
      supplierId: input.supplierId,
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo,
      createdAt: new Date().toISOString(),
      sourceReference: input.sourceReference
    };

    await this.prisma.$transaction(async (tx) => {
      await (this.contractRepo as any).prisma.tciContract.create({
        data: {
          id: contract.id,
          companyId: contract.companyId,
          type: contract.type,
          status: contract.status,
          supplierId: contract.supplierId,
          effectiveFrom: new Date(contract.effectiveFrom),
          effectiveTo: new Date(contract.effectiveTo),
          sourceReference: contract.sourceReference ? JSON.stringify(contract.sourceReference) : null
        }
      });

      const initialVersion: ContractVersion = {
        id: randomUUID(),
        companyId: input.companyId,
        contractId: contract.id,
        versionNumber: 1,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo,
        terms: { type: input.type, supplierId: input.supplierId },
        createdAt: new Date().toISOString(),
        isCurrent: true
      };

      await (this.versionRepo as any).prisma.tciContractVersion.create({
        data: {
          id: initialVersion.id,
          companyId: initialVersion.companyId,
          contractId: initialVersion.contractId,
          versionNumber: initialVersion.versionNumber,
          effectiveFrom: new Date(initialVersion.effectiveFrom),
          effectiveTo: initialVersion.effectiveTo ? new Date(initialVersion.effectiveTo) : null,
          terms: JSON.stringify(initialVersion.terms),
          isCurrent: initialVersion.isCurrent
        }
      });

      await (this.historyRepo as any).prisma.tciContractHistory.create({
        data: {
          id: `${input.companyId}-${contract.id}-CREATE-${Date.now()}`,
          companyId: input.companyId,
          contractId: contract.id,
          kind: 'CONTRACT_CREATED',
          aggregateId: contract.id,
          sourceReference: input.sourceReference ? JSON.stringify(input.sourceReference) : undefined
        }
      });
    });

    if (idempotencyKey) {
      await this.idempotencyRepo.create(input.companyId, idempotencyKey, await sha256Hash(JSON.stringify(input)), { contract });
    }

    return contract;
  }

  async amendContract(input: AmendContractInput, idempotencyKey?: string): Promise<ContractVersion> {
    if (idempotencyKey) {
      const hash = await sha256Hash(JSON.stringify(input));
      const existing = await this.idempotencyRepo.findByKey(input.companyId, idempotencyKey);
      if (existing) {
        if (existing.requestHash !== hash) {
          throw new Error(`Idempotency conflict: key '${idempotencyKey}' was used with different payload`);
        }
        return existing.result.version as ContractVersion;
      }
    }

    const currentVersion = await this.versionRepo.findCurrent(input.companyId, input.contractId);
    if (!currentVersion) {
      throw new Error(`No current version found for contract ${input.contractId}`);
    }

    const newVersionNumber = currentVersion.versionNumber + 1;

    const newVersion: ContractVersion = {
      id: randomUUID(),
      companyId: input.companyId,
      contractId: input.contractId,
      versionNumber: newVersionNumber,
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo,
      terms: input.terms,
      createdAt: new Date().toISOString(),
      isCurrent: true
    };

    await this.prisma.$transaction(async (tx) => {
      await (this.versionRepo as any).prisma.tciContractVersion.updateMany({
        where: { companyId: input.companyId, contractId: input.contractId, isCurrent: true },
        data: { isCurrent: false }
      });

      await (this.versionRepo as any).prisma.tciContractVersion.create({
        data: {
          id: newVersion.id,
          companyId: newVersion.companyId,
          contractId: newVersion.contractId,
          versionNumber: newVersion.versionNumber,
          effectiveFrom: new Date(newVersion.effectiveFrom),
          effectiveTo: newVersion.effectiveTo ? new Date(newVersion.effectiveTo) : null,
          terms: JSON.stringify(newVersion.terms),
          isCurrent: newVersion.isCurrent
        }
      });

      await (this.contractRepo as any).prisma.tciContract.update({
        where: { id: input.contractId },
        data: { status: 'AMENDED' }
      });

      await (this.historyRepo as any).prisma.tciContractHistory.create({
        data: {
          id: `${input.companyId}-${input.contractId}-AMEND-${Date.now()}`,
          companyId: input.companyId,
          contractId: input.contractId,
          kind: 'CONTRACT_AMENDED',
          aggregateId: newVersion.id,
          sourceReference: input.sourceReference ? JSON.stringify(input.sourceReference) : undefined
        }
      });
    });

    if (idempotencyKey) {
      await this.idempotencyRepo.create(input.companyId, idempotencyKey, await sha256Hash(JSON.stringify(input)), { version: newVersion });
    }

    return newVersion;
  }

  async getContract(companyId: CompanyId, contractId: string): Promise<TourismContract | null> {
    return this.contractRepo.findById(companyId, contractId);
  }

  async getContractVersions(companyId: CompanyId, contractId: string): Promise<ContractVersion[]> {
    return this.versionRepo.findByContractId(companyId, contractId);
  }

  async createHotelInventory(input: CreateHotelInventoryInput, idempotencyKey?: string): Promise<HotelInventory> {
    if (idempotencyKey) {
      const hash = await sha256Hash(JSON.stringify(input));
      const existing = await this.idempotencyRepo.findByKey(input.companyId, idempotencyKey);
      if (existing) {
        if (existing.requestHash !== hash) {
          throw new Error(`Idempotency conflict: key '${idempotencyKey}' was used with different payload`);
        }
        return existing.result.inventory as HotelInventory;
      }
    }

    const inventory: HotelInventory = {
      id: randomUUID() as any,
      companyId: input.companyId,
      contractId: input.contractId,
      hotelId: input.hotelId,
      roomId: input.roomId,
      serviceDate: input.serviceDate,
      contractedQuantity: input.contractedQuantity.toString(),
      allocatedQuantity: '0',
      availableQuantity: input.contractedQuantity.toString(),
      status: 'ACTIVE'
    };

    await this.hotelRepo.create(inventory);

    await this.historyRepo.record({
      companyId: input.companyId,
      contractId: input.contractId,
      kind: 'HOTEL_INVENTORY_CREATED',
      aggregateId: inventory.id,
      sourceReference: input.sourceReference ? JSON.stringify(input.sourceReference) : undefined
    });

    if (idempotencyKey) {
      await this.idempotencyRepo.create(input.companyId, idempotencyKey, await sha256Hash(JSON.stringify(input)), { inventory });
    }

    return inventory;
  }

  async createFlightBlock(input: CreateFlightBlockInput, idempotencyKey?: string): Promise<FlightBlock> {
    if (idempotencyKey) {
      const hash = await sha256Hash(JSON.stringify(input));
      const existing = await this.idempotencyRepo.findByKey(input.companyId, idempotencyKey);
      if (existing) {
        if (existing.requestHash !== hash) {
          throw new Error(`Idempotency conflict: key '${idempotencyKey}' was used with different payload`);
        }
        return existing.result.block as FlightBlock;
      }
    }

    const block: FlightBlock = {
      id: randomUUID() as any,
      companyId: input.companyId,
      contractId: input.contractId,
      flightNumber: input.flightNumber,
      origin: input.origin,
      destination: input.destination,
      departureDate: input.departureDate,
      totalSeats: input.totalSeats.toString(),
      consumedSeats: '0',
      availableSeats: input.totalSeats.toString()
    };

    await this.flightBlockRepo.create(block);

    await this.historyRepo.record({
      companyId: input.companyId,
      contractId: input.contractId,
      kind: 'FLIGHT_BLOCK_CREATED',
      aggregateId: block.id,
      sourceReference: input.sourceReference ? JSON.stringify(input.sourceReference) : undefined
    });

    if (idempotencyKey) {
      await this.idempotencyRepo.create(input.companyId, idempotencyKey, await sha256Hash(JSON.stringify(input)), { block });
    }

    return block;
  }

  async createTransportCapacity(input: CreateTransportCapacityInput, idempotencyKey?: string): Promise<TransportCapacity> {
    if (idempotencyKey) {
      const hash = await sha256Hash(JSON.stringify(input));
      const existing = await this.idempotencyRepo.findByKey(input.companyId, idempotencyKey);
      if (existing) {
        if (existing.requestHash !== hash) {
          throw new Error(`Idempotency conflict: key '${idempotencyKey}' was used with different payload`);
        }
        return existing.result.capacity as TransportCapacity;
      }
    }

    const capacity: TransportCapacity = {
      id: randomUUID() as any,
      companyId: input.companyId,
      contractId: input.contractId,
      vehicleId: input.vehicleId,
      capacityUnits: input.capacityUnits.toString(),
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      consumedUnits: '0'
    };

    await this.transportRepo.create(capacity);

    await this.historyRepo.record({
      companyId: input.companyId,
      contractId: input.contractId,
      kind: 'TRANSPORT_CAPACITY_CREATED',
      aggregateId: capacity.id,
      sourceReference: input.sourceReference ? JSON.stringify(input.sourceReference) : undefined
    });

    if (idempotencyKey) {
      await this.idempotencyRepo.create(input.companyId, idempotencyKey, await sha256Hash(JSON.stringify(input)), { capacity });
    }

    return capacity;
  }

  async createVisaQuota(input: CreateVisaQuotaInput, idempotencyKey?: string): Promise<VisaQuota> {
    if (idempotencyKey) {
      const hash = await sha256Hash(JSON.stringify(input));
      const existing = await this.idempotencyRepo.findByKey(input.companyId, idempotencyKey);
      if (existing) {
        if (existing.requestHash !== hash) {
          throw new Error(`Idempotency conflict: key '${idempotencyKey}' was used with different payload`);
        }
        return existing.result.quota as VisaQuota;
      }
    }

    const quota: VisaQuota = {
      id: randomUUID() as any,
      companyId: input.companyId,
      contractId: input.contractId,
      visaType: input.visaType,
      nationality: input.nationality,
      quotaTotal: input.quotaTotal.toString(),
      quotaConsumed: '0',
      quotaRemaining: input.quotaTotal.toString(),
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo
    };

    await this.visaRepo.create(quota);

    await this.historyRepo.record({
      companyId: input.companyId,
      contractId: input.contractId,
      kind: 'VISA_QUOTA_CREATED',
      aggregateId: quota.id,
      sourceReference: input.sourceReference ? JSON.stringify(input.sourceReference) : undefined
    });

    if (idempotencyKey) {
      await this.idempotencyRepo.create(input.companyId, idempotencyKey, await sha256Hash(JSON.stringify(input)), { quota });
    }

    return quota;
  }

  async createStopSale(input: CreateStopSaleInput, idempotencyKey?: string): Promise<StopSale> {
    if (idempotencyKey) {
      const hash = await sha256Hash(JSON.stringify(input));
      const existing = await this.idempotencyRepo.findByKey(input.companyId, idempotencyKey);
      if (existing) {
        if (existing.requestHash !== hash) {
          throw new Error(`Idempotency conflict: key '${idempotencyKey}' was used with different payload`);
        }
        return existing.result.stopSale as StopSale;
      }
    }

    const stopSale: StopSale = {
      id: randomUUID() as any,
      companyId: input.companyId,
      contractId: input.contractId,
      reason: input.reason,
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo,
      createdAt: new Date().toISOString(),
      isActive: true
    };

    await this.stopSaleRepo.create(stopSale);

    await this.historyRepo.record({
      companyId: input.companyId,
      contractId: input.contractId,
      kind: 'STOP_SALE_CREATED',
      aggregateId: stopSale.id,
      sourceReference: input.sourceReference ? JSON.stringify(input.sourceReference) : undefined
    });

    if (idempotencyKey) {
      await this.idempotencyRepo.create(input.companyId, idempotencyKey, await sha256Hash(JSON.stringify(input)), { stopSale });
    }

    return stopSale;
  }

  async checkAvailability(input: CheckAvailabilityInput): Promise<AvailabilityResult> {
    const stopSales = await this.stopSaleRepo.findByDateRange(
      input.companyId,
      input.contractId,
      input.serviceDate,
      input.serviceDate
    );

    const activeStopSale = stopSales.find(ss => ss.isActive);
    if (activeStopSale) {
      return {
        available: false,
        availableQuantity: '0',
        blockerReason: `Stop sale: ${activeStopSale.reason}`
      };
    }

    const hotelInv = await this.hotelRepo.findByDate(
      input.companyId,
      input.contractId,
      '', 
      input.serviceDate
    );

    if (!hotelInv) {
      return { available: true, availableQuantity: '0' };
    }

    return {
      available: hotelInv.status === 'ACTIVE' && parseFloat(hotelInv.availableQuantity) > 0,
      availableQuantity: hotelInv.availableQuantity
    };
  }

  async allocateCapacity(input: AllocateCapacityInput, idempotencyKey?: string): Promise<AllocationResult> {
    if (idempotencyKey) {
      const hash = await sha256Hash(JSON.stringify(input));
      const existing = await this.idempotencyRepo.findByKey(input.companyId, idempotencyKey);
      if (existing) {
        if (existing.requestHash !== hash) {
          throw new Error(`Idempotency conflict: key '${idempotencyKey}' was used with different payload`);
        }
        return existing.result as AllocationResult;
      }
    }

    const stopSales = await this.stopSaleRepo.findByDateRange(
      input.companyId,
      input.contractId,
      input.serviceDate,
      input.serviceDate
    );

    const activeStopSale = stopSales.find(ss => ss.isActive);
    if (activeStopSale) {
      throw new Error(`Cannot allocate: stop sale in effect - ${activeStopSale.reason}`);
    }

    const allocation: Allocation = {
      id: randomUUID() as any,
      companyId: input.companyId,
      contractId: input.contractId,
      program: input.program,
      serviceDate: input.serviceDate,
      quantity: input.quantity.toString(),
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      sourceReference: input.sourceReference
    };

    await this.allocationRepo.create(allocation);

    await this.historyRepo.record({
      companyId: input.companyId,
      contractId: input.contractId,
      kind: 'ALLOCATION_CREATED',
      aggregateId: allocation.id,
      sourceReference: input.sourceReference ? JSON.stringify(input.sourceReference) : undefined
    });

    const result: AllocationResult = { allocation };

    if (idempotencyKey) {
      await this.idempotencyRepo.create(input.companyId, idempotencyKey, await sha256Hash(JSON.stringify(input)), result);
    }

    return result;
  }

  async releaseAllocation(input: ReleaseAllocationInput, idempotencyKey?: string): Promise<ReleaseResult> {
    if (idempotencyKey) {
      const hash = await sha256Hash(JSON.stringify(input));
      const existing = await this.idempotencyRepo.findByKey(input.companyId, idempotencyKey);
      if (existing) {
        if (existing.requestHash !== hash) {
          throw new Error(`Idempotency conflict: key '${idempotencyKey}' was used with different payload`);
        }
        return existing.result as ReleaseResult;
      }
    }

    const allocation = await this.allocationRepo.findById(input.companyId, input.allocationId);
    if (!allocation) {
      throw new Error(`Allocation ${input.allocationId} not found`);
    }

    if (allocation.status === 'CONSUMED') {
      const release: AllocationRelease = {
        id: randomUUID(),
        companyId: input.companyId,
        allocationId: input.allocationId,
        releasedQuantity: '0',
        blockerEvidence: 'Allocation already consumed - cannot release',
        releasedAt: new Date().toISOString(),
        status: 'BLOCKED'
      };

      await this.allocationReleaseRepo.create(release);

      const result: ReleaseResult = {
        success: false,
        blockerEvidence: release.blockerEvidence,
        releasedQuantity: '0'
      };

      if (idempotencyKey) {
        await this.idempotencyRepo.create(input.companyId, idempotencyKey, await sha256Hash(JSON.stringify(input)), result);
      }

      return result;
    }

    const release: AllocationRelease = {
      id: randomUUID(),
      companyId: input.companyId,
      allocationId: input.allocationId,
      releasedQuantity: input.quantity.toString(),
      releasedAt: new Date().toISOString(),
      status: 'SUCCESS'
    };

    await this.prisma.$transaction(async (tx) => {
      await (this.allocationRepo as any).prisma.tciAllocation.update({
        where: { id: input.allocationId },
        data: { status: 'RELEASED' }
      });

      await (this.allocationReleaseRepo as any).prisma.tciAllocationRelease.create({
        data: {
          id: release.id,
          companyId: release.companyId,
          allocationId: release.allocationId,
          releasedQuantity: release.releasedQuantity,
          blockerEvidence: release.blockerEvidence,
          releasedAt: new Date(release.releasedAt),
          status: release.status
        }
      });
    });

    const result: ReleaseResult = {
      success: true,
      releasedQuantity: release.releasedQuantity
    };

    if (idempotencyKey) {
      await this.idempotencyRepo.create(input.companyId, idempotencyKey, await sha256Hash(JSON.stringify(input)), result);
    }

    return result;
  }

  async adjustAllocation(input: AdjustAllocationInput, idempotencyKey?: string): Promise<Allocation> {
    if (idempotencyKey) {
      const hash = await sha256Hash(JSON.stringify(input));
      const existing = await this.idempotencyRepo.findByKey(input.companyId, idempotencyKey);
      if (existing) {
        if (existing.requestHash !== hash) {
          throw new Error(`Idempotency conflict: key '${idempotencyKey}' was used with different payload`);
        }
        return existing.result.allocation as Allocation;
      }
    }

    const allocation = await this.allocationRepo.findById(input.companyId, input.allocationId);
    if (!allocation) {
      throw new Error(`Allocation ${input.allocationId} not found`);
    }

    await this.allocationRepo.updateQuantity(input.allocationId, input.newQuantity);

    const adjustedAllocation: Allocation = {
      ...allocation,
      quantity: input.newQuantity.toString()
    };

    await this.historyRepo.record({
      companyId: input.companyId,
      contractId: allocation.contractId,
      kind: 'ALLOCATION_ADJUSTED',
      aggregateId: allocation.id,
      sourceReference: input.sourceReference ? JSON.stringify(input.sourceReference) : undefined
    });

    if (idempotencyKey) {
      await this.idempotencyRepo.create(input.companyId, idempotencyKey, await sha256Hash(JSON.stringify(input)), { allocation: adjustedAllocation });
    }

    return adjustedAllocation;
  }

  async consumeFlightBlock(input: ConsumeFlightBlockInput, idempotencyKey?: string): Promise<FlightBlockConsumption> {
    if (idempotencyKey) {
      const hash = await sha256Hash(JSON.stringify(input));
      const existing = await this.idempotencyRepo.findByKey(input.companyId, idempotencyKey);
      if (existing) {
        if (existing.requestHash !== hash) {
          throw new Error(`Idempotency conflict: key '${idempotencyKey}' was used with different payload`);
        }
        return existing.result.consumption as FlightBlockConsumption;
      }
    }

    const success = await this.flightBlockRepo.atomicConsume(
      input.companyId,
      input.flightBlockId,
      input.seats
    );

    if (!success) {
      throw new Error(`Insufficient seats available in flight block ${input.flightBlockId}`);
    }

    const consumption: FlightBlockConsumption = {
      id: randomUUID(),
      companyId: input.companyId,
      flightBlockId: input.flightBlockId,
      program: input.program,
      consumedSeats: input.seats.toString(),
      consumedAt: new Date().toISOString(),
      sourceReference: input.sourceReference
    };

    await this.flightBlockConsumptionRepo.create(consumption);

    if (idempotencyKey) {
      await this.idempotencyRepo.create(input.companyId, idempotencyKey, await sha256Hash(JSON.stringify(input)), { consumption });
    }

    return consumption;
  }

  async fulfillWithInternalFirst(input: InternalFirstFulfillmentInput, idempotencyKey?: string): Promise<AllocationResult> {
    if (idempotencyKey) {
      const hash = await sha256Hash(JSON.stringify(input));
      const existing = await this.idempotencyRepo.findByKey(input.companyId, idempotencyKey);
      if (existing) {
        if (existing.requestHash !== hash) {
          throw new Error(`Idempotency conflict: key '${idempotencyKey}' was used with different payload`);
        }
        return existing.result as AllocationResult;
      }
    }

    const remainingQuantity = parseFloat(input.requiredQuantity.toString());

    const procurementRequest: ProcurementRequest | undefined = remainingQuantity > 0 ? {
      id: randomUUID(),
      companyId: input.companyId,
      program: input.program,
      residualQuantity: remainingQuantity.toString(),
      procurementType: input.contractType,
      referenceData: input.referenceData,
      createdAt: new Date().toISOString(),
      sourceReference: input.sourceReference
    } : undefined;

    if (procurementRequest) {
      await this.procurementRepo.create(procurementRequest);
    }

    const result: AllocationResult = {
      allocation: {
        id: randomUUID() as any,
        companyId: input.companyId,
        contractId: '' as any,
        program: input.program,
        serviceDate: input.serviceDate,
        quantity: input.requiredQuantity.toString(),
        status: 'CONFIRMED',
        createdAt: new Date().toISOString()
      },
      procurementRequest
    };

    if (idempotencyKey) {
      await this.idempotencyRepo.create(input.companyId, idempotencyKey, await sha256Hash(JSON.stringify(input)), result);
    }

    return result;
  }

  async checkIdempotency(companyId: CompanyId, key: string): Promise<IdempotencyCheckResult> {
    const existing = await this.idempotencyRepo.findByKey(companyId, key);
    if (!existing) {
      return { exists: false };
    }
    return {
      exists: true,
      priorResult: existing.result
    };
  }
}
