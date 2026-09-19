import assert from 'node:assert/strict';
import test from 'node:test';
import {
  companyId,
  decimalAmount,
  sourceReference,
  type CompanyId,
  type DecimalAmount,
} from '@elhafez/contracts';
import type {
  AdjustAllocationInput,
  AllocateCapacityInput,
  AllocationResult,
  CheckAvailabilityInput,
  ConsumeFlightBlockInput,
  InternalFirstFulfillmentInput,
  ProtectAllocationCoverageInput,
  RegisterAllocationEconomicEvidenceInput,
  ReleaseAllocationCoverageInput,
  ReleaseAllocationInput,
} from './application/inventory.application-service.js';
import { TourismContractInventoryApplicationServiceImpl } from './application/tourism-contract-inventory.application-service.impl.js';
import { idempotencyHash } from './application/idempotency-hash.js';
import type {
  Allocation,
  AllocationCostEffect,
  AllocationCoverageRequirement,
  AllocationEconomicEvidence,
  ContractType,
  FlightBlockConsumption,
  ReleaseBlocker,
} from './domain/inventory.js';
import type {
  AdjustmentResult,
  TourismInventoryRepository,
} from './infrastructure/inventory.repository.js';

const company = companyId('11111111-1111-4111-8111-111111111111');
const other = companyId('22222222-2222-4222-8222-222222222222');
const program = sourceReference('TOUR_PROGRAM', 'program-1');
const segment = sourceReference('FLIGHT_SEGMENT', 'segment-1');
const visaBatch = sourceReference('VISA_BATCH', 'batch-1');
const quantity = (value: string) => decimalAmount(value);

const scaled = (value: DecimalAmount): bigint => {
  const [whole = '0', fraction = ''] = value.split('.');
  return BigInt(whole) * 10n ** 18n + BigInt(fraction.padEnd(18, '0'));
};

const decimal = (value: bigint): DecimalAmount => {
  const whole = value / 10n ** 18n;
  const fraction = value % 10n ** 18n;
  return decimalAmount(
    fraction === 0n
      ? whole.toString()
      : `${whole}.${fraction.toString().padStart(18, '0').replace(/0+$/, '')}`,
  );
};

interface SharedState {
  readonly capacities: Map<string, bigint>;
  readonly transportCapacity: Map<string, bigint>;
  readonly allocations: Map<string, Allocation>;
  readonly idempotency: Map<string, { hash: string; result: unknown }>;
  readonly stopSales: Array<{ companyId: CompanyId; contractId: string; from: string; to: string }>;
  readonly visaBatches: Map<string, string>;
  readonly costEffects: Map<string, AllocationCostEffect>;
  readonly economicEvidence: Map<string, AllocationEconomicEvidence[]>;
  readonly coverage: Map<string, AllocationCoverageRequirement[]>;
  procurementCount: number;
  sequence: number;
}

function newState(): SharedState {
  return {
    capacities: new Map(),
    transportCapacity: new Map(),
    allocations: new Map(),
    idempotency: new Map(),
    stopSales: [],
    visaBatches: new Map(),
    costEffects: new Map(),
    economicEvidence: new Map(),
    coverage: new Map(),
    procurementCount: 0,
    sequence: 0,
  };
}

class BehavioralRepository {
  constructor(private readonly state: SharedState = newState()) {}

  setCapacity(
    companyId: CompanyId,
    type: ContractType,
    resourceId: string,
    serviceDate: string,
    value: string,
  ) {
    this.state.capacities.set(
      `${companyId}:${type}:${resourceId}:${serviceDate}`,
      scaled(quantity(value)),
    );
  }

  setTransportCapacity(companyId: CompanyId, resourceId: string, value: string) {
    this.state.transportCapacity.set(
      `${companyId}:TRANSPORT:${resourceId}`,
      scaled(quantity(value)),
    );
  }

  private capacityKey(input: {
    companyId: CompanyId;
    resourceType: ContractType;
    resourceId: string;
    serviceDate: string;
  }) {
    return `${input.companyId}:${input.resourceType}:${input.resourceId}:${input.serviceDate}`;
  }

