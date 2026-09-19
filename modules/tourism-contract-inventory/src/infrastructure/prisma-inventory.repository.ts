import type { PrismaClient } from '@prisma/client';
import type { CompanyId, DecimalAmount } from '@elhafez/contracts';
import type {
  TourismContract, ContractVersion, HotelInventory, FlightBlock, FlightBlockConsumption,
  TransportCapacity, VisaQuota, StopSale, Allocation, AllocationRelease, ProcurementRequest,
  ContractStatus, AllocationStatus
} from '../domain/inventory.js';
import type {
  TourismContractRepository, ContractVersionRepository, HotelInventoryRepository,
  FlightBlockRepository, FlightBlockConsumptionRepository, TransportCapacityRepository,
  VisaQuotaRepository, StopSaleRepository, AllocationRepository, AllocationReleaseRepository,
  ProcurementRequestRepository, IdempotencyKeyRepository, ContractHistoryRepository
} from './inventory.repository.js';

export class PrismaTourismContractRepository implements TourismContractRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(companyId: CompanyId, contractId: string): Promise<TourismContract | null> {
    const record = await this.prisma.tciContract.findUnique({
      where: { companyId_id: { companyId, id: contractId } }
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async findByStatus(companyId: CompanyId, status: ContractStatus): Promise<TourismContract[]> {
    const records = await this.prisma.tciContract.findMany({
      where: { companyId, status }
    });
    return records.map(r => this.toDomain(r));
  }

  async create(contract: TourismContract): Promise<void> {
    await this.prisma.tciContract.create({
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
  }

  async updateStatus(contractId: string, status: ContractStatus): Promise<void> {
    await this.prisma.tciContract.update({
      where: { id: contractId },
      data: { status }
    });
  }

  private toDomain(record: any): TourismContract {
    return {
      id: record.id,
      companyId: record.companyId,
      type: record.type,
      status: record.status,
      supplierId: record.supplierId ?? undefined,
      effectiveFrom: record.effectiveFrom.toISOString(),
      effectiveTo: record.effectiveTo.toISOString(),
      createdAt: record.createdAt.toISOString(),
      sourceReference: record.sourceReference ? JSON.parse(record.sourceReference) : undefined
    };
  }
}

export class PrismaContractVersionRepository implements ContractVersionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByContractId(companyId: CompanyId, contractId: string): Promise<ContractVersion[]> {
    const records = await this.prisma.tciContractVersion.findMany({
      where: { companyId, contractId },
      orderBy: { versionNumber: 'asc' }
    });
    return records.map(r => this.toDomain(r));
  }

  async findCurrent(companyId: CompanyId, contractId: string): Promise<ContractVersion | null> {
    const record = await this.prisma.tciContractVersion.findFirst({
      where: { companyId, contractId, isCurrent: true }
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async create(version: ContractVersion): Promise<void> {
    await this.prisma.tciContractVersion.create({
      data: {
        id: version.id,
        companyId: version.companyId,
        contractId: version.contractId,
        versionNumber: version.versionNumber,
        effectiveFrom: new Date(version.effectiveFrom),
        effectiveTo: version.effectiveTo ? new Date(version.effectiveTo) : null,
        terms: JSON.stringify(version.terms),
        isCurrent: version.isCurrent
      }
    });
  }

  private toDomain(record: any): ContractVersion {
    return {
      id: record.id,
      companyId: record.companyId,
      contractId: record.contractId,
      versionNumber: record.versionNumber,
      effectiveFrom: record.effectiveFrom.toISOString(),
      effectiveTo: record.effectiveTo?.toISOString(),
      terms: JSON.parse(record.terms),
      createdAt: record.createdAt.toISOString(),
      isCurrent: record.isCurrent
    };
  }
}

export class PrismaHotelInventoryRepository implements HotelInventoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByDate(companyId: CompanyId, contractId: string, hotelId: string, serviceDate: string): Promise<HotelInventory | null> {
    const record = await this.prisma.tciHotelInventory.findFirst({
      where: {
        companyId,
        contractId,
        hotelId,
        serviceDate: new Date(serviceDate)
      }
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async findByContractAndStatus(companyId: CompanyId, contractId: string, status: string): Promise<HotelInventory[]> {
    const records = await this.prisma.tciHotelInventory.findMany({
      where: { companyId, contractId, status }
    });
    return records.map(r => this.toDomain(r));
  }

  async create(inventory: HotelInventory): Promise<void> {
    await this.prisma.tciHotelInventory.create({
      data: {
        id: inventory.id,
        companyId: inventory.companyId,
        contractId: inventory.contractId,
        hotelId: inventory.hotelId,
        roomId: inventory.roomId,
        serviceDate: new Date(inventory.serviceDate),
        contractedQuantity: inventory.contractedQuantity.toString(),
        allocatedQuantity: inventory.allocatedQuantity.toString(),
        availableQuantity: inventory.availableQuantity.toString(),
        status: inventory.status
      }
    });
  }

  async updateQuantities(id: string, allocatedQuantity: DecimalAmount, availableQuantity: DecimalAmount): Promise<void> {
    await this.prisma.tciHotelInventory.update({
      where: { id },
      data: {
        allocatedQuantity: allocatedQuantity.toString(),
        availableQuantity: availableQuantity.toString()
      }
    });
  }

  async atomicReserve(companyId: CompanyId, contractId: string, hotelId: string, serviceDate: string, quantity: DecimalAmount): Promise<boolean> {
    const result = await this.prisma.tciHotelInventory.updateMany({
      where: {
        companyId,
        contractId,
        hotelId,
        serviceDate: new Date(serviceDate),
        availableQuantity: { gte: quantity.toString() }
      },
      data: {
        allocatedQuantity: { increment: quantity.toString() },
        availableQuantity: { decrement: quantity.toString() }
      }
    });
    return result.count > 0;
  }

  private toDomain(record: any): HotelInventory {
    return {
      id: record.id,
      companyId: record.companyId,
      contractId: record.contractId,
      hotelId: record.hotelId,
      roomId: record.roomId ?? undefined,
      serviceDate: record.serviceDate.toISOString(),
      contractedQuantity: record.contractedQuantity.toString(),
      allocatedQuantity: record.allocatedQuantity.toString(),
      availableQuantity: record.availableQuantity.toString(),
      status: record.status
    };
  }
}

export class PrismaFlightBlockRepository implements FlightBlockRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(companyId: CompanyId, flightBlockId: string): Promise<FlightBlock | null> {
    const record = await this.prisma.tciFlightBlock.findUnique({
      where: { companyId_id: { companyId, id: flightBlockId } }
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async findByContract(companyId: CompanyId, contractId: string): Promise<FlightBlock[]> {
    const records = await this.prisma.tciFlightBlock.findMany({
      where: { companyId, contractId }
    });
    return records.map(r => this.toDomain(r));
  }

  async create(block: FlightBlock): Promise<void> {
    await this.prisma.tciFlightBlock.create({
      data: {
        id: block.id,
        companyId: block.companyId,
        contractId: block.contractId,
        flightNumber: block.flightNumber,
        origin: block.origin,
        destination: block.destination,
        departureDate: new Date(block.departureDate),
        totalSeats: block.totalSeats.toString(),
        consumedSeats: block.consumedSeats.toString(),
        availableSeats: block.availableSeats.toString()
      }
    });
  }

  async updateConsumedSeats(id: string, consumedSeats: DecimalAmount, availableSeats: DecimalAmount): Promise<void> {
    await this.prisma.tciFlightBlock.update({
      where: { id },
      data: {
        consumedSeats: consumedSeats.toString(),
        availableSeats: availableSeats.toString()
      }
    });
  }

  async atomicConsume(companyId: CompanyId, flightBlockId: string, seats: DecimalAmount): Promise<boolean> {
    const result = await this.prisma.tciFlightBlock.updateMany({
      where: {
        companyId,
        id: flightBlockId,
        availableSeats: { gte: seats.toString() }
      },
      data: {
        consumedSeats: { increment: seats.toString() },
        availableSeats: { decrement: seats.toString() }
      }
    });
    return result.count > 0;
  }

  private toDomain(record: any): FlightBlock {
    return {
      id: record.id,
      companyId: record.companyId,
      contractId: record.contractId,
      flightNumber: record.flightNumber,
      origin: record.origin,
      destination: record.destination,
      departureDate: record.departureDate.toISOString(),
      totalSeats: record.totalSeats.toString(),
      consumedSeats: record.consumedSeats.toString(),
      availableSeats: record.availableSeats.toString()
    };
  }
}

export class PrismaFlightBlockConsumptionRepository implements FlightBlockConsumptionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByFlightBlock(companyId: CompanyId, flightBlockId: string): Promise<FlightBlockConsumption[]> {
    const records = await this.prisma.tciFlightBlockConsumption.findMany({
      where: { companyId, flightBlockId }
    });
    return records.map(r => this.toDomain(r));
  }

  async create(consumption: FlightBlockConsumption): Promise<void> {
    await this.prisma.tciFlightBlockConsumption.create({
      data: {
        id: consumption.id,
        companyId: consumption.companyId,
        flightBlockId: consumption.flightBlockId,
        program: JSON.stringify(consumption.program),
        consumedSeats: consumption.consumedSeats.toString(),
        consumedAt: new Date(consumption.consumedAt),
        sourceReference: consumption.sourceReference ? JSON.stringify(consumption.sourceReference) : null
      }
    });
  }

  private toDomain(record: any): FlightBlockConsumption {
    return {
      id: record.id,
      companyId: record.companyId,
      flightBlockId: record.flightBlockId,
      program: JSON.parse(record.program),
      consumedSeats: record.consumedSeats.toString(),
      consumedAt: record.consumedAt.toISOString(),
      sourceReference: record.sourceReference ? JSON.parse(record.sourceReference) : undefined
    };
  }
}

export class PrismaTransportCapacityRepository implements TransportCapacityRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByPeriod(companyId: CompanyId, vehicleId: string, periodStart: string, periodEnd: string): Promise<TransportCapacity | null> {
    const record = await this.prisma.tciTransportCapacity.findFirst({
      where: {
        companyId,
        vehicleId,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd)
      }
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async findByOverlappingPeriod(companyId: CompanyId, vehicleId: string, start: string, end: string): Promise<TransportCapacity[]> {
    const records = await this.prisma.tciTransportCapacity.findMany({
      where: {
        companyId,
        vehicleId,
        OR: [
          { periodStart: { lte: new Date(end) }, periodEnd: { gte: new Date(start) } }
        ]
      }
    });
    return records.map(r => this.toDomain(r));
  }

  async create(capacity: TransportCapacity): Promise<void> {
    await this.prisma.tciTransportCapacity.create({
      data: {
        id: capacity.id,
        companyId: capacity.companyId,
        contractId: capacity.contractId,
        vehicleId: capacity.vehicleId,
        capacityUnits: capacity.capacityUnits.toString(),
        periodStart: new Date(capacity.periodStart),
        periodEnd: new Date(capacity.periodEnd),
        consumedUnits: capacity.consumedUnits.toString()
      }
    });
  }

  async updateConsumedUnits(id: string, consumedUnits: DecimalAmount): Promise<void> {
    await this.prisma.tciTransportCapacity.update({
      where: { id },
      data: { consumedUnits: consumedUnits.toString() }
    });
  }

  private toDomain(record: any): TransportCapacity {
    return {
      id: record.id,
      companyId: record.companyId,
      contractId: record.contractId,
      vehicleId: record.vehicleId,
      capacityUnits: record.capacityUnits.toString(),
      periodStart: record.periodStart.toISOString(),
      periodEnd: record.periodEnd.toISOString(),
      consumedUnits: record.consumedUnits.toString()
    };
  }
}

export class PrismaVisaQuotaRepository implements VisaQuotaRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByType(companyId: CompanyId, visaType: string, nationality: string | null, effectiveFrom: string, effectiveTo: string): Promise<VisaQuota | null> {
    const record = await this.prisma.tciVisaQuota.findFirst({
      where: {
        companyId,
        visaType,
        nationality,
        effectiveFrom: new Date(effectiveFrom),
        effectiveTo: new Date(effectiveTo)
      }
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async findByContract(companyId: CompanyId, contractId: string): Promise<VisaQuota[]> {
    const records = await this.prisma.tciVisaQuota.findMany({
      where: { companyId, contractId }
    });
    return records.map(r => this.toDomain(r));
  }

  async create(quota: VisaQuota): Promise<void> {
    await this.prisma.tciVisaQuota.create({
      data: {
        id: quota.id,
        companyId: quota.companyId,
        contractId: quota.contractId,
        visaType: quota.visaType,
        nationality: quota.nationality,
        quotaTotal: quota.quotaTotal.toString(),
        quotaConsumed: quota.quotaConsumed.toString(),
        quotaRemaining: quota.quotaRemaining.toString(),
        effectiveFrom: new Date(quota.effectiveFrom),
        effectiveTo: new Date(quota.effectiveTo)
      }
    });
  }

  async updateConsumed(id: string, quotaConsumed: DecimalAmount, quotaRemaining: DecimalAmount): Promise<void> {
    await this.prisma.tciVisaQuota.update({
      where: { id },
      data: {
        quotaConsumed: quotaConsumed.toString(),
        quotaRemaining: quotaRemaining.toString()
      }
    });
  }

  async atomicConsume(companyId: CompanyId, quotaId: string, quantity: DecimalAmount): Promise<boolean> {
    const result = await this.prisma.tciVisaQuota.updateMany({
      where: {
        companyId,
        id: quotaId,
        quotaRemaining: { gte: quantity.toString() }
      },
      data: {
        quotaConsumed: { increment: quantity.toString() },
        quotaRemaining: { decrement: quantity.toString() }
      }
    });
    return result.count > 0;
  }

  private toDomain(record: any): VisaQuota {
    return {
      id: record.id,
      companyId: record.companyId,
      contractId: record.contractId,
      visaType: record.visaType,
      nationality: record.nationality ?? undefined,
      quotaTotal: record.quotaTotal.toString(),
      quotaConsumed: record.quotaConsumed.toString(),
      quotaRemaining: record.quotaRemaining.toString(),
      effectiveFrom: record.effectiveFrom.toISOString(),
      effectiveTo: record.effectiveTo.toISOString()
    };
  }
}

export class PrismaStopSaleRepository implements StopSaleRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findActiveByContract(companyId: CompanyId, contractId: string): Promise<StopSale[]> {
    const records = await this.prisma.tciStopSale.findMany({
      where: { companyId, contractId, isActive: true }
    });
    return records.map(r => this.toDomain(r));
  }

  async findByDateRange(companyId: CompanyId, contractId: string, from: string, to: string): Promise<StopSale[]> {
    const records = await this.prisma.tciStopSale.findMany({
      where: {
        companyId,
        contractId,
        effectiveFrom: { lte: new Date(to) },
        effectiveTo: { gte: new Date(from) }
      }
    });
    return records.map(r => this.toDomain(r));
  }

  async create(stopSale: StopSale): Promise<void> {
    await this.prisma.tciStopSale.create({
      data: {
        id: stopSale.id,
        companyId: stopSale.companyId,
        contractId: stopSale.contractId,
        reason: stopSale.reason,
        effectiveFrom: new Date(stopSale.effectiveFrom),
        effectiveTo: new Date(stopSale.effectiveTo),
        isActive: stopSale.isActive
      }
    });
  }

  private toDomain(record: any): StopSale {
    return {
      id: record.id,
      companyId: record.companyId,
      contractId: record.contractId,
      reason: record.reason,
      effectiveFrom: record.effectiveFrom.toISOString(),
      effectiveTo: record.effectiveTo.toISOString(),
      createdAt: record.createdAt.toISOString(),
      isActive: record.isActive
    };
  }
}

export class PrismaAllocationRepository implements AllocationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(companyId: CompanyId, allocationId: string): Promise<Allocation | null> {
    const record = await this.prisma.tciAllocation.findUnique({
      where: { companyId_id: { companyId, id: allocationId } }
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async findByContract(companyId: CompanyId, contractId: string): Promise<Allocation[]> {
    const records = await this.prisma.tciAllocation.findMany({
      where: { companyId, contractId }
    });
    return records.map(r => this.toDomain(r));
  }

  async findByProgram(companyId: CompanyId, program: SourceReference): Promise<Allocation[]> {
    const records = await this.prisma.tciAllocation.findMany({
      where: {
        companyId,
        program: { equals: JSON.stringify(program) }
      }
    });
    return records.map(r => this.toDomain(r));
  }

  async create(allocation: Allocation): Promise<void> {
    await this.prisma.tciAllocation.create({
      data: {
        id: allocation.id,
        companyId: allocation.companyId,
        contractId: allocation.contractId,
        program: JSON.stringify(allocation.program),
        serviceDate: new Date(allocation.serviceDate),
        quantity: allocation.quantity.toString(),
        status: allocation.status,
        releaseBlockerReason: allocation.releaseBlockerReason,
        sourceReference: allocation.sourceReference ? JSON.stringify(allocation.sourceReference) : null
      }
    });
  }

  async updateStatus(allocationId: string, status: AllocationStatus, releaseBlockerReason?: string): Promise<void> {
    await this.prisma.tciAllocation.update({
      where: { id: allocationId },
      data: {
        status,
        releaseBlockerReason
      }
    });
  }

  async updateQuantity(allocationId: string, quantity: DecimalAmount): Promise<void> {
    await this.prisma.tciAllocation.update({
      where: { id: allocationId },
      data: { quantity: quantity.toString() }
    });
  }

  private toDomain(record: any): Allocation {
    return {
      id: record.id,
      companyId: record.companyId,
      contractId: record.contractId,
      program: JSON.parse(record.program),
      serviceDate: record.serviceDate.toISOString(),
      quantity: record.quantity.toString(),
      status: record.status,
      releaseBlockerReason: record.releaseBlockerReason ?? undefined,
      createdAt: record.createdAt.toISOString(),
      sourceReference: record.sourceReference ? JSON.parse(record.sourceReference) : undefined
    };
  }
}

export class PrismaAllocationReleaseRepository implements AllocationReleaseRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByAllocation(companyId: CompanyId, allocationId: string): Promise<AllocationRelease[]> {
    const records = await this.prisma.tciAllocationRelease.findMany({
      where: { companyId, allocationId }
    });
    return records.map(r => this.toDomain(r));
  }

  async create(release: AllocationRelease): Promise<void> {
    await this.prisma.tciAllocationRelease.create({
      data: {
        id: release.id,
        companyId: release.companyId,
        allocationId: release.allocationId,
        releasedQuantity: release.releasedQuantity.toString(),
        blockerEvidence: release.blockerEvidence,
        releasedAt: new Date(release.releasedAt),
        status: release.status
      }
    });
  }

  private toDomain(record: any): AllocationRelease {
    return {
      id: record.id,
      companyId: record.companyId,
      allocationId: record.allocationId,
      releasedQuantity: record.releasedQuantity.toString(),
      blockerEvidence: record.blockerEvidence ?? undefined,
      releasedAt: record.releasedAt.toISOString(),
      status: record.status
    };
  }
}

export class PrismaProcurementRequestRepository implements ProcurementRequestRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(request: ProcurementRequest): Promise<void> {
    await this.prisma.tciProcurementRequest.create({
      data: {
        id: request.id,
        companyId: request.companyId,
        program: JSON.stringify(request.program),
        residualQuantity: request.residualQuantity.toString(),
        procurementType: request.procurementType,
        referenceData: JSON.stringify(request.referenceData),
        sourceReference: request.sourceReference ? JSON.stringify(request.sourceReference) : null
      }
    });
  }

  async findByProgram(companyId: CompanyId, program: SourceReference): Promise<ProcurementRequest[]> {
    const records = await this.prisma.tciProcurementRequest.findMany({
      where: {
        companyId,
        program: { equals: JSON.stringify(program) }
      }
    });
    return records.map(r => this.toDomain(r));
  }

  private toDomain(record: any): ProcurementRequest {
    return {
      id: record.id,
      companyId: record.companyId,
      program: JSON.parse(record.program),
      residualQuantity: record.residualQuantity.toString(),
      procurementType: record.procurementType,
      referenceData: JSON.parse(record.referenceData),
      createdAt: record.createdAt.toISOString(),
      sourceReference: record.sourceReference ? JSON.parse(record.sourceReference) : undefined
    };
  }
}

export class PrismaIdempotencyKeyRepository implements IdempotencyKeyRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByKey(companyId: CompanyId, key: string): Promise<{ requestHash: string; result: Record<string, unknown> } | null> {
    const record = await this.prisma.tciIdempotencyKey.findFirst({
      where: { companyId, key }
    });
    if (!record) return null;
    return {
      requestHash: record.requestHash,
      result: JSON.parse(record.result)
    };
  }

  async create(companyId: CompanyId, key: string, requestHash: string, result: Record<string, unknown>): Promise<void> {
    await this.prisma.tciIdempotencyKey.create({
      data: {
        id: `${companyId}-${key}`,
        companyId,
        key,
        requestHash,
        result: JSON.stringify(result)
      }
    });
  }
}

export class PrismaContractHistoryRepository implements ContractHistoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async record(event: { companyId: CompanyId; contractId: string; kind: string; aggregateId: string; sourceReference?: string }): Promise<void> {
    await this.prisma.tciContractHistory.create({
      data: {
        id: `${event.companyId}-${event.contractId}-${event.aggregateId}-${Date.now()}`,
        companyId: event.companyId,
        contractId: event.contractId,
        kind: event.kind,
        aggregateId: event.aggregateId,
        sourceReference: event.sourceReference
      }
    });
  }

  async findByContract(companyId: CompanyId, contractId: string): Promise<Array<{ companyId: CompanyId; contractId: string; kind: string; aggregateId: string; sourceReference?: string; createdAt: string }>> {
    const records = await this.prisma.tciContractHistory.findMany({
      where: { companyId, contractId },
      orderBy: { createdAt: 'asc' }
    });
    return records.map(r => ({
      companyId: r.companyId,
      contractId: r.contractId,
      kind: r.kind,
      aggregateId: r.aggregateId,
      sourceReference: r.sourceReference ?? undefined,
      createdAt: r.createdAt.toISOString()
    }));
  }
}
