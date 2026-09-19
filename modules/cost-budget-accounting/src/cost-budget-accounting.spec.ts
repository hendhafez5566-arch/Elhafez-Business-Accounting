import assert from 'node:assert/strict';
import test from 'node:test';
import {
  companyId,
  decimalAmount,
  sourceReference,
} from '@elhafez/contracts';
import { CostBudgetAccountingApplicationService } from './application/cost-budget-accounting.application-service.js';
import { costCenterId } from './domain/cost-center.js';
import { InMemoryCostCenterRepository } from './infrastructure/in-memory-cost-center.repository.js';

const company = companyId('company-1');
const other = companyId('company-2');
const id = costCenterId('cc-1');
const program = sourceReference('TOURISM_PROGRAM', 'program-1');
const input = {
  id,
  companyId: company,
  code: 'PROGRAM_1',
  name: 'Program 1',
  status: 'ACTIVE' as const,
};

test('creates, queries, validates and deactivates company-scoped cost centers', async () => {
  const service = new CostBudgetAccountingApplicationService(new InMemoryCostCenterRepository());
  await service.create(input);
  assert.equal((await service.get(company, id)).code, 'PROGRAM_1');
  await assert.rejects(service.get(other, id), /not found/);
  await assert.rejects(service.create({ ...input, id: costCenterId('cc-2') }), /already exists/);
  await service.deactivate(company, id);
  await assert.rejects(service.validateActive(company, id), /inactive/);
});

test('BR-042 program association is opaque, idempotent, isolated and conflict safe', async () => {
  const service = new CostBudgetAccountingApplicationService(new InMemoryCostCenterRepository());
  await service.create(input);
  await service.create({ ...input, id: costCenterId('cc-2'), code: 'PROGRAM_2' });
  const first = await service.ensureProgramCostCenter(company, program, id);
  assert.strictEqual(await service.ensureProgramCostCenter(company, program, id), first);
  assert.equal((await service.resolveProgramCostCenter(company, program)).id, id);
  await assert.rejects(
    service.ensureProgramCostCenter(company, program, costCenterId('cc-2')),
    /different/,
  );
  await assert.rejects(service.resolveProgramCostCenter(other, program), /no cost center/);
  await service.deactivate(company, costCenterId('cc-2'));
  await assert.rejects(
    service.ensureProgramCostCenter(
      company,
      sourceReference('TOURISM_PROGRAM', 'program-2'),
      costCenterId('cc-2'),
    ),
    /inactive/,
  );
});

test('budgets isolate companies and rebuild signed actuals after cost-center deactivation', async () => {
  const service = new CostBudgetAccountingApplicationService(new InMemoryCostCenterRepository());
  await service.create(input);
  const budget = await service.createBudget({
    id: 'budget-1',
    companyId: company,
    costCenterId: id,
    periodStart: '2026-01-01',
    periodEnd: '2026-12-31',
    currency: 'EGP',
    amount: decimalAmount('100'),
  });
  await service.authorizeBudget(company, budget.id);
  const cost = {
    id: 'actual-1',
    companyId: company,
    costCenterId: id,
    postingDate: '2026-02-01',
    amount: decimalAmount('60'),
    journalId: 'j1',
    journalLineId: 'l1',
  };
  await service.consumeJournalPostedFact(cost);
  await service.deactivate(company, id);
  await service.consumeJournalPostedFact(cost);
  await service.consumeJournalPostedFact({
    ...cost,
    id: 'actual-r1',
    amount: decimalAmount('-20'),
    journalId: 'j2',
    journalLineId: 'l2',
  });
  assert.deepEqual(await service.checkBudget(company, budget.id), {
    budget: { ...budget, status: 'AUTHORIZED' },
    actual: '40',
    remaining: '60',
    exceeded: false,
  });
  await assert.rejects(service.checkBudget(other, budget.id), /not found/);
});

test('BR-061 Cost owner records allocation cost effects idempotently without fake journal facts', async () => {
  const repository = new InMemoryCostCenterRepository();
  const service = new CostBudgetAccountingApplicationService(repository);
  await service.create(input);
  await service.ensureProgramCostCenter(company, program, id);

  const effect = {
    id: 'allocation-effect-1',
    companyId: company,
    program,
    allocationId: 'allocation-1',
    previousQuantity: decimalAmount('2'),
    newQuantity: decimalAmount('3'),
    amount: decimalAmount('150'),
    postingDate: '2026-10-01',
  };
  const first = await service.recordProgramAllocationCostEffect(effect);
  const replay = await service.recordProgramAllocationCostEffect(effect);
  assert.deepEqual(replay, first);
  assert.equal((await service.getProgramAllocationCostEffect(company, effect.id))?.allocationId, 'allocation-1');

  await assert.rejects(
    service.recordProgramAllocationCostEffect({
      ...effect,
      amount: decimalAmount('151'),
    }),
    /conflicting replay/,
  );
  assert.equal(await service.getProgramAllocationCostEffect(other, effect.id), undefined);
});

test('BR-068 Tourism service actualization is semantic, idempotent and conflict safe', async () => {
  const service = new CostBudgetAccountingApplicationService(new InMemoryCostCenterRepository());
  await service.create(input);
  await service.ensureProgramCostCenter(company, program, id);
  const command = { id: 'milestone-1', companyId: company, program, service: sourceReference('TOURISM_SERVICE', 'ticket-1'), evidence: sourceReference('FLIGHT_SEGMENT', 'segment-1'), amount: decimalAmount('75.25'), postingDate: '2026-09-19' };
  const first = await service.recordTourismServiceActualization(command);
  assert.strictEqual(await service.recordTourismServiceActualization(command), first);
  await assert.rejects(service.recordTourismServiceActualization({ ...command, amount: decimalAmount('76') }), /conflicting replay/);
  assert.equal(first.service.sourceId, 'ticket-1');
  assert.equal(first.evidence.sourceId, 'segment-1');
});

test('BLOCKER-4 concurrent Tourism service actualization converges for identical requests', async () => {
  const service = createService();
  const program = sourceReference('TOURISM_PROGRAM', 'program-1');
  await service.ensureProgramCostCenter(company, program, 'cc-001');
  const input = {
    id: 'actualize-concurrent',
    companyId: company,
    program,
    service: sourceReference('TOURISM_SERVICE', 'service-1'),
    evidence: sourceReference('VISA_ALLOCATION', 'visa-1'),
    amount: decimalAmount('150'),
    postingDate: '2026-09-19',
  };
  // Concurrent identical requests
  const [first, second] = await Promise.all([
    service.recordTourismServiceActualization(input),
    service.recordTourismServiceActualization(input),
  ]);
  assert.equal(first.id, second.id, 'should converge to same record');
  assert.equal(first.requestHash, second.requestHash, 'should have identical hash');
});

test('BLOCKER-4 concurrent Tourism service actualization rejects conflicting payloads', async () => {
  const service = createService();
  const program = sourceReference('TOURISM_PROGRAM', 'program-2');
  await service.ensureProgramCostCenter(company, program, 'cc-002');
  const base = {
    id: 'actualize-conflict',
    companyId: company,
    program,
    service: sourceReference('TOURISM_SERVICE', 'service-2'),
    evidence: sourceReference('VISA_ALLOCATION', 'visa-2'),
    postingDate: '2026-09-19',
  };
  // First request succeeds
  await service.recordTourismServiceActualization({ ...base, amount: decimalAmount('100') });
  // Second request with different amount conflicts
  await assert.rejects(
    service.recordTourismServiceActualization({ ...base, amount: decimalAmount('200') }),
    /conflicting replay/
  );
});
