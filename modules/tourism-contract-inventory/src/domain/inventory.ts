import type { CompanyId, DecimalAmount, SourceReference } from '@elhafez/contracts';

declare const contractIdBrand: unique symbol;
export type ContractId = string & { readonly [contractIdBrand]: 'ContractId' };

declare const allocationIdBrand: unique symbol;
export type AllocationId = string & { readonly [allocationIdBrand]: 'AllocationId' };

declare const hotelInventoryIdBrand: unique symbol;
export type HotelInventoryId = string & { readonly [hotelInventoryIdBrand]: 'HotelInventoryId' };

declare const flightBlockIdBrand: unique symbol;
export type FlightBlockId = string & { readonly [flightBlockIdBrand]: 'FlightBlockId' };

declare const transportCapacityIdBrand: unique symbol;
export type TransportCapacityId = string & { readonly [transportCapacityIdBrand]: 'TransportCapacityId' };

declare const visaQuotaIdBrand: unique symbol;
export type VisaQuotaId = string & { readonly [visaQuotaIdBrand]: 'VisaQuotaId' };

declare const stopSaleIdBrand: unique symbol;
export type StopSaleId = string & { readonly [stopSaleIdBrand]: 'StopSaleId' };

export type ContractType = 'HOTEL' | 'FLIGHT_BLOCK' | 'TRANSPORT' | 'VISA';
export type ContractStatus = 'DRAFT' | 'ACTIVE' | 'AMENDED' | 'EXPIRED' | 'CANCELLED';
export type CapacitySourceType = 'OWNED' | 'CONTRACTED' | 'PROCURED';

export interface TourismContract {
  readonly id: ContractId;
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
  readonly contractId: ContractId;
  readonly versionNumber: number;
  readonly effectiveFrom: string;
  readonly effectiveTo?: string;
  readonly terms: Record<string, unknown>;
  readonly createdAt: string;
  readonly isCurrent: boolean;
}

export interface HotelInventory {
  readonly id: HotelInventoryId;
  readonly companyId: CompanyId;
  readonly contractId: ContractId;
  readonly hotelId: string;
  readonly roomId?: string;
  readonly serviceDate: string;
  readonly contractedQuantity: DecimalAmount;
  readonly allocatedQuantity: DecimalAmount;
  readonly availableQuantity: DecimalAmount;
  readonly status: 'ACTIVE' | 'STOP_SALE' | 'EXPIRED';
}

export interface FlightBlock {
  readonly id: FlightBlockId;
  readonly companyId: CompanyId;
  readonly contractId: ContractId;
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
  readonly flightBlockId: FlightBlockId;
  readonly program: SourceReference;
  readonly consumedSeats: DecimalAmount;
  readonly consumedAt: string;
  readonly sourceReference?: SourceReference;
}

export interface TransportCapacity {
  readonly id: TransportCapacityId;
  readonly companyId: CompanyId;
  readonly contractId: ContractId;
  readonly vehicleId: string;
  readonly capacityUnits: DecimalAmount;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly consumedUnits: DecimalAmount;
}

export interface VisaQuota {
  readonly id: VisaQuotaId;
  readonly companyId: CompanyId;
  readonly contractId: ContractId;
  readonly visaType: string;
  readonly nationality?: string;
  readonly quotaTotal: DecimalAmount;
  readonly quotaConsumed: DecimalAmount;
  readonly quotaRemaining: DecimalAmount;
  readonly effectiveFrom: string;
  readonly effectiveTo: string;
}

export interface StopSale {
  readonly id: StopSaleId;
  readonly companyId: CompanyId;
  readonly contractId: ContractId;
  readonly reason: string;
  readonly effectiveFrom: string;
  readonly effectiveTo: string;
  readonly createdAt: string;
  readonly isActive: boolean;
}

export type AllocationStatus = 'PENDING' | 'CONFIRMED' | 'RELEASED' | 'CONSUMED' | 'BLOCKED';

export interface Allocation {
  readonly id: AllocationId;
  readonly companyId: CompanyId;
  readonly contractId: ContractId;
  readonly program: SourceReference;
  readonly serviceDate: string;
  readonly quantity: DecimalAmount;
  readonly status: AllocationStatus;
  readonly releaseBlockerReason?: string;
  readonly createdAt: string;
  readonly sourceReference?: SourceReference;
}

export interface AllocationRelease {
  readonly id: string;
  readonly companyId: CompanyId;
  readonly allocationId: AllocationId;
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
  readonly referenceData: Record<string, unknown>;
  readonly createdAt: string;
  readonly sourceReference?: SourceReference;
}

export interface IdempotencyKey {
  readonly id: string;
  readonly companyId: CompanyId;
  readonly key: string;
  readonly requestHash: string;
  readonly result: Record<string, unknown>;
  readonly createdAt: string;
}

export interface ContractHistory {
  readonly id: string;
  readonly companyId: CompanyId;
  readonly contractId: ContractId;
  readonly kind: string;
  readonly aggregateId: string;
  readonly sourceReference?: string;
  readonly createdAt: string;
}
