import { randomUUID } from 'node:crypto';
import {
  ContractValidationError,
  decimalAmount,
  type ExecutionContext,
} from '@elhafez/contracts';
import type {
  Program,
  ProgramComponent,
  ProgramHistory,
  ProgramPrices,
  ProgramSnapshot,
  ProgramType,
  ProgramVersion,
  ProgramVersionSnapshot,
  Requirement,
} from '../domain/program.js';
import type { ProgramRepository } from './program.repository.js';
import type {
  ProgramAccess,
  ReopenGuard,
  SeasonPort,
  SupplyEvidenceCheck,
  SupplyPort,
} from './program.ports.js';

export const PROGRAM_PERMISSIONS = Object.freeze({
  view: 'hajj_umrah.programs.view',
  create: 'hajj_umrah.programs.create',
  edit: 'hajj_umrah.programs.edit',
  amend: 'hajj_umrah.programs.amend',
  availability: 'hajj_umrah.programs.availability',
  lifecycle: 'hajj_umrah.programs.lifecycle',
  cancel: 'hajj_umrah.programs.cancel',
  reopen: 'hajj_umrah.programs.reopen',
});

const defaults: Record<ProgramType, Requirement[]> = {
  HAJJ: ['HOTEL', 'FLIGHT', 'TRANSPORT', 'CAMP', 'PERMIT'],
  UMRAH: ['HOTEL', 'FLIGHT', 'TRANSPORT'],
};

const serviceCategory = new Set<Requirement>([
  'CAMP',
  'MEAL',
  'VISIT',
  'GUIDE',
  'RAWDA',
  'INSURANCE',
]);

export interface ProgramInput {
  code: string;
  type: ProgramType;
  seasonId: string;
  arabicName: string;
  englishName?: string;
  groupNumber?: string;
  groupDescription?: string;
  departureDate: string;
  returnDate: string;
  salesStart: string;
  salesClose: string;
  capacity: string;
  currency: string;
  prices: ProgramPrices;
  requirements?: Requirement[];
  components?: ProgramComponent[];
  temporaryHoldMinutes?: number;
  minimumDepositPolicy?: string;
  cancellationPolicy?: string;
  notes?: string;
  operationsManager?: string;
  groupLeader?: string;
  guide?: string;
  contact?: string;
}

const required = (value: string, field: string) => {
  const result = value.trim();
  if (!result) throw new ContractValidationError(field, 'is required');
  return result;
};
const optional = (value?: string) => {
  const result = value?.trim();
  return result ? result : undefined;
};
const unique = <T>(values: T[]) => [...new Set(values)];

function normalized(input: ProgramInput): ProgramSnapshot {
  if (input.returnDate < input.departureDate) {
    throw new ContractValidationError('returnDate', 'must be on or after departureDate');
  }
  if (input.salesClose < input.salesStart) {
    throw new ContractValidationError('salesClose', 'must be on or after salesStart');
  }
  const capacity = decimalAmount(input.capacity);
  if (capacity.startsWith('-') || capacity === '0') {
    throw new ContractValidationError('capacity', 'must be positive');
  }
  const prices = Object.fromEntries(
    Object.entries(input.prices).map(([key, value]) => {
      const amount = decimalAmount(value);
      if (amount.startsWith('-')) {
        throw new ContractValidationError(`prices.${key}`, 'must not be negative');
      }
      return [key, amount];
    }),
  ) as ProgramPrices;
  const components = [...(input.components ?? [])].sort(
    (left, right) => left.sequence - right.sequence,
  );
  if (new Set(components.map((item) => item.sequence)).size !== components.length) {
    throw new ContractValidationError('components', 'sequence must be unique');
  }
  return {
    departureDate: input.departureDate,
    returnDate: input.returnDate,
    salesStart: input.salesStart,
    salesClose: input.salesClose,
    capacity,
    currency: required(input.currency, 'currency').toUpperCase(),
    prices,
    requirements: unique(input.requirements ?? defaults[input.type]),
    components,
    ...(optional(input.cancellationPolicy)
      ? { cancellationPolicy: optional(input.cancellationPolicy)! }
      : {}),
  };
}

