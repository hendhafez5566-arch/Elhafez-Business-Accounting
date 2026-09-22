import { decimalAmount, type CompanyId } from '@elhafez/contracts';
import type {
  Allocation,
  ContractVersion,
  FlightBlock,
  FlightBlockConsumption,
  HotelInventory,
  StopSale,
  TourismContract,
  TransportCapacity,
  VisaQuota,
} from '../domain/inventory.js';
import type { TourismInventoryRepository } from '../infrastructure/inventory.repository.js';
import type {
  AdjustAllocationInput,
  AllocateCapacityInput,
  AllocationResult,
  AmendContractInput,
  AvailabilityResult,
  CheckAvailabilityInput,
  ConsumeFlightBlockInput,
  CostEffectPort,
  CreateFlightBlockInput,
  CreateHotelInventoryInput,
  CreateStopSaleInput,
  CreateTourismContractInput,
  CreateTransportCapacityInput,
  CreateVisaQuotaInput,
  CreateGenericServiceInput,
  IdempotencyCheckResult,
  InternalFirstFulfillmentInput,
  ProcurementPort,
  ProtectAllocationCoverageInput,
  ProgramSupplyEvidenceInput,
  RegisterAllocationEconomicEvidenceInput,
  ReleaseAllocationCoverageInput,
  ReleaseAllocationInput,
  ReleaseResult,
  TourismContractInventoryApplicationService,
} from './inventory.application-service.js';
import { idempotencyHash } from './idempotency-hash.js';

function positiveQuantity(value: unknown) {
  const result = decimalAmount(value);
  if (result.startsWith('-') || result === '0') throw new Error('quantity must be positive');
  return result;
}

