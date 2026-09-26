import type { CompanyId, DecimalAmount, SourceReference } from '@elhafez/contracts';
import type {
  Allocation,
  AllocationCoverageRequirement,
  AllocationEconomicEvidence,
  ContractType,
  ContractVersion,
  FlightBlock,
  FlightBlockConsumption,
  HotelInventory,
  ProcurementRequest,
  ReleaseBlocker,
  StopSale,
  TourismContract,
  TransportCapacity,
  VisaQuota,
  GenericServiceInventory, ServiceCategory,
} from '../domain/inventory.js';

interface BaseInput {
  readonly companyId: CompanyId;
  readonly sourceReference?: SourceReference;
}

export interface CreateTourismContractInput extends BaseInput {
  readonly type: ContractType;
  readonly supplierId?: string;
  readonly effectiveFrom: string;
  readonly effectiveTo: string;
}

export interface AmendContractInput extends BaseInput {
  readonly contractId: string;
  readonly terms: Record<string, unknown>;
  readonly effectiveFrom: string;
  readonly effectiveTo?: string;
}

export interface CreateHotelInventoryInput extends BaseInput {
  readonly contractId: string;
  readonly hotelId: string;
  readonly roomId?: string;
  readonly serviceDate: string;
  readonly contractedQuantity: DecimalAmount;
}

export interface CreateFlightBlockInput extends BaseInput {
  readonly contractId: string;
  readonly flightNumber: string;
  readonly origin: string;
  readonly destination: string;
  readonly departureDate: string;
  readonly totalSeats: DecimalAmount;
}

export interface CreateTransportCapacityInput extends BaseInput {
  readonly contractId: string;
  readonly vehicleId: string;
  readonly capacityUnits: DecimalAmount;
  readonly periodStart: string;
  readonly periodEnd: string;
}

export interface CreateVisaQuotaInput extends BaseInput {
  readonly contractId: string;
  readonly visaType: string;
  readonly nationality?: string;
  readonly quotaTotal: DecimalAmount;
  readonly effectiveFrom: string;
  readonly effectiveTo: string;
}
export interface CreateGenericServiceInput extends BaseInput {readonly contractId:string;readonly category:ServiceCategory;readonly name:string;readonly description?:string;readonly unit:string;readonly serviceStart:string;readonly serviceEnd:string;readonly capacity:DecimalAmount;readonly releaseDeadline?:string;}

export interface CreateStopSaleInput extends BaseInput {
  readonly contractId: string;
  readonly reason: string;
  readonly effectiveFrom: string;
  readonly effectiveTo: string;
}

export interface AllocateCapacityInput extends BaseInput {
  readonly contractId: string;
  readonly resourceType: ContractType;
  readonly resourceId: string;
  readonly program: SourceReference;
  readonly serviceDate: string;
  readonly periodEnd?: string;
  readonly quantity: DecimalAmount;
  readonly flightSegmentReference?: SourceReference;
  readonly visaBatchReference?: SourceReference;
}

export interface ReleaseAllocationInput extends BaseInput {
  readonly allocationId: string;
  readonly quantity: DecimalAmount;
}

export interface AdjustAllocationInput extends BaseInput {
  readonly allocationId: string;
  readonly newQuantity: DecimalAmount;
  readonly costEffectId: string;
  readonly costAmount: DecimalAmount;
  readonly postingDate: string;
}

export interface ConsumeFlightBlockInput extends BaseInput {
  readonly flightBlockId: string;
  readonly program: SourceReference;
  readonly seats: DecimalAmount;
  readonly flightSegmentReference: SourceReference;
}

export interface InternalFirstFulfillmentInput extends BaseInput {
  readonly branchId: string;
  readonly program: SourceReference;
  readonly contractType: ContractType;
  readonly resourceId: string;
  readonly serviceDate: string;
  readonly periodEnd?: string;
  readonly requiredQuantity: DecimalAmount;
  readonly referenceData: Record<string, unknown>;
  readonly supplierId: string;
  readonly flightSegmentReference?: SourceReference;
  readonly visaBatchReference?: SourceReference;
}

