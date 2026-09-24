import type { CompanyId } from '@elhafez/contracts';
import type {
  Allocation,
  AllocationCostEffect,
  AllocationCoverageRequirement,
  AllocationEconomicEvidence,
  ContractVersion,
  FlightBlock,
  FlightBlockConsumption,
  HotelInventory,
  ReleaseBlocker,
  StopSale,
  TourismContract,
  TransportCapacity,
  VisaQuota,
  GenericServiceInventory,
} from '../domain/inventory.js';
import type {
  AdjustAllocationInput,
  AllocateCapacityInput,
  AllocationResult,
  AmendContractInput,
  AvailabilityResult,
  CheckAvailabilityInput,
  ConsumeFlightBlockInput,
  CreateFlightBlockInput,
  CreateHotelInventoryInput,
  CreateStopSaleInput,
  CreateTourismContractInput,
  CreateTransportCapacityInput,
  CreateVisaQuotaInput,
  CreateGenericServiceInput,
  InternalFirstFulfillmentInput,
  ProtectAllocationCoverageInput,
  ProgramSupplyEvidence,
  ProgramSupplyEvidenceInput,
  RegisterAllocationEconomicEvidenceInput,
  ReleaseAllocationCoverageInput,
  ReleaseAllocationInput,
  ReleaseResult,
  PlanStandaloneSupplyInput,
  StandaloneSupplyPlan,
  CommitStandaloneSupplyPlanInput,
  StandaloneSupplyCommit,
} from '../application/inventory.application-service.js';

export interface AdjustmentResult {
  readonly allocation: Allocation;
  readonly previousQuantity: AllocationCostEffect['previousQuantity'];
  readonly costEffectId: string;
}

export interface TourismInventoryRepository {
  planStandaloneSupply(input: PlanStandaloneSupplyInput): Promise<StandaloneSupplyPlan>;
  getStandaloneSupplyPlan(companyId: CompanyId, planId: string): Promise<StandaloneSupplyPlan | null>;
  commitStandaloneSupplyPlan(input: CommitStandaloneSupplyPlanInput, key: string | undefined, hash: string): Promise<StandaloneSupplyCommit>;
  createContract(
    input: CreateTourismContractInput,
    key: string | undefined,
    hash: string,
  ): Promise<TourismContract>;
  amendContract(
    input: AmendContractInput,
    key: string | undefined,
    hash: string,
  ): Promise<ContractVersion>;
  contract(companyId: CompanyId, id: string): Promise<TourismContract | null>;
  versions(companyId: CompanyId, id: string): Promise<ContractVersion[]>;
  allocation(companyId: CompanyId, allocationId: string): Promise<Allocation | null>;
  createHotel(
    input: CreateHotelInventoryInput,
    key: string | undefined,
    hash: string,
  ): Promise<HotelInventory>;
  createFlight(
    input: CreateFlightBlockInput,
    key: string | undefined,
    hash: string,
  ): Promise<FlightBlock>;
  createTransport(
    input: CreateTransportCapacityInput,
    key: string | undefined,
    hash: string,
  ): Promise<TransportCapacity>;
  createVisa(
    input: CreateVisaQuotaInput,
    key: string | undefined,
    hash: string,
  ): Promise<VisaQuota>;
  createService(input:CreateGenericServiceInput,key:string|undefined,hash:string):Promise<GenericServiceInventory>;
  createStopSale(
    input: CreateStopSaleInput,
    key: string | undefined,
    hash: string,
  ): Promise<StopSale>;
  availability(input: CheckAvailabilityInput): Promise<AvailabilityResult>;
  supplyEvidence(input: ProgramSupplyEvidenceInput): Promise<ProgramSupplyEvidence>;
  allocate(
    input: AllocateCapacityInput,
    key: string | undefined,
    hash: string,
  ): Promise<AllocationResult>;
  release(
    input: ReleaseAllocationInput,
    key: string | undefined,
    hash: string,
  ): Promise<ReleaseResult>;
  adjust(
    input: AdjustAllocationInput,
    key: string | undefined,
    hash: string,
  ): Promise<AdjustmentResult>;
  costEffect(companyId: CompanyId, effectId: string): Promise<AllocationCostEffect | null>;
  completeCostEffect(
    companyId: CompanyId,
    effectId: string,
    ownerReference: string,
  ): Promise<AllocationCostEffect>;
  consumeFlight(
    input: ConsumeFlightBlockInput,
    key: string | undefined,
    hash: string,
  ): Promise<FlightBlockConsumption>;
  internalFirst(
    input: InternalFirstFulfillmentInput,
    key: string | undefined,
    hash: string,
  ): Promise<AllocationResult>;
  attachProcurementReference(
    companyId: CompanyId,
    requestId: string,
    externalReference: string,
  ): Promise<void>;
  registerEconomicEvidence(
    input: RegisterAllocationEconomicEvidenceInput,
    key: string | undefined,
    hash: string,
  ): Promise<AllocationEconomicEvidence>;
  protectCoverage(
    input: ProtectAllocationCoverageInput,
    key: string | undefined,
    hash: string,
  ): Promise<AllocationCoverageRequirement>;
  releaseCoverage(
    input: ReleaseAllocationCoverageInput,
    key: string | undefined,
    hash: string,
  ): Promise<AllocationCoverageRequirement>;
  releaseBlockers(companyId: CompanyId, allocationId: string): Promise<ReleaseBlocker[]>;
  idempotency(
    companyId: CompanyId,
    key: string,
  ): Promise<{ requestHash: string; result: Record<string, unknown> } | null>;
}

export const TOURISM_INVENTORY_REPOSITORY = Symbol('TOURISM_INVENTORY_REPOSITORY');
