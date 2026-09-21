import assert from 'node:assert/strict';
import test from 'node:test';
import {
  executionContext,
  decimalAmount,
  type ExecutionContext,
} from '@elhafez/contracts';
import { HajjUmrahProgramsApplicationService } from './application/hajj-umrah-programs.application-service.js';
import type {
  ProgramAccess,
  ReopenGuard,
  SeasonPort,
  SupplyEvidenceCheck,
  SupplyPort,
} from './application/program.ports.js';
import { InMemoryProgramRepository } from './infrastructure/in-memory-program.repository.js';

class Access implements ProgramAccess {
  async requireBranch(context: ExecutionContext) {
    if (context.branchId === 'blocked') throw new Error('branch denied');
  }
  async requirePermission(context: ExecutionContext, permission: string) {
    if (context.actorId === 'viewer' && !permission.endsWith('view')) {
      throw new Error('permission denied');
    }
  }
  async audit() {}
}

const season: SeasonPort = {
  async validate(_company, _branch, _id, start, end) {
    if (start < '2027-01-01' || end > '2027-12-31') throw new Error('season boundary');
  },
};
const supply: SupplyPort = { async hasEvidence() { return true; } };
const guard: ReopenGuard = { async assertOpen() {} };
const ctx = executionContext('c1', 'b1', 'u1');
const components = [
  { type: 'HOTEL' as const, title: 'Hotel', sequence: 1, start: '2027-05-01', inventoryReference: 'hotel-1' },
  { type: 'FLIGHT' as const, title: 'Flight', sequence: 2, start: '2027-05-01', inventoryReference: 'flight-1' },
  { type: 'TRANSPORT' as const, title: 'Bus', sequence: 3, start: '2027-05-01', end: '2027-05-20', inventoryReference: 'bus-1' },
  { type: 'CAMP' as const, title: 'Camp', sequence: 4, start: '2027-05-01', end: '2027-05-20', inventoryReference: 'camp-1' },
  { type: 'PERMIT' as const, title: 'Permit', sequence: 5, start: '2027-05-01', inventoryReference: 'permit-1' },
];
const base = {
  code: 'HU-1',
  type: 'HAJJ' as const,
  seasonId: 's1',
  arabicName: 'برنامج الحج',
  englishName: 'Hajj Program',
  groupNumber: 'G-1',
  groupDescription: 'المجموعة الأولى',
  departureDate: '2027-05-01',
  returnDate: '2027-05-20',
  salesStart: '2026-10-01',
  salesClose: '2027-04-01',
  capacity: '40',
  currency: 'SAR',
  prices: { double: decimalAmount('10000') },
  components,
  temporaryHoldMinutes: 20,
  minimumDepositPolicy: '25%',
  cancellationPolicy: 'policy-v1',
  notes: 'note-v1',
  operationsManager: 'ops-v1',
  groupLeader: 'leader-v1',
  guide: 'guide-v1',
  contact: '+966500000000',
};

function fixture(supplyPort: SupplyPort = supply, reopenGuard: ReopenGuard = guard) {
  let sequence = 0;
  const repo = new InMemoryProgramRepository();
  const service = new HajjUmrahProgramsApplicationService(
    repo,
    new Access(),
    season,
    supplyPort,
    reopenGuard,
    () => new Date('2026-09-21T00:00:00Z'),
    () => `id-${++sequence}`,
  );
  return { repo, service };
}

test('new programs prepare with approved requirement defaults and never auto-open', async () => {
  const { service } = fixture();
  const hajj = await service.create(ctx, base);
  assert.equal(hajj.status, 'PREPARING');
  assert.equal(hajj.bookingOpen, false);
  assert.deepEqual(hajj.snapshot.requirements, ['HOTEL', 'FLIGHT', 'TRANSPORT', 'CAMP', 'PERMIT']);
  const umrah = await service.create(ctx, {
    ...base,
    code: 'HU-2',
    type: 'UMRAH',
    components: components.slice(0, 3),
  });
  assert.deepEqual(umrah.snapshot.requirements, ['HOTEL', 'FLIGHT', 'TRANSPORT']);
});

test('real supply checks map canonical resources and missing evidence blocks opening', async () => {
  const calls: SupplyEvidenceCheck[] = [];
  const mapped: SupplyPort = {
    async hasEvidence(input) {
      calls.push(input);
      return input.requirement !== 'CAMP';
    },
  };
  const { service } = fixture(mapped);
  const program = await service.create(ctx, base);
  await assert.rejects(() => service.openForBooking(ctx, program.id), /CAMP/);
  assert.ok(calls.some((item) => item.requirement === 'HOTEL' && item.resourceType === 'HOTEL' && item.resourceId === 'hotel-1'));
  assert.ok(calls.some((item) => item.requirement === 'FLIGHT' && item.resourceType === 'FLIGHT_BLOCK'));
  assert.ok(calls.some((item) => item.requirement === 'TRANSPORT' && item.resourceType === 'TRANSPORT' && item.periodEnd === '2027-05-20'));
  assert.ok(calls.some((item) => item.requirement === 'CAMP' && item.resourceType === 'SERVICE' && item.serviceCategory === 'CAMP'));
});

