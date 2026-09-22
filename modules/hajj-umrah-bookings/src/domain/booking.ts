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

export interface Booking {
  readonly id: string;
  readonly companyId: CompanyId;
  readonly branchId: string;
  readonly code: string;
  readonly programId: string;
  readonly customerId: string;
  readonly customerPartyId: string;
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
