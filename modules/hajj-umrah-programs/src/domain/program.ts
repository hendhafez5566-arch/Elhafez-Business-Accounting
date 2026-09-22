import type { CompanyId, DecimalAmount } from '@elhafez/contracts';

export type ProgramType = 'HAJJ' | 'UMRAH';
export type ProgramStatus = 'PREPARING' | 'BOOKABLE' | 'IN_TRIP' | 'CLOSED' | 'CANCELLED';
export type Requirement =
  | 'HOTEL'
  | 'FLIGHT'
  | 'TRANSPORT'
  | 'VISA'
  | 'MEAL'
  | 'VISIT'
  | 'GUIDE'
  | 'RAWDA'
  | 'INSURANCE'
  | 'HEALTH'
  | 'CAMP'
  | 'PERMIT';
export type ComponentType = Requirement | 'MEETING' | 'CUSTOM';

export interface ProgramComponent {
  readonly type: ComponentType;
  readonly title: string;
  readonly sequence: number;
  readonly start?: string;
  readonly end?: string;
  readonly city?: string;
  readonly route?: string;
  readonly description?: string;
  readonly inventoryReference?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface ProgramPrices {
  readonly single?: DecimalAmount;
  readonly double?: DecimalAmount;
  readonly triple?: DecimalAmount;
  readonly quad?: DecimalAmount;
  readonly quint?: DecimalAmount;
  readonly childWithBed?: DecimalAmount;
  readonly childWithoutBed?: DecimalAmount;
  readonly infant?: DecimalAmount;
}

export interface ProgramSnapshot {
  readonly departureDate: string;
  readonly returnDate: string;
  readonly salesStart: string;
  readonly salesClose: string;
  readonly capacity: string;
  readonly currency: string;
  readonly prices: ProgramPrices;
  readonly requirements: Requirement[];
  readonly components: ProgramComponent[];
  readonly cancellationPolicy?: string;
}

export interface ProgramVersionSnapshot {
  readonly code: string;
  readonly type: ProgramType;
  readonly seasonId: string;
  readonly arabicName: string;
  readonly englishName?: string;
  readonly groupNumber?: string;
  readonly groupDescription?: string;
  readonly snapshot: ProgramSnapshot;
  readonly temporaryHoldMinutes: number;
  readonly minimumDepositPolicy?: string;
  readonly notes?: string;
  readonly operationsManager?: string;
  readonly groupLeader?: string;
  readonly guide?: string;
  readonly contact?: string;
}

export interface Program extends ProgramVersionSnapshot {
  readonly id: string;
  readonly companyId: CompanyId;
  readonly branchId: string;
  readonly status: ProgramStatus;
  readonly bookingOpen: boolean;
  readonly currentVersion: number;
  readonly currentVersionId: string;
  readonly departureRecordedAt?: string;
  readonly returnRecordedAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ProgramVersion {
  readonly id: string;
  readonly companyId: CompanyId;
  readonly branchId: string;
  readonly programId: string;
  readonly version: number;
  readonly snapshot: ProgramVersionSnapshot;
  readonly effectiveAt: string;
  readonly reason: string;
  readonly actorId: string;
  readonly supersedesId?: string;
}

export interface ProgramHistory {
  readonly id: string;
  readonly companyId: CompanyId;
  readonly branchId: string;
  readonly programId: string;
  readonly action: string;
  readonly reason?: string;
  readonly actorId: string;
  readonly occurredAt: string;
}
