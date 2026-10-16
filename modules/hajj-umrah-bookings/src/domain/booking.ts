import type { CompanyId, SourceReference } from '@elhafez/contracts';

export type BookingStatus =
  | 'PRELIMINARY'
  | 'CONFIRMED'
  | 'READY'
  | 'TRAVELING'
  | 'COMPLETED'
  | 'CANCELLED';

export type BookingFinancialState =
  | 'UNCONFIRMED'
  | 'CONFIRMED'
  | 'CANCELLATION_BLOCKED'
  | 'CANCELLED';

export interface BookingCommissionAgreement { readonly agreementId:string; readonly agreementVersion:number; readonly principalPartyId:string; readonly subordinatePartyId:string; readonly principalPercent:string; }

export interface BookingCapacityHold {readonly commandKey:string;readonly hash:string;readonly expiresAt:string;readonly state:'REQUESTED'|'HELD'|'ADOPTED'|'RELEASED';readonly inventory:{readonly allocationId:string;readonly contractId:string;readonly resourceType:string;readonly resourceId:string;readonly serviceDate:string;readonly quantity:string;readonly periodEnd?:string;readonly flightSegmentReference?:SourceReference;readonly visaBatchReference?:SourceReference};readonly evidence?:unknown;}
export interface Booking {
  readonly capacityHold?:BookingCapacityHold;
  readonly revision?:number;
  readonly createRequestHash?:string;
  readonly createRequestId?:string;
  readonly commissionAgreement?: BookingCommissionAgreement;
  readonly id: string;
  readonly companyId: CompanyId;
  readonly branchId: string;
  readonly code: string;
  readonly programId: string;
  readonly customerId: string;
  readonly customerPartyId: string;
  readonly financialCustomerId?: string;
  readonly financialPartyId?: string;
  readonly familyReference?: string;
  readonly agentId?: string;
  readonly agentPartyId?: string;
  readonly travelerIds: readonly string[];
  readonly status: BookingStatus;
  readonly financialState: BookingFinancialState;
  readonly allocationIds: readonly string[];
  readonly confirmationCommandKey?: string;
  readonly confirmationPayloadHash?: string;
  readonly financialEvidence?: unknown;
  readonly cancellationEvidence?: unknown;
  readonly sourceReference?: SourceReference;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface BookingHistory {
  readonly id: string;
  readonly companyId: CompanyId;
  readonly branchId: string;
  readonly bookingId: string;
  readonly action: string;
  readonly fromStatus?: BookingStatus;
  readonly toStatus?: BookingStatus;
  readonly reason?: string;
  readonly evidence?: unknown;
  readonly actorId: string;
  readonly occurredAt: string;
}