  private async replay<T>(
    companyId: CompanyId,
    key: string | undefined,
    hash: string,
    work: () => Promise<T>,
  ): Promise<T> {
    if (key) {
      const old = this.state.idempotency.get(`${companyId}:${key}`);
      if (old) {
        if (old.hash !== hash) throw new Error('Idempotency conflict');
        return old.result as T;
      }
    }
    const result = await work();
    if (key) this.state.idempotency.set(`${companyId}:${key}`, { hash, result });
    return result;
  }

  async availability(input: CheckAvailabilityInput) {
    const stopped = this.state.stopSales.some(
      (value) =>
        value.companyId === input.companyId &&
        value.contractId === input.contractId &&
        value.from <= input.serviceDate &&
        value.to >= input.serviceDate,
    );
    if (stopped) {
      return {
        available: false,
        availableQuantity: quantity('0'),
        blockerReason: 'Stop sale',
      };
    }
    if (input.resourceType === 'TRANSPORT') {
      const available = this.transportAvailable(input);
      return { available: available > 0n, availableQuantity: decimal(available) };
    }
    const available = this.state.capacities.get(this.capacityKey(input)) ?? 0n;
    return { available: available > 0n, availableQuantity: decimal(available) };
  }

  async createStopSale(input: {
    companyId: CompanyId;
    contractId: string;
    effectiveFrom: string;
    effectiveTo: string;
    reason: string;
  }) {
    this.state.stopSales.push({
      companyId: input.companyId,
      contractId: input.contractId,
      from: input.effectiveFrom,
      to: input.effectiveTo,
    });
    return {
      id: 'stop-1',
      companyId: input.companyId,
      contractId: input.contractId,
      reason: input.reason,
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo,
      createdAt: new Date().toISOString(),
      isActive: true,
    };
  }

  async allocate(
    input: AllocateCapacityInput,
    key: string | undefined,
    hash: string,
  ): Promise<AllocationResult> {
    return this.replay(input.companyId, key, hash, async () => {
      const stopped = this.state.stopSales.some(
        (value) =>
          value.companyId === input.companyId &&
          value.contractId === input.contractId &&
          value.from <= input.serviceDate &&
          value.to >= input.serviceDate,
      );
      if (stopped) throw new Error('stop sale in effect');

      if (input.resourceType === 'VISA') {
        if (!input.visaBatchReference) throw new Error('visa batch evidence is required');
        const batchKey = `${input.companyId}:${idempotencyHash(input.visaBatchReference)}`;
        const priorId = this.state.visaBatches.get(batchKey);
        if (priorId) {
          const prior = this.state.allocations.get(priorId);
          if (
            prior &&
            prior.resourceId === input.resourceId &&
            prior.quantity === input.quantity &&
            prior.serviceDate === input.serviceDate
          ) {
            return { allocation: prior };
          }
          throw new Error('conflicting visa batch reuse');
        }
      }

      if (input.resourceType === 'TRANSPORT') {
        if (!input.periodEnd) throw new Error('transport periodEnd is required');
        if (this.transportAvailable(input) < scaled(input.quantity)) {
          throw new Error('insufficient TRANSPORT capacity');
        }
      } else {
        const capacityKey = this.capacityKey(input);
        const left = this.state.capacities.get(capacityKey) ?? 0n;
        const requested = scaled(input.quantity);
        if (left < requested) throw new Error('insufficient capacity');
        this.state.capacities.set(capacityKey, left - requested);
      }

      const allocation: Allocation = {
        id: `a${++this.state.sequence}`,
        companyId: input.companyId,
        contractId: input.contractId,
        contractVersionId: 'v1',
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        program: input.program,
        serviceDate: input.serviceDate,
        periodEnd: input.periodEnd,
        quantity: input.quantity,
        status: 'CONFIRMED',
        visaBatchReference: input.visaBatchReference,
        createdAt: new Date().toISOString(),
      };
      this.state.allocations.set(allocation.id, allocation);
      if (input.resourceType === 'VISA' && input.visaBatchReference) {
        this.state.visaBatches.set(
          `${input.companyId}:${idempotencyHash(input.visaBatchReference)}`,
          allocation.id,
        );
      }
      return { allocation };
    });
  }

