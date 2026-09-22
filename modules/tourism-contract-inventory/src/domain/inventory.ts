import type { CompanyId, DecimalAmount, SourceReference } from '@elhafez/contracts';

export type ContractType = 'HOTEL' | 'FLIGHT_BLOCK' | 'TRANSPORT' | 'VISA' | 'SERVICE';
export type ServiceCategory = 'CAMP'|'MEAL'|'VISIT'|'GUIDE'|'RAWDA'|'INSURANCE'|'OTHER';
export type ContractStatus = 'DRAFT' | 'ACTIVE' | 'AMENDED' | 'EXPIRED' | 'CANCELLED';
export type ResourceType = ContractType;
export type AllocationStatus =
  | 'CONFIRMED'
  | 'PARTIALLY_RELEASED'
  | 'RELEASED'
  | 'CONSUMED'
  | 'BLOCKED';

export interface TourismContract {
  readonly id: string;
  readonly companyId: CompanyId;
  readonly type: ContractType;
  readonly status: ContractStatus;
  readonly supplierId?: string;
  readonly effectiveFrom: string;
  readonly effectiveTo: string;
  readonly createdAt: string;
  readonly sourceReference?: SourceReference;
}

export interface ContractVersion {
  readonly id: string;
  readonly companyId: CompanyId;
  readonly contractId: string;
  readonly versionNumber: number;
  readonly effectiveFrom: string;
  readonly effectiveTo?: string;
  readonly terms: Record<string, unknown>;
  readonly createdAt: string;
  readonly isCurrent: boolean;
}

export interface HotelInventory {
  readonly id: string;
  readonly companyId: CompanyId;
  readonly contractId: string;
  readonly hotelId: string;
  readonly roomId?: string;
  readonly serviceDate: string;
  readonly contractedQuantity: DecimalAmount;
  readonly allocatedQuantity: DecimalAmount;
  readonly availableQuantity: DecimalAmount;
  readonly status: 'ACTIVE' | 'STOP_SALE' | 'EXPIRED';
}

export interface FlightBlock {
  readonly id: string;
  readonly companyId: CompanyId;
  readonly contractId: string;
  readonly flightNumber: string;
  readonly origin: string;
  readonly destination: string;
  readonly departureDate: string;
  readonly totalSeats: DecimalAmount;
  readonly consumedSeats: DecimalAmount;
  readonly availableSeats: DecimalAmount;
}

export interface FlightBlockConsumption {
  readonly id: string;
  readonly companyId: CompanyId;
  readonly flightBlockId: string;
  readonly program: SourceReference;
  readonly consumedSeats: DecimalAmount;
  readonly consumedAt: string;
  readonly sourceReference?: SourceReference;
}

export interface TransportCapacity {
  readonly id: string;
  readonly companyId: CompanyId;
  readonly contractId: string;
  readonly vehicleId: string;
  readonly capacityUnits: DecimalAmount;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly consumedUnits: DecimalAmount;
}

export interface VisaQuota {
  readonly id: string;
  readonly companyId: CompanyId;
  readonly contractId: string;
  readonly visaType: string;
  readonly nationality?: string;
  readonly quotaTotal: DecimalAmount;
  readonly quotaConsumed: DecimalAmount;
  readonly quotaRemaining: DecimalAmount;
  readonly effectiveFrom: string;
  readonly effectiveTo: string;
}
export interface GenericServiceInventory {readonly id:string;readonly companyId:CompanyId;readonly contractId:string;readonly category:ServiceCategory;readonly name:string;readonly description?:string;readonly unit:string;readonly serviceStart:string;readonly serviceEnd:string;readonly capacity:DecimalAmount;readonly allocatedQuantity:DecimalAmount;readonly availableQuantity:DecimalAmount;readonly releaseDeadline?:string;readonly status:'ACTIVE'|'STOP_SALE'|'EXPIRED';}

export interface StopSale {
  readonly id: string;
  readonly companyId: CompanyId;
  readonly contractId: string;
  readonly reason: string;
  readonly effectiveFrom: string;
  readonly effectiveTo: string;
  readonly createdAt: string;
  readonly isActive: boolean;
}

export interface Allocation {
  readonly id: string;
  readonly companyId: CompanyId;
  readonly contractId: string;
  readonly contractVersionId: string;
  readonly resourceType: ResourceType;
  readonly resourceId: string;
  readonly program: SourceReference;
  readonly serviceDate: string;
  readonly periodEnd?: string;
  readonly quantity: DecimalAmount;
  readonly status: AllocationStatus;
  readonly releaseBlockerReason?: string;
  readonly visaBatchReference?: SourceReference;
  readonly createdAt: string;
  readonly sourceReference?: SourceReference;
}

export interface AllocationRelease {
  readonly id: string;
  readonly companyId: CompanyId;
  readonly allocationId: string;
  readonly releasedQuantity: DecimalAmount;
  readonly blockerEvidence?: string;
  readonly releasedAt: string;
  readonly status: 'SUCCESS' | 'BLOCKED';
}

export interface ProcurementRequest {
  readonly id: string;
  readonly companyId: CompanyId;
  readonly program: SourceReference;
  readonly residualQuantity: DecimalAmount;
  readonly procurementType: ContractType;
  readonly externalReference: string;
  readonly referenceData: Record<string, unknown>;
  readonly createdAt: string;
  readonly sourceReference?: SourceReference;
}

export interface AllocationCostEffect {
  readonly id: string;
  readonly companyId: CompanyId;
  readonly allocationId: string;
  readonly program: SourceReference;
  readonly previousQuantity: DecimalAmount;
  readonly newQuantity: DecimalAmount;
  readonly costAmount: DecimalAmount;
  readonly postingDate: string;
  readonly status: 'PENDING' | 'COMPLETED';
  readonly ownerReference?: string;
  readonly requestHash: string;
  readonly createdAt: string;
  readonly completedAt?: string;
}

export interface AllocationEconomicEvidence {
  readonly id: string;
  readonly companyId: CompanyId;
  readonly allocationId: string;
  readonly kind: string;
  readonly evidence: SourceReference;
  readonly createdAt: string;
}

export interface AllocationCoverageRequirement {
  readonly id: string;
  readonly companyId: CompanyId;
  readonly allocationId: string;
  readonly minimumQuantity: DecimalAmount;
  readonly requirementReference: SourceReference;
  readonly active: boolean;
  readonly createdAt: string;
  readonly releasedAt?: string;
}

export interface ReleaseBlocker {
  readonly code: 'CONSUMED' | 'FINANCIAL_HISTORY' | 'PROGRAM_COVERAGE' | 'RELEASE_DEADLINE';
  readonly message: string;
  readonly evidence?: SourceReference;
}

export interface ContractHistory {
  readonly id: string;
  readonly companyId: CompanyId;
  readonly contractId: string;
  readonly kind: string;
  readonly aggregateId: string;
  readonly evidence?: Record<string, unknown>;
  readonly createdAt: string;
}