export interface CheckAvailabilityInput {
  readonly companyId: CompanyId;
  readonly contractId: string;
  readonly resourceType: ContractType;
  readonly resourceId: string;
  readonly serviceDate: string;
  readonly periodEnd?: string;
}

export interface ProgramSupplyEvidenceInput {
  readonly companyId: CompanyId;
  readonly resourceType: ContractType;
  readonly resourceId: string;
  readonly serviceDate: string;
  readonly periodEnd?: string;
  readonly serviceCategory?: ServiceCategory;
}

export interface ProgramSupplyEvidence {
  readonly available: boolean;
  readonly resourceType: ContractType;
  readonly resourceId: string;
  readonly contractId?: string;
  readonly availableQuantity: DecimalAmount;
  readonly blockerReason?: string;
}

export interface RegisterAllocationEconomicEvidenceInput extends BaseInput {
  readonly allocationId: string;
  readonly kind: string;
  readonly evidence: SourceReference;
}

export interface ProtectAllocationCoverageInput extends BaseInput {
  readonly allocationId: string;
  readonly minimumQuantity: DecimalAmount;
  readonly requirementReference: SourceReference;
}

export interface ReleaseAllocationCoverageInput extends BaseInput {
  readonly allocationId: string;
  readonly requirementReference: SourceReference;
}

export interface AvailabilityResult {
  readonly available: boolean;
  readonly availableQuantity: DecimalAmount;
  readonly blockerReason?: string;
}