  private transportAvailable(input: {
    companyId: CompanyId;
    resourceId: string;
    serviceDate: string;
    periodEnd?: string;
  }) {
    if (!input.periodEnd) return 0n;
    const capacity =
      this.state.transportCapacity.get(`${input.companyId}:TRANSPORT:${input.resourceId}`) ??
      0n;
    const used = [...this.state.allocations.values()]
      .filter(
        (value) =>
          value.companyId === input.companyId &&
          value.resourceType === 'TRANSPORT' &&
          value.resourceId === input.resourceId &&
          value.status !== 'RELEASED' &&
          value.periodEnd !== undefined &&
          value.serviceDate < input.periodEnd! &&
          value.periodEnd > input.serviceDate,
      )
      .reduce((total, value) => total + scaled(value.quantity), 0n);
    return capacity - used;
  }

  async consumeFlight(
    input: ConsumeFlightBlockInput,
    key: string | undefined,
    hash: string,
  ): Promise<FlightBlockConsumption> {
    const result = await this.allocate(
      {
        ...input,
        contractId: 'flight-contract',
        resourceType: 'FLIGHT_BLOCK',
        resourceId: input.flightBlockId,
        serviceDate: '2026-10-01',
        quantity: input.seats,
        flightSegmentReference: input.flightSegmentReference,
      },
      key,
      hash,
    );
    return {
      id: result.allocation!.id,
      companyId: input.companyId,
      flightBlockId: input.flightBlockId,
      program: input.program,
      consumedSeats: input.seats,
      consumedAt: new Date().toISOString(),
      sourceReference: input.flightSegmentReference,
    };
  }

  async internalFirst(
    input: InternalFirstFulfillmentInput,
    key: string | undefined,
    hash: string,
  ): Promise<AllocationResult> {
    return this.replay(input.companyId, key, hash, async () => {
      const capacityKey = this.capacityKey({
        companyId: input.companyId,
        resourceType: input.contractType,
        resourceId: input.resourceId,
        serviceDate: input.serviceDate,
      });
      const available = this.state.capacities.get(capacityKey) ?? 0n;
      const required = scaled(input.requiredQuantity);
      const take = available < required ? available : required;
      let allocation: Allocation | undefined;
      if (take > 0n) {
        allocation = (
          await this.allocate(
            {
              ...input,
              contractId: 'internal-contract',
              resourceType: input.contractType,
              quantity: decimal(take),
            },
            undefined,
            idempotencyHash({ input, take: take.toString() }),
          )
        ).allocation;
      }
      const residual = required - take;
      if (residual === 0n) return { allocation };
      this.state.procurementCount += 1;
      return {
        allocation,
        procurementRequest: {
          id: `p${this.state.procurementCount}`,
          companyId: input.companyId,
          program: input.program,
          residualQuantity: decimal(residual),
          procurementType: input.contractType,
          externalReference: '',
          referenceData: input.referenceData,
          createdAt: new Date().toISOString(),
        },
      };
    });
  }

  async attachProcurementReference(
    companyId: CompanyId,
    requestId: string,
    externalReference: string,
  ) {
    void companyId;
    void requestId;
    void externalReference;
  }

  async adjust(
    input: AdjustAllocationInput,
    key: string | undefined,
    hash: string,
  ): Promise<AdjustmentResult> {
    return this.replay(input.companyId, key, hash, async () => {
      const existingEffect = this.state.costEffects.get(
        `${input.companyId}:${input.costEffectId}`,
      );
      if (existingEffect) {
        if (existingEffect.requestHash !== hash) throw new Error('conflicting cost effect');
        return {
          allocation: this.state.allocations.get(existingEffect.allocationId)!,
          previousQuantity: existingEffect.previousQuantity,
          costEffectId: existingEffect.id,
        };
      }

      const old = this.state.allocations.get(input.allocationId);
      if (!old || old.companyId !== input.companyId) throw new Error('allocation not found');
      const delta = scaled(input.newQuantity) - scaled(old.quantity);
      const capacityKey = this.capacityKey(old);
      if (delta > 0n) {
        const available = this.state.capacities.get(capacityKey) ?? 0n;
        if (available < delta) throw new Error('insufficient capacity');
        this.state.capacities.set(capacityKey, available - delta);
      } else if (delta < 0n) {
        this.state.capacities.set(
          capacityKey,
          (this.state.capacities.get(capacityKey) ?? 0n) + -delta,
        );
      }
      const updated = { ...old, quantity: input.newQuantity };
      this.state.allocations.set(old.id, updated);
      const effect: AllocationCostEffect = {
        id: input.costEffectId,
        companyId: input.companyId,
        allocationId: old.id,
        program: old.program,
        previousQuantity: old.quantity,
        newQuantity: input.newQuantity,
        costAmount: input.costAmount,
        postingDate: input.postingDate,
        status: 'PENDING',
        requestHash: hash,
        createdAt: new Date().toISOString(),
      };
      this.state.costEffects.set(`${input.companyId}:${effect.id}`, effect);
      return {
        allocation: updated,
        previousQuantity: old.quantity,
        costEffectId: effect.id,
      };
    });
  }