test('non-required capabilities and HEALTH do not create false TCI blockers', async () => {
  const calls: SupplyEvidenceCheck[] = [];
  const port: SupplyPort = {
    async hasEvidence(input) {
      calls.push(input);
      return input.requirement === 'HOTEL';
    },
  };
  const { service } = fixture(port);
  const program = await service.create(ctx, {
    ...base,
    requirements: ['HOTEL', 'HEALTH'],
    components: [
      components[0]!,
      { type: 'RAWDA', title: 'Optional Rawda', sequence: 9, inventoryReference: 'rawda-optional' },
    ],
  });
  const opened = await service.openForBooking(ctx, program.id);
  assert.equal(opened.status, 'BOOKABLE');
  assert.deepEqual(calls.map((item) => item.requirement), ['HOTEL']);
});

test('opening and booking availability stay separate', async () => {
  const { service } = fixture();
  const program = await service.create(ctx, base);
  const opened = await service.openForBooking(ctx, program.id);
  assert.equal(opened.status, 'BOOKABLE');
  assert.equal(opened.bookingOpen, true);
  const closedSales = await service.setBookingAvailability(ctx, program.id, false);
  assert.equal(closedSales.status, 'BOOKABLE');
  assert.equal(closedSales.bookingOpen, false);
});

test('preparing edit persists every material field and keeps the old version immutable', async () => {
  const { service } = fixture();
  const program = await service.create(ctx, base);
  const edited = await service.editPreparing(ctx, program.id, {
    ...base,
    code: 'HU-EDIT',
    seasonId: 's2',
    arabicName: 'برنامج معدل',
    englishName: 'Edited Program',
    groupNumber: 'G-2',
    groupDescription: 'مجموعة معدلة',
    capacity: '45',
    temporaryHoldMinutes: 30,
    minimumDepositPolicy: '30%',
    cancellationPolicy: 'policy-v2',
    notes: 'note-v2',
    operationsManager: 'ops-v2',
    groupLeader: 'leader-v2',
    guide: 'guide-v2',
    contact: '+966511111111',
  });
  assert.equal(edited.seasonId, 's2');
  assert.equal(edited.code, 'HU-EDIT');
  assert.equal(edited.englishName, 'Edited Program');
  assert.equal(edited.temporaryHoldMinutes, 30);
  assert.equal(edited.snapshot.capacity, '45');
  const versions = await service.versions(ctx, program.id);
  assert.equal(versions.length, 2);
  assert.equal(versions[0]!.snapshot.seasonId, 's1');
  assert.equal(versions[0]!.snapshot.englishName, 'Hajj Program');
  assert.equal(versions[0]!.snapshot.snapshot.capacity, '40');
  assert.equal(versions[1]!.snapshot.seasonId, 's2');
  assert.equal(versions[1]!.snapshot.snapshot.cancellationPolicy, 'policy-v2');
});

test('amend persists validated season and full definition while old versions remain unchanged', async () => {
  const { service } = fixture();
  const program = await service.create(ctx, base);
  await service.openForBooking(ctx, program.id);
  const amended = await service.amend(ctx, program.id, {
    ...base,
    seasonId: 's3',
    arabicName: 'نسخة معتمدة جديدة',
    capacity: '50',
    operationsManager: 'ops-v3',
  }, 'approved change');
  assert.equal(amended.seasonId, 's3');
  assert.equal(amended.arabicName, 'نسخة معتمدة جديدة');
  assert.equal(amended.operationsManager, 'ops-v3');
  assert.equal(amended.currentVersion, 2);
  const versions = await service.versions(ctx, program.id);
  assert.equal(versions[0]!.snapshot.seasonId, 's1');
  assert.equal(versions[0]!.snapshot.snapshot.capacity, '40');
  assert.equal(versions[1]!.snapshot.seasonId, 's3');
  assert.equal(versions[1]!.snapshot.snapshot.capacity, '50');
});

test('departure and return evidence drive lifecycle and cancellation stops after travel', async () => {
  const { service } = fixture();
  const program = await service.create(ctx, base);
  await assert.rejects(() => service.recordReturn(ctx, program.id), /departure/);
  await service.openForBooking(ctx, program.id);
  const trip = await service.recordDeparture(ctx, program.id);
  assert.ok(trip.departureRecordedAt);
  await assert.rejects(() => service.cancel(ctx, program.id, 'late'), /after travel/);
  const done = await service.recordReturn(ctx, program.id);
  assert.equal(done.status, 'CLOSED');
  assert.ok(done.returnRecordedAt);
});

test('closed program reopen requires reason, permission, and an open accounting guard', async () => {
  let blocked = true;
  const reopenGuard: ReopenGuard = {
    async assertOpen() {
      if (blocked) throw new Error('accounting period is closed');
    },
  };
  const { service } = fixture(supply, reopenGuard);
  const program = await service.create(ctx, base);
  await service.openForBooking(ctx, program.id);
  await service.recordDeparture(ctx, program.id);
  await service.recordReturn(ctx, program.id);
  await assert.rejects(() => service.reopen(ctx, program.id, ''), /reason/);
  await assert.rejects(() => service.reopen(ctx, program.id, 'correction'), /accounting period is closed/);
  blocked = false;
  assert.equal((await service.reopen(ctx, program.id, 'correction')).status, 'IN_TRIP');
});

test('company/branch isolation and permission enforcement remain server-side', async () => {
  const { service } = fixture();
  const program = await service.create(ctx, base);
  await assert.rejects(() => service.get(executionContext('c2', 'b1', 'u1'), program.id), /not found/);
  await assert.rejects(() => service.get(executionContext('c1', 'b2', 'u1'), program.id), /not found/);
  await assert.rejects(() => service.openForBooking(executionContext('c1', 'b1', 'viewer'), program.id), /permission/);
});
