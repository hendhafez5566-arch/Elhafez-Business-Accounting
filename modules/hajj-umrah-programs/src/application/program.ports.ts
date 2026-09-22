import type { CompanyId, ExecutionContext } from '@elhafez/contracts';
import type { Requirement } from '../domain/program.js';

export interface ProgramAccess {
  requireBranch(context: ExecutionContext): Promise<void>;
  requirePermission(context: ExecutionContext, permission: string): Promise<void>;
  audit(
    context: ExecutionContext,
    action: string,
    id: string,
    metadata?: Record<string, unknown>,
  ): Promise<void>;
}

export interface SeasonPort {
  validate(
    companyId: CompanyId,
    branchId: string,
    seasonId: string,
    start: string,
    end: string,
  ): Promise<void>;
}

export interface SupplyEvidenceCheck {
  readonly companyId: CompanyId;
  readonly branchId: string;
  readonly programId: string;
  readonly requirement: Requirement;
  readonly resourceType: 'HOTEL' | 'FLIGHT_BLOCK' | 'TRANSPORT' | 'VISA' | 'SERVICE';
  readonly resourceId: string;
  readonly serviceDate: string;
  readonly periodEnd?: string;
  readonly serviceCategory?: 'CAMP' | 'MEAL' | 'VISIT' | 'GUIDE' | 'RAWDA' | 'INSURANCE' | 'OTHER';
}

export interface SupplyPort {
  hasEvidence(input: SupplyEvidenceCheck): Promise<boolean>;
}

export interface ReopenGuard {
  assertOpen(
    companyId: CompanyId,
    branchId: string,
    accountingDateEvidence: string,
  ): Promise<void>;
}

export const PROGRAM_ACCESS = Symbol('PROGRAM_ACCESS');
export const SEASON_PORT = Symbol('SEASON_PORT');
export const SUPPLY_PORT = Symbol('SUPPLY_PORT');
export const REOPEN_GUARD = Symbol('REOPEN_GUARD');