  async costEffect(companyId: CompanyId, effectId: string) {
    return this.state.costEffects.get(`${companyId}:${effectId}`) ?? null;
  }

  async completeCostEffect(companyId: CompanyId, effectId: string, ownerReference: string) {
    const key = `${companyId}:${effectId}`;
    const effect = this.state.costEffects.get(key);
    if (!effect) throw new Error('effect not found');
    const completed: AllocationCostEffect = {
      ...effect,
      status: 'COMPLETED',
      ownerReference,
      completedAt: new Date().toISOString(),
    };
    this.state.costEffects.set(key, completed);
    return completed;
  }

  async registerEconomicEvidence(
    input: RegisterAllocationEconomicEvidenceInput,
  ): Promise<AllocationEconomicEvidence> {
    const value: AllocationEconomicEvidence = {
      id: `e${++this.state.sequence}`,
      companyId: input.companyId,
      allocationId: input.allocationId,
      kind: input.kind,
      evidence: input.evidence,
      createdAt: new Date().toISOString(),
    };
    const values = this.state.economicEvidence.get(input.allocationId) ?? [];
    if (!values.some((old) => idempotencyHash(old.evidence) === idempotencyHash(input.evidence))) {
      values.push(value);
    }
    this.state.economicEvidence.set(input.allocationId, values);
    return values.find(
      (old) => idempotencyHash(old.evidence) === idempotencyHash(input.evidence),
    )!;
  }

  async protectCoverage(
    input: ProtectAllocationCoverageInput,
  ): Promise<AllocationCoverageRequirement> {
    const value: AllocationCoverageRequirement = {
      id: `c${++this.state.sequence}`,
      companyId: input.companyId,
      allocationId: input.allocationId,
      minimumQuantity: input.minimumQuantity,
      requirementReference: input.requirementReference,
      active: true,
      createdAt: new Date().toISOString(),
    };
    const values = this.state.coverage.get(input.allocationId) ?? [];
    values.push(value);
    this.state.coverage.set(input.allocationId, values);
    return value;
  }

  async releaseCoverage(
    input: ReleaseAllocationCoverageInput,
  ): Promise<AllocationCoverageRequirement> {
    const values = this.state.coverage.get(input.allocationId) ?? [];
    const found = values.find(
      (value) =>
        value.companyId === input.companyId &&
        idempotencyHash(value.requirementReference) ===
          idempotencyHash(input.requirementReference),
    );
    if (!found) throw new Error('coverage not found');
    const released = { ...found, active: false, releasedAt: new Date().toISOString() };
    this.state.coverage.set(
      input.allocationId,
      values.map((value) => (value.id === found.id ? released : value)),
    );
    return released;
  }

  async releaseBlockers(companyId: CompanyId, allocationId: string): Promise<ReleaseBlocker[]> {
    const allocation = this.state.allocations.get(allocationId);
    if (!allocation || allocation.companyId !== companyId) throw new Error('allocation not found');
    const blockers: ReleaseBlocker[] = [];
    if ((this.state.economicEvidence.get(allocationId) ?? []).length) {
      blockers.push({ code: 'FINANCIAL_HISTORY', message: 'protected economic history exists' });
    }
    const completedCost = [...this.state.costEffects.values()].some(
      (effect) =>
        effect.companyId === companyId &&
        effect.allocationId === allocationId &&
        effect.status === 'COMPLETED',
    );
    if (completedCost) {
      blockers.push({ code: 'FINANCIAL_HISTORY', message: 'completed cost effect exists' });
    }
    if ((this.state.coverage.get(allocationId) ?? []).some((value) => value.active)) {
      blockers.push({ code: 'PROGRAM_COVERAGE', message: 'active coverage exists' });
    }
    return blockers;
  }

