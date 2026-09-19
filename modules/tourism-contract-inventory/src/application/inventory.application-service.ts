import { ContractValidationError, type CompanyId, type DecimalAmount, type SourceReference } from '@elhafez/contracts';
import type { TourismContract, ContractVersion, HotelInventory, FlightBlock, FlightBlockConsumption, TransportCapacity, VisaQuota, StopSale, Allocation, AllocationRelease, ProcurementRequest, IdempotencyKey, ContractHistory, ContractType, ContractStatus, AllocationStatus } from '../domain/inventory.js';

export interface CreateTourismContractInput {
  readonly companyId: CompanyId;
  readonly type: ContractType;
  readonly supplierId?: string;
  readonly effectiveFrom: string;
  readonly effectiveTo: string;
  readonly sourceReference?: SourceReference;
}

export interface AmendContractInput {
  readonly companyId: CompanyId;
  readonly contractId: string;
  readonly terms: Record<string, unknown>;
  readonly effectiveFrom: string;
  readonly effectiveTo?: string;
  readonly sourceReference?: SourceReference;
}

export interface CreateHotelInventoryInput {
  readonly companyId: CompanyId;
  readonly contractId: string;
  readonly hotelId: string;
  readonly roomId?: string;
  readonly serviceDate: string;
  readonly contractedQuantity: DecimalAmount;
  readonly sourceReference?: SourceReference;
}

export interface CreateFlightBlockInput {
  readonly companyId: CompanyId;
  readonly contractId: string;
  readonly flightNumber: string;
  readonly origin: string;
  readonly destination: string;
  readonly departureDate: string;
  readonly totalSeats: DecimalAmount;
  readonly sourceReference?: SourceReference;
}

export interface CreateTransportCapacityInput {
  readonly companyId: CompanyId;
  readonly contractId: string;
  readonly vehicleId: string;
  readonly capacityUnits: DecimalAmount;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly sourceReference?: SourceReference;
}

export interface CreateVisaQuotaInput {
  readonly companyId: CompanyId;
  readonly contractId: string;
  readonly visaType: string;
  readonly nationality?: string;
  readonly quotaTotal: DecimalAmount;
  readonly effectiveFrom: string;
  readonly effectiveTo: string;
  readonly sourceReference?: SourceReference;
}

export interface CreateStopSaleInput {
  readonly companyId: CompanyId;
  readonly contractId: string;
  readonly reason: string;
  readonly effectiveFrom: string;
  readonly effectiveTo: string;
  readonly sourceReference?: SourceReference;
}

export interface AllocateCapacityInput {
  readonly companyId: CompanyId;
  readonly contractId: string;
  readonly program: SourceReference;
  readonly serviceDate: string;
  readonly quantity: DecimalAmount;
  readonly sourceReference?: SourceReference;
}

export interface ReleaseAllocationInput {
  readonly companyId: CompanyId;
  readonly allocationId: string;
  readonly quantity: DecimalAmount;
  readonly sourceReference?: SourceReference;
}

export interface AdjustAllocationInput {
  readonly companyId: CompanyId;
  readonly allocationId: string;
  readonly newQuantity: DecimalAmount;
  readonly sourceReference?: SourceReference;
}

export interface ConsumeFlightBlockInput {
  readonly companyId: CompanyId;
  readonly flightBlockId: string;
  readonly program: SourceReference;
  readonly seats: DecimalAmount;
  readonly sourceReference?: SourceReference;
}

export interface InternalFirstFulfillmentInput {
  readonly companyId: CompanyId;
  readonly program: SourceReference;
  readonly contractType: ContractType;
  readonly serviceDate: string;
  readonly requiredQuantity: DecimalAmount;
  readonly referenceData: Record<string, unknown>;
  readonly sourceReference?: SourceReference;
}

export interface CheckAvailabilityInput {
  readonly companyId: CompanyId;
  readonly contractId: string;
  readonly serviceDate: string;
}

export interface AvailabilityResult {
  readonly available: boolean;
  readonly availableQuantity: DecimalAmount;
  readonly blockerReason?: string;
}

export interface AllocationResult {
  readonly allocation: Allocation;
  readonly procurementRequest?: ProcurementRequest;
}

export interface ReleaseResult {
  readonly success: boolean;
  readonly blockerEvidence?: string;
  readonly releasedQuantity: DecimalAmount;
}

export interface IdempotencyCheckResult {
  readonly exists: boolean;
  readonly priorResult?: Record<string, unknown>;
}

export interface TourismContractInventoryApplicationService {
  createContract(input: CreateTourismContractInput, idempotencyKey?: string): Promise<TourismContract>;
  amendContract(input: AmendContractInput, idempotencyKey?: string): Promise<ContractVersion>;
  getContract(companyId: CompanyId, contractId: string): Promise<TourismContract | null>;
  getContractVersions(companyId: CompanyId, contractId: string): Promise<ContractVersion[]>;
  
  createHotelInventory(input: CreateHotelInventoryInput, idempotencyKey?: string): Promise<HotelInventory>;
  createFlightBlock(input: CreateFlightBlockInput, idempotencyKey?: string): Promise<FlightBlock>;
  createTransportCapacity(input: CreateTransportCapacityInput, idempotencyKey?: string): Promise<TransportCapacity>;
  createVisaQuota(input: CreateVisaQuotaInput, idempotencyKey?: string): Promise<VisaQuota>;
  createStopSale(input: CreateStopSaleInput, idempotencyKey?: string): Promise<StopSale>;
  
  checkAvailability(input: CheckAvailabilityInput): Promise<AvailabilityResult>;
  allocateCapacity(input: AllocateCapacityInput, idempotencyKey?: string): Promise<AllocationResult>;
  releaseAllocation(input: ReleaseAllocationInput, idempotencyKey?: string): Promise<ReleaseResult>;
  adjustAllocation(input: AdjustAllocationInput, idempotencyKey?: string): Promise<Allocation>;
  
  consumeFlightBlock(input: ConsumeFlightBlockInput, idempotencyKey?: string): Promise<FlightBlockConsumption>;
  
  fulfillWithInternalFirst(input: InternalFirstFulfillmentInput, idempotencyKey?: string): Promise<AllocationResult>;
  
  checkIdempotency(companyId: CompanyId, key: string): Promise<IdempotencyCheckResult>;
}