export interface AllocationResult {
  readonly allocation?: Allocation;
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

export interface CostEffectPort {
  recordAllocationAdjustment(input: {
    companyId: CompanyId;
    effectId: string;
    program: SourceReference;
    allocationId: string;
    previousQuantity: DecimalAmount;
    newQuantity: DecimalAmount;
    costAmount: DecimalAmount;
    postingDate: string;
  }): Promise<{ id: string }>;
}

export interface ProcurementPort {
  requestResidual(input: {
    companyId: CompanyId;
    branchId: string;
    requestId: string;
    supplierId: string;
    type: ContractType;
    quantity: DecimalAmount;
    program: SourceReference;
    referenceData: Record<string, unknown>;
  }): Promise<string>;
}

export interface StandaloneSupplyRequest {
  readonly requestId: string;
  readonly contractId: string;
  readonly resourceType: ContractType;
  readonly resourceId: string;
  readonly serviceDate: string;
  readonly periodEnd?: string;
  readonly quantity: DecimalAmount;
  readonly unit: string;
  readonly supplierId?: string;
  readonly currency: string;
  readonly unitCost: DecimalAmount;
  readonly capacityPerUnit?: DecimalAmount;
  readonly flightSegmentReference?: SourceReference;
  readonly visaBatchReference?: SourceReference;
}
export interface StandaloneSupplyPlanLine {
  readonly requestId: string;
  readonly contractId: string;
  readonly pricingVersionId: string;
  readonly resourceType: ContractType;
  readonly resourceId: string;
  readonly supplierId?: string;
  readonly serviceDate: string;
  readonly periodEnd?: string;
  readonly requestedQuantity: DecimalAmount;
  readonly allocationQuantity: DecimalAmount;
  readonly unit: string;
  readonly currency: string;
  readonly unitCost: DecimalAmount;
  readonly costAmount: DecimalAmount;
}
export interface StandaloneSupplyResidual {
  readonly requestId: string;
  readonly resourceType: ContractType;
  readonly quantity: DecimalAmount;
  readonly unit: string;
  readonly currency: string;
  readonly supplierId?: string;
  readonly unitCost?: DecimalAmount;
  readonly costAmount?: DecimalAmount;
  readonly quoteReference?: string;
}
export interface StandaloneSupplyPlan {
  readonly planId: string;
  readonly version: number;
  readonly inputHash: string;
  readonly companyId: CompanyId;
  readonly branchId: string;
  readonly expiresAt: string;
  readonly service: SourceReference;
  readonly serviceRevision: number;
  readonly lines: readonly StandaloneSupplyPlanLine[];
  readonly residuals: readonly StandaloneSupplyResidual[];
  readonly totalsByCurrency: Readonly<Record<string, DecimalAmount>>;
}
export interface PlanStandaloneSupplyInput extends BaseInput {
  readonly branchId: string;
  readonly service: SourceReference;
  readonly serviceRevision: number;
  readonly requests: readonly StandaloneSupplyRequest[];
  readonly externalQuotes?: readonly { requestId: string; supplierId: string; currency: string; unitCost: DecimalAmount; quoteReference: string }[];
}
export interface CommitStandaloneSupplyPlanInput extends BaseInput {
  readonly branchId: string;
  readonly service: SourceReference;
  readonly planId: string;
  readonly planVersion: number;
  readonly inputHash: string;
}
export interface StandaloneSupplyCommit {
  readonly planId: string;
  readonly version: number;
  readonly allocationIds: readonly string[];
  readonly residuals: readonly StandaloneSupplyResidual[];
}

export interface TourismContractInventoryApplicationService {
  listContracts(companyId: CompanyId): Promise<TourismContract[]>;
  inventoryOverview(companyId: CompanyId, contractId?: string): Promise<{hotels:HotelInventory[];flights:FlightBlock[];transport:TransportCapacity[];visas:VisaQuota[];services:GenericServiceInventory[];stopSales:StopSale[];allocations:Allocation[]}>;
  createContract(input: CreateTourismContractInput, key?: string): Promise<TourismContract>;
  amendContract(input: AmendContractInput, key?: string): Promise<ContractVersion>;
  getContract(companyId: CompanyId, id: string): Promise<TourismContract | null>;
  getContractVersions(companyId: CompanyId, id: string): Promise<ContractVersion[]>;
  getAllocation(companyId: CompanyId, allocationId: string): Promise<Allocation | null>;
  createHotelInventory(input: CreateHotelInventoryInput, key?: string): Promise<HotelInventory>;
  createFlightBlock(input: CreateFlightBlockInput, key?: string): Promise<FlightBlock>;
  createTransportCapacity(input: CreateTransportCapacityInput, key?: string): Promise<TransportCapacity>;
  createVisaQuota(input: CreateVisaQuotaInput, key?: string): Promise<VisaQuota>;
  createGenericService(input:CreateGenericServiceInput,key?:string):Promise<GenericServiceInventory>;
  createStopSale(input: CreateStopSaleInput, key?: string): Promise<StopSale>;
  checkAvailability(input: CheckAvailabilityInput): Promise<AvailabilityResult>;
  checkProgramSupplyEvidence(input: ProgramSupplyEvidenceInput): Promise<ProgramSupplyEvidence>;
  allocateCapacity(input: AllocateCapacityInput, key?: string): Promise<AllocationResult>;
  releaseAllocation(input: ReleaseAllocationInput, key?: string): Promise<ReleaseResult>;
  adjustAllocation(input: AdjustAllocationInput, key?: string): Promise<Allocation>;
  consumeFlightBlock(input: ConsumeFlightBlockInput, key?: string): Promise<FlightBlockConsumption>;
  fulfillWithInternalFirst(input: InternalFirstFulfillmentInput, key?: string): Promise<AllocationResult>;
  registerAllocationEconomicEvidence(
    input: RegisterAllocationEconomicEvidenceInput,
    key?: string,
  ): Promise<AllocationEconomicEvidence>;
  protectAllocationCoverage(
    input: ProtectAllocationCoverageInput,
    key?: string,
  ): Promise<AllocationCoverageRequirement>;
  releaseAllocationCoverage(
    input: ReleaseAllocationCoverageInput,
    key?: string,
  ): Promise<AllocationCoverageRequirement>;
  getReleaseBlockers(companyId: CompanyId, allocationId: string): Promise<ReleaseBlocker[]>;
  checkIdempotency(companyId: CompanyId, key: string): Promise<IdempotencyCheckResult>;
  planStandaloneSupply(input: PlanStandaloneSupplyInput): Promise<StandaloneSupplyPlan>;
  getStandaloneSupplyPlan(companyId: CompanyId, planId: string): Promise<StandaloneSupplyPlan | null>;
  commitStandaloneSupplyPlan(input: CommitStandaloneSupplyPlanInput, key?: string): Promise<StandaloneSupplyCommit>;
}