  async release(
    input: ReleaseAllocationInput,
    key: string | undefined,
    hash: string,
  ) {
    return this.replay(input.companyId, key, hash, async () => {
      const current = this.state.allocations.get(input.allocationId);
      if (!current || current.companyId !== input.companyId) throw new Error('allocation not found');
      const remaining = scaled(current.quantity) - scaled(input.quantity);
      if (remaining < 0n) throw new Error('release exceeds allocation');

      const blockers = await this.releaseBlockers(input.companyId, input.allocationId);
      const coverage = (this.state.coverage.get(input.allocationId) ?? []).filter(
        (value) => value.active && scaled(value.minimumQuantity) > remaining,
      );
      const hardBlockers = blockers.filter((value) => value.code !== 'PROGRAM_COVERAGE');
      if (hardBlockers.length || coverage.length) {
        return {
          success: false,
          blockerEvidence: 'protected economic/program coverage history',
          releasedQuantity: quantity('0'),
        };
      }

      if (current.resourceType !== 'TRANSPORT') {
        const capacityKey = this.capacityKey(current);
        this.state.capacities.set(
          capacityKey,
          (this.state.capacities.get(capacityKey) ?? 0n) + scaled(input.quantity),
        );
      }
      this.state.allocations.set(input.allocationId, {
        ...current,
        quantity: decimal(remaining),
        status: remaining === 0n ? 'RELEASED' : 'PARTIALLY_RELEASED',
      });
      return { success: true, releasedQuantity: input.quantity };
    });
  }

  async idempotency(companyId: CompanyId, key: string) {
    const old = this.state.idempotency.get(`${companyId}:${key}`);
    return old
      ? { requestHash: old.hash, result: old.result as Record<string, unknown> }
      : null;
  }
}

function service(
  repository: BehavioralRepository,
  options?: { failCostOnce?: boolean },
) {
  let costCalls = 0;
  const implementation = new TourismContractInventoryApplicationServiceImpl(
    repository as unknown as TourismInventoryRepository,
    {
      recordAllocationAdjustment: async (input) => {
        costCalls += 1;
        if (options?.failCostOnce && costCalls === 1) throw new Error('cost owner unavailable');
        return { id: input.effectId };
      },
    },
    {
      requestResidual: async (input) => `PO:${input.requestId}`,
    },
  );
  return { implementation, costCalls: () => costCalls };
}

test('canonical idempotency hashing ignores object key order and detects value changes', () => {
  assert.equal(
    idempotencyHash({ b: 2, a: { d: 4, c: 3 } }),
    idempotencyHash({ a: { c: 3, d: 4 }, b: 2 }),
  );
  assert.notEqual(idempotencyHash({ a: '1' }), idempotencyHash({ a: '2' }));
});

test('GS-032 hotel exact capacity succeeds, +1 fails, and companies remain isolated', async () => {
  const repository = new BehavioralRepository();
  const { implementation } = service(repository);
  repository.setCapacity(company, 'HOTEL', 'hotel', '2026-10-01', '2');
  repository.setCapacity(other, 'HOTEL', 'hotel', '2026-10-01', '5');

  const input: AllocateCapacityInput = {
    companyId: company,
    contractId: 'hotel-contract',
    resourceType: 'HOTEL',
    resourceId: 'hotel',
    program,
    serviceDate: '2026-10-01',
    quantity: quantity('2'),
  };
  await implementation.allocateCapacity(input, 'hotel-exact');
  await assert.rejects(
    implementation.allocateCapacity({ ...input, quantity: quantity('1') }, 'hotel-over'),
    /insufficient/,
  );
  assert.equal(
    (await implementation.checkAvailability({ ...input, companyId: other })).availableQuantity,
    '5',
  );
});