function definition(input: ProgramInput, snapshot: ProgramSnapshot): ProgramVersionSnapshot {
  return {
    code: required(input.code, 'code'),
    type: input.type,
    seasonId: required(input.seasonId, 'seasonId'),
    arabicName: required(input.arabicName, 'arabicName'),
    ...(optional(input.englishName) ? { englishName: optional(input.englishName)! } : {}),
    ...(optional(input.groupNumber) ? { groupNumber: optional(input.groupNumber)! } : {}),
    ...(optional(input.groupDescription)
      ? { groupDescription: optional(input.groupDescription)! }
      : {}),
    snapshot,
    temporaryHoldMinutes: input.temporaryHoldMinutes ?? 15,
    ...(optional(input.minimumDepositPolicy)
      ? { minimumDepositPolicy: optional(input.minimumDepositPolicy)! }
      : {}),
    ...(optional(input.notes) ? { notes: optional(input.notes)! } : {}),
    ...(optional(input.operationsManager)
      ? { operationsManager: optional(input.operationsManager)! }
      : {}),
    ...(optional(input.groupLeader) ? { groupLeader: optional(input.groupLeader)! } : {}),
    ...(optional(input.guide) ? { guide: optional(input.guide)! } : {}),
    ...(optional(input.contact) ? { contact: optional(input.contact)! } : {}),
  };
}

function replaceDefinition(
  program: Program,
  value: ProgramVersionSnapshot,
  updatedAt: string,
): Program {
  return {
    id: program.id,
    companyId: program.companyId,
    branchId: program.branchId,
    ...value,
    status: program.status,
    bookingOpen: program.bookingOpen,
    currentVersion: program.currentVersion,
    currentVersionId: program.currentVersionId,
    ...(program.departureRecordedAt ? { departureRecordedAt: program.departureRecordedAt } : {}),
    ...(program.returnRecordedAt ? { returnRecordedAt: program.returnRecordedAt } : {}),
    createdAt: program.createdAt,
    updatedAt,
  };
}

function supplyCheck(
  program: Program,
  requirement: Requirement,
  component: ProgramComponent,
): SupplyEvidenceCheck | null {
  if (requirement === 'HEALTH') return null;
  const resourceId = component.inventoryReference;
  if (!resourceId) return null;
  const common = {
    companyId: program.companyId,
    branchId: program.branchId,
    programId: program.id,
    requirement,
    resourceId,
    serviceDate: component.start ?? program.snapshot.departureDate,
  };
  if (requirement === 'HOTEL') return { ...common, resourceType: 'HOTEL' };
  if (requirement === 'FLIGHT') return { ...common, resourceType: 'FLIGHT_BLOCK' };
  if (requirement === 'TRANSPORT') {
    return {
      ...common,
      resourceType: 'TRANSPORT',
      periodEnd: component.end ?? program.snapshot.returnDate,
    };
  }
  if (requirement === 'VISA') return { ...common, resourceType: 'VISA' };
  if (requirement === 'PERMIT') {
    return {
      ...common,
      resourceType: 'SERVICE',
      ...(component.end ? { periodEnd: component.end } : {}),
    };
  }
  if (serviceCategory.has(requirement)) {
    return {
      ...common,
      resourceType: 'SERVICE',
      serviceCategory: requirement as SupplyEvidenceCheck['serviceCategory'],
      ...(component.end ? { periodEnd: component.end } : {}),
    };
  }
  return null;
}

export class HajjUmrahProgramsApplicationService {
  constructor(
    private readonly repo: ProgramRepository,
    private readonly access: ProgramAccess,
    private readonly seasons: SeasonPort,
    private readonly supply: SupplyPort,
    private readonly guard: ReopenGuard,
    private readonly now: () => Date = () => new Date(),
    private readonly id: () => string = () => randomUUID(),
  ) {}

  private async permission(context: ExecutionContext, permission: string) {
    await this.access.requireBranch(context);
    await this.access.requirePermission(context, permission);
  }

  private history(
    context: ExecutionContext,
    id: string,
    action: string,
    reason?: string,
  ): ProgramHistory {
    return {
      id: this.id(),
      companyId: context.companyId,
      branchId: context.branchId,
      programId: id,
      action,
      ...(reason ? { reason } : {}),
      actorId: context.actorId,
      occurredAt: this.now().toISOString(),
    };
  }

  private version(
    context: ExecutionContext,
    id: string,
    number: number,
    snapshot: ProgramVersionSnapshot,
    reason: string,
    supersedesId?: string,
  ): ProgramVersion {
    return {
      id: this.id(),
      companyId: context.companyId,
      branchId: context.branchId,
      programId: id,
      version: number,
      snapshot,
      effectiveAt: this.now().toISOString(),
      reason,
      actorId: context.actorId,
      ...(supersedesId ? { supersedesId } : {}),
    };
  }