export class TourismContractInventoryApplicationServiceImpl
  implements TourismContractInventoryApplicationService
{
  constructor(
    private readonly repo: TourismInventoryRepository,
    private readonly cost: CostEffectPort,
    private readonly procurement: ProcurementPort,
  ) {}

  createContract(input: CreateTourismContractInput, key?: string): Promise<TourismContract> {
    return this.repo.createContract(input, key, idempotencyHash(input));
  }

  amendContract(input: AmendContractInput, key?: string): Promise<ContractVersion> {
    return this.repo.amendContract(input, key, idempotencyHash(input));
  }

  getContract(companyId: CompanyId, id: string): Promise<TourismContract | null> {
    return this.repo.contract(companyId, id);
  }

  getContractVersions(companyId: CompanyId, id: string): Promise<ContractVersion[]> {
    return this.repo.versions(companyId, id);
  }

  getAllocation(companyId: CompanyId, allocationId: string): Promise<Allocation | null> {
    return this.repo.allocation(companyId, allocationId);
  }

  createHotelInventory(input: CreateHotelInventoryInput, key?: string): Promise<HotelInventory> {
    positiveQuantity(input.contractedQuantity);
    return this.repo.createHotel(input, key, idempotencyHash(input));
  }

  createFlightBlock(input: CreateFlightBlockInput, key?: string): Promise<FlightBlock> {
    positiveQuantity(input.totalSeats);
    return this.repo.createFlight(input, key, idempotencyHash(input));
  }

  createTransportCapacity(
    input: CreateTransportCapacityInput,
    key?: string,
  ): Promise<TransportCapacity> {
    positiveQuantity(input.capacityUnits);
    return this.repo.createTransport(input, key, idempotencyHash(input));
  }

  createVisaQuota(input: CreateVisaQuotaInput, key?: string): Promise<VisaQuota> {
    positiveQuantity(input.quotaTotal);
    return this.repo.createVisa(input, key, idempotencyHash(input));
  }
  createGenericService(input:CreateGenericServiceInput,key?:string){positiveQuantity(input.capacity);if(input.serviceEnd<input.serviceStart)throw new Error('serviceEnd must be on or after serviceStart');if(input.releaseDeadline&&input.releaseDeadline>input.serviceStart)throw new Error('releaseDeadline must not follow serviceStart');return this.repo.createService(input,key,idempotencyHash(input));}

  createStopSale(input: CreateStopSaleInput, key?: string): Promise<StopSale> {
    return this.repo.createStopSale(input, key, idempotencyHash(input));
  }

  checkAvailability(input: CheckAvailabilityInput): Promise<AvailabilityResult> {
    return this.repo.availability(input);
  }

  checkProgramSupplyEvidence(input: ProgramSupplyEvidenceInput) {
    return this.repo.supplyEvidence(input);
  }

  allocateCapacity(input: AllocateCapacityInput, key?: string): Promise<AllocationResult> {
    positiveQuantity(input.quantity);
    if (input.resourceType === 'FLIGHT_BLOCK' && !input.flightSegmentReference) {
      throw new Error('real flight-segment evidence is required');
    }
    if (input.resourceType === 'VISA' && !input.visaBatchReference) {
      throw new Error('visa batch evidence is required');
    }
    return this.repo.allocate(input, key, idempotencyHash(input));
  }

  releaseAllocation(input: ReleaseAllocationInput, key?: string): Promise<ReleaseResult> {
    positiveQuantity(input.quantity);
    return this.repo.release(input, key, idempotencyHash(input));
  }

  async adjustAllocation(input: AdjustAllocationInput, key?: string): Promise<Allocation> {
    positiveQuantity(input.newQuantity);
    decimalAmount(input.costAmount);
    const result = await this.repo.adjust(input, key, idempotencyHash(input));
    const effect = await this.repo.costEffect(input.companyId, result.costEffectId);
    if (!effect) throw new Error('allocation cost effect was not persisted');

    if (effect.status !== 'COMPLETED') {
      const ownerEffect = await this.cost.recordAllocationAdjustment({
        companyId: input.companyId,
        effectId: effect.id,
        program: effect.program,
        allocationId: effect.allocationId,
        previousQuantity: effect.previousQuantity,
        newQuantity: effect.newQuantity,
        costAmount: effect.costAmount,
        postingDate: effect.postingDate,
      });
      await this.repo.completeCostEffect(input.companyId, effect.id, ownerEffect.id);
    }
    return result.allocation;
  }

  consumeFlightBlock(
    input: ConsumeFlightBlockInput,
    key?: string,
  ): Promise<FlightBlockConsumption> {
    positiveQuantity(input.seats);
    return this.repo.consumeFlight(input, key, idempotencyHash(input));
  }

  async fulfillWithInternalFirst(
    input: InternalFirstFulfillmentInput,
    key?: string,
  ): Promise<AllocationResult> {
    positiveQuantity(input.requiredQuantity);
    if (input.contractType === 'FLIGHT_BLOCK' && !input.flightSegmentReference) {
      throw new Error('real flight-segment evidence is required');
    }
    if (input.contractType === 'VISA' && !input.visaBatchReference) {
      throw new Error('visa batch evidence is required');
    }

    const result = await this.repo.internalFirst(input, key, idempotencyHash(input));
    if (result.procurementRequest && !result.procurementRequest.externalReference) {
      const ownerReference = await this.procurement.requestResidual({
        companyId: input.companyId,
        branchId: input.branchId,
        requestId: result.procurementRequest.id,
        supplierId: input.supplierId,
        type: input.contractType,
        quantity: result.procurementRequest.residualQuantity,
        program: input.program,
        referenceData: input.referenceData,
      });
      await this.repo.attachProcurementReference(
        input.companyId,
        result.procurementRequest.id,
        ownerReference,
      );
      return {
        ...result,
        procurementRequest: {
          ...result.procurementRequest,
          externalReference: ownerReference,
        },
      };
    }
    return result;
  }

  registerAllocationEconomicEvidence(
    input: RegisterAllocationEconomicEvidenceInput,
    key?: string,
  ) {
    return this.repo.registerEconomicEvidence(input, key, idempotencyHash(input));
  }

  protectAllocationCoverage(input: ProtectAllocationCoverageInput, key?: string) {
    positiveQuantity(input.minimumQuantity);
    return this.repo.protectCoverage(input, key, idempotencyHash(input));
  }

  releaseAllocationCoverage(input: ReleaseAllocationCoverageInput, key?: string) {
    return this.repo.releaseCoverage(input, key, idempotencyHash(input));
  }

  getReleaseBlockers(companyId: CompanyId, allocationId: string) {
    return this.repo.releaseBlockers(companyId, allocationId);
  }

  async checkIdempotency(companyId: CompanyId, key: string): Promise<IdempotencyCheckResult> {
    const prior = await this.repo.idempotency(companyId, key);
    return prior ? { exists: true, priorResult: prior.result } : { exists: false };
  }
}