test('GS-033 partial hotel adjustment restores/consumes capacity and retries Cost after owner failure', async () => {
  const repository = new BehavioralRepository();
  const { implementation, costCalls } = service(repository, { failCostOnce: true });
  repository.setCapacity(company, 'HOTEL', 'hotel', '2026-10-01', '3');
  const allocated = await implementation.allocateCapacity(
    {
      companyId: company,
      contractId: 'hotel-contract',
      resourceType: 'HOTEL',
      resourceId: 'hotel',
      program,
      serviceDate: '2026-10-01',
      quantity: quantity('2'),
    },
    'allocation',
  );

  const adjustment: AdjustAllocationInput = {
    companyId: company,
    allocationId: allocated.allocation!.id,
    newQuantity: quantity('3'),
    costEffectId: 'cost-effect-1',
    costAmount: quantity('150'),
    postingDate: '2026-10-01',
  };
  await assert.rejects(implementation.adjustAllocation(adjustment, 'adjust'), /cost owner unavailable/);
  assert.equal((await repository.costEffect(company, 'cost-effect-1'))?.status, 'PENDING');
  await implementation.adjustAllocation(adjustment, 'adjust');
  assert.equal(costCalls(), 2);
  assert.equal((await repository.costEffect(company, 'cost-effect-1'))?.status, 'COMPLETED');
});

test('GS-034 dated stop sale blocks allocation only inside its effective window', async () => {
  const repository = new BehavioralRepository();
  const { implementation } = service(repository);
  repository.setCapacity(company, 'HOTEL', 'hotel', '2026-10-01', '1');
  repository.setCapacity(company, 'HOTEL', 'hotel', '2026-10-10', '1');
  await implementation.createStopSale({
    companyId: company,
    contractId: 'hotel-contract',
    reason: 'supplier stop',
    effectiveFrom: '2026-10-01',
    effectiveTo: '2026-10-05',
  });
  await assert.rejects(
    implementation.allocateCapacity({
      companyId: company,
      contractId: 'hotel-contract',
      resourceType: 'HOTEL',
      resourceId: 'hotel',
      program,
      serviceDate: '2026-10-01',
      quantity: quantity('1'),
    }),
    /stop sale/,
  );
  await implementation.allocateCapacity({
    companyId: company,
    contractId: 'hotel-contract',
    resourceType: 'HOTEL',
    resourceId: 'hotel',
    program,
    serviceDate: '2026-10-10',
    quantity: quantity('1'),
  });
});

test('GS-035 shared flight block is global across programs', async () => {
  const repository = new BehavioralRepository();
  const { implementation } = service(repository);
  repository.setCapacity(company, 'FLIGHT_BLOCK', 'flight', '2026-10-01', '2');
  await implementation.consumeFlightBlock(
    {
      companyId: company,
      flightBlockId: 'flight',
      program,
      seats: quantity('1'),
      flightSegmentReference: segment,
    },
    'flight-1',
  );
  await implementation.consumeFlightBlock(
    {
      companyId: company,
      flightBlockId: 'flight',
      program: sourceReference('TOUR_PROGRAM', 'program-2'),
      seats: quantity('1'),
      flightSegmentReference: segment,
    },
    'flight-2',
  );
  await assert.rejects(
    implementation.consumeFlightBlock(
      {
        companyId: company,
        flightBlockId: 'flight',
        program,
        seats: quantity('1'),
        flightSegmentReference: segment,
      },
      'flight-3',
    ),
    /insufficient/,
  );
});

test('GS-036 transport capacity is reusable for non-overlap and blocked for overlap', async () => {
  const repository = new BehavioralRepository();
  const { implementation } = service(repository);
  repository.setTransportCapacity(company, 'bus', '1');
  const base = {
    companyId: company,
    contractId: 'transport-contract',
    resourceType: 'TRANSPORT' as const,
    resourceId: 'bus',
    program,
    quantity: quantity('1'),
  };
  await implementation.allocateCapacity({
    ...base,
    serviceDate: '2026-10-01T00:00:00.000Z',
    periodEnd: '2026-10-02T00:00:00.000Z',
  });
  await implementation.allocateCapacity({
    ...base,
    serviceDate: '2026-10-02T00:00:00.000Z',
    periodEnd: '2026-10-03T00:00:00.000Z',
  });
  await assert.rejects(
    implementation.allocateCapacity({
      ...base,
      serviceDate: '2026-10-01T12:00:00.000Z',
      periodEnd: '2026-10-02T12:00:00.000Z',
    }),
    /insufficient/,
  );
});