  async create(context: ExecutionContext, input: ProgramInput) {
    await this.permission(context, PROGRAM_PERMISSIONS.create);
    const packageSnapshot = normalized(input);
    await this.seasons.validate(
      context.companyId,
      context.branchId,
      input.seasonId,
      packageSnapshot.departureDate,
      packageSnapshot.returnDate,
    );
    const material = definition(input, packageSnapshot);
    const at = this.now().toISOString();
    const id = this.id();
    const version = this.version(context, id, 1, material, 'Initial version');
    const value: Program = {
      id,
      companyId: context.companyId,
      branchId: context.branchId,
      ...material,
      status: 'PREPARING',
      bookingOpen: false,
      currentVersion: 1,
      currentVersionId: version.id,
      createdAt: at,
      updatedAt: at,
    };
    return this.repo.create(value, version, this.history(context, id, 'CREATED'));
  }

  async get(context: ExecutionContext, id: string) {
    await this.permission(context, PROGRAM_PERMISSIONS.view);
    return this.required(context, id);
  }

  async getForIntegration(context: ExecutionContext, id: string) {
    await this.access.requireBranch(context);
    return this.required(context, id);
  }

  async closeAfterReadinessForIntegration(
    context: ExecutionContext,
    id: string,
    expectedUpdatedAt: string,
  ) {
    await this.access.requireBranch(context);
    const old = await this.required(context, id);
    if (old.status === 'CLOSED') return old;
    if (old.status !== 'IN_TRIP' || !old.departureRecordedAt) {
      throw new ContractValidationError('status', 'closure requires recorded departure');
    }
    if (old.updatedAt !== expectedUpdatedAt) {
      throw new ContractValidationError('program', 'program changed during closure; readiness must be re-evaluated');
    }
    const at = this.now().toISOString();
    const next: Program = {
      ...old,
      status: 'CLOSED',
      bookingOpen: false,
      returnRecordedAt: at,
      updatedAt: at,
    };
    const saved = await this.repo.closeReturnedGuarded(
      next,
      this.history(context, id, 'RETURN_RECORDED'),
      expectedUpdatedAt,
    );
    if (saved) return saved;
    const current = await this.required(context, id);
    if (current.status === 'CLOSED') return current;
    throw new ContractValidationError(
      'program',
      'program changed during closure; readiness must be re-evaluated',
    );
  }

  async list(context: ExecutionContext) {
    await this.permission(context, PROGRAM_PERMISSIONS.view);
    return this.repo.list(context.companyId, context.branchId);
  }

  async editPreparing(context: ExecutionContext, id: string, input: ProgramInput) {
    await this.permission(context, PROGRAM_PERMISSIONS.edit);
    const old = await this.required(context, id);
    if (old.status !== 'PREPARING') {
      throw new ContractValidationError(
        'status',
        'material changes require an amendment after booking opens',
      );
    }
    const packageSnapshot = normalized(input);
    await this.seasons.validate(
      context.companyId,
      context.branchId,
      input.seasonId,
      packageSnapshot.departureDate,
      packageSnapshot.returnDate,
    );
    const material = definition(input, packageSnapshot);
    const version = this.version(
      context,
      id,
      old.currentVersion + 1,
      material,
      'Preparing edit',
      old.currentVersionId,
    );
    const value = replaceDefinition(old, material, this.now().toISOString());
    return this.repo.save(
      { ...value, currentVersion: version.version, currentVersionId: version.id },
      this.history(context, id, 'UPDATED'),
      version,
    );
  }

  async amend(
    context: ExecutionContext,
    id: string,
    input: ProgramInput,
    reason: string,
  ) {
    await this.permission(context, PROGRAM_PERMISSIONS.amend);
    const cleanReason = required(reason, 'reason');
    const old = await this.required(context, id);
    if (old.status === 'PREPARING') {
      throw new ContractValidationError('status', 'use preparing edit before booking opens');
    }
    if (old.status === 'CANCELLED') {
      throw new ContractValidationError('status', 'cancelled program cannot be amended');
    }
    const packageSnapshot = normalized(input);
    await this.seasons.validate(
      context.companyId,
      context.branchId,
      input.seasonId,
      packageSnapshot.departureDate,
      packageSnapshot.returnDate,
    );
    const material = definition(input, packageSnapshot);
    const version = this.version(
      context,
      id,
      old.currentVersion + 1,
      material,
      cleanReason,
      old.currentVersionId,
    );
    const value = replaceDefinition(old, material, this.now().toISOString());
    return this.repo.save(
      { ...value, currentVersion: version.version, currentVersionId: version.id },
      this.history(context, id, 'AMENDED', cleanReason),
      version,
    );
  }

