import type { CompanyId, DecimalAmount } from '@elhafez/contracts';

export type StandaloneServiceCategory = 'HOTEL' | 'FLIGHT' | 'VISA' | 'TRANSPORT' | 'OTHER';
export type StandaloneServiceStatus = 'DRAFT' | 'CONFIRMING' | 'CONFIRMED' | 'CANCELLATION_REQUESTED' | 'CANCELLED' | 'COMPLETED';
export type DebtorKind = 'CUSTOMER' | 'AGENT';

export interface ServiceType {
  readonly id: string;
  readonly companyId: CompanyId;
  readonly code: string;
  readonly category: StandaloneServiceCategory;
  readonly nameAr: string;
  readonly active: boolean;
}

export interface CommercialSnapshot {
  readonly currency: string;
  readonly grossAmount: DecimalAmount;
  readonly discountAmount: DecimalAmount;
  readonly netAmount: DecimalAmount;
}

export interface ServiceRevision {
  readonly serviceId: string;
  readonly revision: number;
  readonly serviceTypeId: string;
  readonly category: StandaloneServiceCategory;
  readonly serviceDate: string;
  readonly periodEnd?: string;
  readonly quantity: DecimalAmount;
  readonly debtorKind: DebtorKind;
  readonly debtorPartyId: string;
  readonly customerPartyId: string;
  readonly beneficiaryPartyIds: readonly string[];
  readonly details: Readonly<Record<string, unknown>>;
  readonly commercial: CommercialSnapshot;
  readonly createdAt: string;
}

export interface StandaloneService {
  readonly id: string;
  readonly companyId: CompanyId;
  readonly branchId: string;
  readonly number: string;
  readonly status: StandaloneServiceStatus;
  readonly revision: number;
  readonly confirmedRevision?: number;
  readonly externalOperationId?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ServiceHistoryEntry {
  readonly id: string;
  readonly serviceId: string;
  readonly revision: number;
  readonly kind: 'DRAFTED' | 'AMENDED' | 'CONFIRMATION_STARTED' | 'CONFIRMED' | 'CANCELLATION_REQUESTED' | 'CANCELLED' | 'REOPENED';
  readonly actorId: string;
  readonly evidence?: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
}

export interface CommandReceipt {
  readonly companyId: CompanyId;
  readonly commandKey: string;
  readonly payloadHash: string;
  readonly result: Readonly<Record<string, unknown>>;
}