test('GS-037 internal inventory is consumed before residual Procurement request', async () => {
  const repository = new BehavioralRepository();
  const { implementation } = service(repository);
  repository.setCapacity(company, 'HOTEL', 'hotel', '2026-10-01', '2');
  const result = await implementation.fulfillWithInternalFirst(
    {
      companyId: company,
      program,
      contractType: 'HOTEL',
      resourceId: 'hotel',
      serviceDate: '2026-10-01',
      requiredQuantity: quantity('3'),
      referenceData: { itemReference: 'room' },
      supplierId: 'supplier',
    },
    'fulfil',
  );
  assert.equal(result.allocation?.quantity, '2');
  assert.equal(result.procurementRequest?.residualQuantity, '1');
  assert.equal(result.procurementRequest?.externalReference, 'PO:p1');
});

test('GS-038 visa batch identity prevents duplicate quota consumption across different idempotency keys', async () => {
  const repository = new BehavioralRepository();
  const { implementation } = service(repository);
  repository.setCapacity(company, 'VISA', 'quota', '2026-10-01', '2');
  const input: AllocateCapacityInput = {
    companyId: company,
    contractId: 'visa-contract',
    resourceType: 'VISA',
    resourceId: 'quota',
    program,
    serviceDate: '2026-10-01',
    quantity: quantity('1'),
    visaBatchReference: visaBatch,
  };
  const first = await implementation.allocateCapacity(input, 'visa-a');
  const replay = await implementation.allocateCapacity(input, 'visa-b');
  assert.equal(replay.allocation?.id, first.allocation?.id);
  assert.equal(
    (await implementation.checkAvailability({ ...input })).availableQuantity,
    '1',
  );
  await assert.rejects(
    implementation.allocateCapacity(
      { ...input, quantity: quantity('2') },
      'visa-conflict',
    ),
    /conflicting visa batch/,
  );
});

test('GS-039 flight allocation requires real segment evidence', () => {
  const repository = new BehavioralRepository();
  const { implementation } = service(repository);
  assert.throws(() =>
    implementation.allocateCapacity({
      companyId: company,
      contractId: 'flight-contract',
      resourceType: 'FLIGHT_BLOCK',
      resourceId: 'flight',
      program,
      serviceDate: '2026-10-01',
      quantity: quantity('1'),
    }),
  );
});

test('BR-060 and BR-063 release decisions use persisted server-side coverage/economic evidence', async () => {
  const repository = new BehavioralRepository();
  const { implementation } = service(repository);
  repository.setCapacity(company, 'HOTEL', 'hotel', '2026-10-01', '2');
  const allocated = await implementation.allocateCapacity({
    companyId: company,
    contractId: 'hotel-contract',
    resourceType: 'HOTEL',
    resourceId: 'hotel',
    program,
    serviceDate: '2026-10-01',
    quantity: quantity('2'),
  });
  const allocationId = allocated.allocation!.id;
  const coverageReference = sourceReference('PROGRAM_COVERAGE', 'coverage-1');

  await implementation.protectAllocationCoverage({
    companyId: company,
    allocationId,
    minimumQuantity: quantity('2'),
    requirementReference: coverageReference,
  });
  const blockedByCoverage = await implementation.releaseAllocation({
    companyId: company,
    allocationId,
    quantity: quantity('1'),
  });
  assert.equal(blockedByCoverage.success, false);

  await implementation.releaseAllocationCoverage({
    companyId: company,
    allocationId,
    requirementReference: coverageReference,
  });
  await implementation.registerAllocationEconomicEvidence({
    companyId: company,
    allocationId,
    kind: 'BILLING',
    evidence: sourceReference('BILLING_INVOICE', 'invoice-1'),
  });
  const blockedByHistory = await implementation.releaseAllocation({
    companyId: company,
    allocationId,
    quantity: quantity('1'),
  });
  assert.equal(blockedByHistory.success, false);
  assert.equal(
    (await implementation.getReleaseBlockers(company, allocationId))[0]?.code,
    'FINANCIAL_HISTORY',
  );
});
