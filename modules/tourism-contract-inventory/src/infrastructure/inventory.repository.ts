import { ContractValidationError, type CompanyId, type DecimalAmount, type SourceReference } from '@elhafez/contracts';
import type {
  TourismContract, ContractVersion, HotelInventory, FlightBlock, FlightBlockConsumption,
  TransportCapacity, VisaQuota, StopSale, Allocation, AllocationRelease, ProcurementRequest,
  ContractType, ContractStatus, AllocationStatus
} from '../domain/inventory.js';

export interface TourismContractRepository {
  findById(companyId: CompanyId, contractId: string): Promise<TourismContract | null>;
  findByStatus(companyId: CompanyId, status: ContractStatus): Promise<TourismContract[]>;
  create(contract: TourismContract): Promise<void>;
  updateStatus(contractId: string, status: ContractStatus): Promise<void>;
}

export interface ContractVersionRepository {
  findByContractId(companyId: CompanyId, contractId: string): Promise<ContractVersion[]>;
  findCurrent(companyId: CompanyId, contractId: string): Promise<ContractVersion | null>;
  create(version: ContractVersion): Promise<void>;
}

export interface HotelInventoryRepository {
  findByDate(companyId: CompanyId, contractId: string, hotelId: string, serviceDate: string): Promise<HotelInventory | null>;
  findByContractAndStatus(companyId: CompanyId, contractId: string, status: string): Promise<HotelInventory[]>;
  create(inventory: HotelInventory): Promise<void>;
  updateQuantities(id: string, allocatedQuantity: DecimalAmount, availableQuantity: DecimalAmount): Promise<void>;
  atomicReserve(companyId: CompanyId, contractId: string, hotelId: string, serviceDate: string, quantity: DecimalAmount): Promise<boolean>;
}

export interface FlightBlockRepository {
  findById(companyId: CompanyId, flightBlockId: string): Promise<FlightBlock | null>;
  findByContract(companyId: CompanyId, contractId: string): Promise<FlightBlock[]>;
  create(block: FlightBlock): Promise<void>;
  updateConsumedSeats(id: string, consumedSeats: DecimalAmount, availableSeats: DecimalAmount): Promise<void>;
  atomicConsume(companyId: CompanyId, flightBlockId: string, seats: DecimalAmount): Promise<boolean>;
}

export interface FlightBlockConsumptionRepository {
  findByFlightBlock(companyId: CompanyId, flightBlockId: string): Promise<FlightBlockConsumption[]>;
  create(consumption: FlightBlockConsumption): Promise<void>;
}

export interface TransportCapacityRepository {
  findByPeriod(companyId: CompanyId, vehicleId: string, periodStart: string, periodEnd: string): Promise<TransportCapacity | null>;
  findByOverlappingPeriod(companyId: CompanyId, vehicleId: string, start: string, end: string): Promise<TransportCapacity[]>;
  create(capacity: TransportCapacity): Promise<void>;
  updateConsumedUnits(id: string, consumedUnits: DecimalAmount): Promise<void>;
}

export interface VisaQuotaRepository {
  findByType(companyId: CompanyId, visaType: string, nationality: string | null, effectiveFrom: string, effectiveTo: string): Promise<VisaQuota | null>;
  findByContract(companyId: CompanyId, contractId: string): Promise<VisaQuota[]>;
  create(quota: VisaQuota): Promise<void>;
  updateConsumed(id: string, quotaConsumed: DecimalAmount, quotaRemaining: DecimalAmount): Promise<void>;
  atomicConsume(companyId: CompanyId, quotaId: string, quantity: DecimalAmount): Promise<boolean>;
}

export interface StopSaleRepository {
  findActiveByContract(companyId: CompanyId, contractId: string): Promise<StopSale[]>;
  findByDateRange(companyId: CompanyId, contractId: string, from: string, to: string): Promise<StopSale[]>;
  create(stopSale: StopSale): Promise<void>;
}

export interface AllocationRepository {
  findById(companyId: CompanyId, allocationId: string): Promise<Allocation | null>;
  findByContract(companyId: CompanyId, contractId: string): Promise<Allocation[]>;
  findByProgram(companyId: CompanyId, program: SourceReference): Promise<Allocation[]>;
  create(allocation: Allocation): Promise<void>;
  updateStatus(allocationId: string, status: AllocationStatus, releaseBlockerReason?: string): Promise<void>;
  updateQuantity(allocationId: string, quantity: DecimalAmount): Promise<void>;
}

export interface AllocationReleaseRepository {
  findByAllocation(companyId: CompanyId, allocationId: string): Promise<AllocationRelease[]>;
  create(release: AllocationRelease): Promise<void>;
}

export interface ProcurementRequestRepository {
  create(request: ProcurementRequest): Promise<void>;
  findByProgram(companyId: CompanyId, program: SourceReference): Promise<ProcurementRequest[]>;
}

export interface IdempotencyKeyRepository {
  findByKey(companyId: CompanyId, key: string): Promise<{ requestHash: string; result: Record<string, unknown> } | null>;
  create(companyId: CompanyId, key: string, requestHash: string, result: Record<string, unknown>): Promise<void>;
}

export interface ContractHistoryRepository {
  record(event: { companyId: CompanyId; contractId: string; kind: string; aggregateId: string; sourceReference?: string }): Promise<void>;
  findByContract(companyId: CompanyId, contractId: string): Promise<Array<{ companyId: CompanyId; contractId: string; kind: string; aggregateId: string; sourceReference?: string; createdAt: string }>>;
}