  async openForBooking(context: ExecutionContext, id: string) {
    await this.permission(context, PROGRAM_PERMISSIONS.lifecycle);
    const old = await this.required(context, id);
    if (old.status !== 'PREPARING') {
      throw new ContractValidationError('status', 'program is not preparing');
    }
    await this.seasons.validate(
      context.companyId,
      context.branchId,
      old.seasonId,
      old.snapshot.departureDate,
      old.snapshot.returnDate,
    );
    if (!Object.keys(old.snapshot.prices).length) {
      throw new ContractValidationError('prices', 'at least one selling price is required');
    }

    for (const requirement of old.snapshot.requirements) {
      if (requirement === 'HEALTH') continue;
      const candidates = old.snapshot.components
        .filter((component) => component.type === requirement)
        .map((component) => supplyCheck(old, requirement, component))
        .filter((value): value is SupplyEvidenceCheck => value !== null);
      if (!candidates.length) {
        throw new ContractValidationError(
          'supply',
          `missing required supply evidence: ${requirement}`,
        );
      }
      let found = false;
      for (const candidate of candidates) {
        if (await this.supply.hasEvidence(candidate)) {
          found = true;
          break;
        }
      }
      if (!found) {
        throw new ContractValidationError(
          'supply',
          `missing required supply evidence: ${requirement}`,
        );
      }
    }

    return this.saveStatus(context, old, 'BOOKABLE', 'OPENED_FOR_BOOKING', true);
  }

  async setBookingAvailability(context: ExecutionContext, id: string, open: boolean) {
    await this.permission(context, PROGRAM_PERMISSIONS.availability);
    const old = await this.required(context, id);
    if (old.status !== 'BOOKABLE') {
      throw new ContractValidationError(
        'status',
        'booking availability belongs to BOOKABLE programs',
      );
    }
    return this.repo.save(
      { ...old, bookingOpen: open, updatedAt: this.now().toISOString() },
      this.history(context, id, open ? 'BOOKING_OPENED' : 'BOOKING_CLOSED'),
    );
  }

  async recordDeparture(context: ExecutionContext, id: string) {
    await this.permission(context, PROGRAM_PERMISSIONS.lifecycle);
    const old = await this.required(context, id);
    if (old.status !== 'BOOKABLE') {
      throw new ContractValidationError('status', 'departure requires a bookable program');
    }
    return this.repo.save(
      {
        ...old,
        status: 'IN_TRIP',
        bookingOpen: false,
        departureRecordedAt: this.now().toISOString(),
        updatedAt: this.now().toISOString(),
      },
      this.history(context, id, 'DEPARTURE_RECORDED'),
    );
  }

  async recordReturn(context: ExecutionContext, id: string) {
    await this.permission(context, PROGRAM_PERMISSIONS.lifecycle);
    const old = await this.required(context, id);
    return this.closeAfterReadinessForIntegration(context, id, old.updatedAt);
  }

  async cancel(context: ExecutionContext, id: string, reason: string) {
    await this.permission(context, PROGRAM_PERMISSIONS.cancel);
    const cleanReason = required(reason, 'reason');
    const old = await this.required(context, id);
    if (!['PREPARING', 'BOOKABLE'].includes(old.status)) {
      throw new ContractValidationError(
        'status',
        'program cannot be cancelled after travel starts',
      );
    }
    return this.saveStatus(
      context,
      old,
      'CANCELLED',
      'CANCELLED',
      false,
      cleanReason,
    );
  }

  async reopen(context: ExecutionContext, id: string, reason: string) {
    await this.permission(context, PROGRAM_PERMISSIONS.reopen);
    const cleanReason = required(reason, 'reason');
    const old = await this.required(context, id);
    if (old.status !== 'CLOSED' || !old.returnRecordedAt) {
      throw new ContractValidationError(
        'status',
        'only a returned closed program can be reopened',
      );
    }
    await this.guard.assertOpen(
      context.companyId,
      context.branchId,
      old.returnRecordedAt,
    );
    const result = await this.saveStatus(
      context,
      old,
      'IN_TRIP',
      'REOPENED',
      false,
      cleanReason,
    );
    await this.access.audit(context, 'hajj-umrah.program.reopened', id, {
      reason: cleanReason,
    });
    return result;
  }

  async versions(context: ExecutionContext, id: string) {
    await this.permission(context, PROGRAM_PERMISSIONS.view);
    await this.required(context, id);
    return this.repo.versions(context.companyId, context.branchId, id);
  }

  private saveStatus(
    context: ExecutionContext,
    program: Program,
    status: Program['status'],
    action: string,
    bookingOpen: boolean,
    reason?: string,
  ) {
    return this.repo.save(
      { ...program, status, bookingOpen, updatedAt: this.now().toISOString() },
      this.history(context, program.id, action, reason),
    );
  }

  private async required(context: ExecutionContext, id: string) {
    const value = await this.repo.get(context.companyId, context.branchId, id);
    if (!value) throw new ContractValidationError('programId', 'program not found');
    return value;
  }
}
