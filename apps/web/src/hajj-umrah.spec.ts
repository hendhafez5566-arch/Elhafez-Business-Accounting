import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  applyProgramAction,
  createProgramAndReload,
  createSeasonAndReload,
  loadPrograms,
  loadSeasons,
  ProgramsView,
  ProgramWorkspaceView,
  SeasonsView,
} from './hajj-umrah-pages.js';
import {
  emptyCapabilities,
  type HajjUmrahApi,
  type HajjUmrahCapabilities,
  type Program,
  type ProgramInput,
  type ProgramVersion,
  type Season,
  type SeasonInput,
} from './hajj-umrah-client.js';

const season: Season = {
  id: 'season-1',
  code: '1448',
  arabicName: 'موسم العمرة 1448',
  operatingStart: '2026-10-01',
  operatingEnd: '2027-06-30',
  salesStart: '2026-09-01',
  salesEnd: '2027-06-01',
  status: 'ACTIVE',
  version: 1,
};
const program: Program = {
  id: 'program-1',
  code: 'UM-1',
  type: 'UMRAH',
  seasonId: season.id,
  arabicName: 'عمرة رجب',
  snapshot: {
    departureDate: '2027-01-10',
    returnDate: '2027-01-20',
    salesStart: '2026-10-01',
    salesClose: '2027-01-01',
    capacity: '40',
    currency: 'EGP',
    prices: { double: '35000' },
    requirements: ['HOTEL', 'FLIGHT', 'TRANSPORT'],
    components: [],
  },
  temporaryHoldMinutes: 15,
  status: 'BOOKABLE',
  bookingOpen: false,
  currentVersion: 2,
  currentVersionId: 'version-2',
};
const version: ProgramVersion = {
  id: 'version-2',
  version: 2,
  effectiveAt: '2026-09-21T00:00:00.000Z',
  reason: 'approved',
  actorId: 'user-1',
};
const fullCapabilities: HajjUmrahCapabilities = {
  seasonManage: true,
  seasonLifecycle: true,
  programCreate: true,
  programEdit: true,
  programAmend: true,
  programAvailability: true,
  programLifecycle: true,
  programCancel: true,
  programReopen: true,
  programClose: true,
};

class FakeApi implements HajjUmrahApi {
  readonly calls: string[] = [];
  seasons: Season[] = [season];
  programs: Program[] = [program];

  async capabilities() { this.calls.push('capabilities'); return fullCapabilities; }
  async listSeasons() { this.calls.push('listSeasons'); return [...this.seasons]; }
  async getSeason(id: string) { this.calls.push(`getSeason:${id}`); return this.seasons.find((item) => item.id === id)!; }
  async createSeason(input: SeasonInput) {
    this.calls.push(`createSeason:${input.code}`);
    const created: Season = { id: 'season-2', ...input, status: 'ACTIVE', version: 1 };
    this.seasons.push(created);
    return created;
  }
  async updateSeason(id: string, input: SeasonInput) {
    this.calls.push(`updateSeason:${id}`);
    const updated: Season = { id, ...input, status: 'ACTIVE', version: 2 };
    this.seasons = this.seasons.map((item) => item.id === id ? updated : item);
    return updated;
  }
  async closeSeason(id: string) { this.calls.push(`closeSeason:${id}`); return { ...season, id, status: 'CLOSED' as const }; }
  async cancelSeason(id: string, reason: string) { this.calls.push(`cancelSeason:${id}:${reason}`); return { ...season, id, status: 'CANCELLED' as const }; }
  async listPrograms() { this.calls.push('listPrograms'); return [...this.programs]; }
  async getProgram(id: string) { this.calls.push(`getProgram:${id}`); return this.programs.find((item) => item.id === id)!; }
  async createProgram(input: ProgramInput) {
    this.calls.push(`createProgram:${input.code}`);
    const created: Program = {
      id: 'program-2',
      code: input.code,
      type: input.type,
      seasonId: input.seasonId,
      arabicName: input.arabicName,
      snapshot: {
        departureDate: input.departureDate,
        returnDate: input.returnDate,
        salesStart: input.salesStart,
        salesClose: input.salesClose,
        capacity: input.capacity,
        currency: input.currency,
        prices: input.prices,
        requirements: input.requirements ?? [],
        components: input.components ?? [],
      },
      temporaryHoldMinutes: input.temporaryHoldMinutes ?? 15,
      status: 'PREPARING',
      bookingOpen: false,
      currentVersion: 1,
      currentVersionId: 'version-new',
    };
    this.programs.push(created);
    return created;
  }
  async editProgram(id: string) { this.calls.push(`editProgram:${id}`); return { ...program, id }; }
  async amendProgram(id: string, _input: ProgramInput, reason: string) { this.calls.push(`amendProgram:${id}:${reason}`); return { ...program, id, currentVersion: 3 }; }
  async versions(id: string) { this.calls.push(`versions:${id}`); return [version]; }
  async openProgram(id: string) { this.calls.push(`openProgram:${id}`); return { ...program, id, status: 'BOOKABLE' as const, bookingOpen: true }; }
  async setBookingAvailability(id: string, open: boolean) { this.calls.push(`booking:${id}:${open}`); return { ...program, id, bookingOpen: open }; }
  async recordDeparture(id: string) { this.calls.push(`departure:${id}`); return { ...program, id, status: 'IN_TRIP' as const, bookingOpen: false }; }
  async recordReturn(id: string) { this.calls.push(`return:${id}`); return { ...program, id, status: 'CLOSED' as const, bookingOpen: false }; }
  async cancelProgram(id: string, reason: string) { this.calls.push(`cancelProgram:${id}:${reason}`); return { ...program, id, status: 'CANCELLED' as const, bookingOpen: false }; }
  async reopenProgram(id: string, reason: string) { this.calls.push(`reopenProgram:${id}:${reason}`); return { ...program, id, status: 'IN_TRIP' as const, bookingOpen: false }; }
}

test('seasons are loaded from the API boundary and rendered from returned data', async () => {
  const api = new FakeApi();
  const rows = await loadSeasons(api);
  assert.deepEqual(api.calls, ['listSeasons']);
  const html = renderToStaticMarkup(createElement(SeasonsView, { rows, capabilities: fullCapabilities }));
  assert.match(html, /موسم العمرة 1448/);
  assert.match(html, /1448/);
});

test('season creation invokes persistence then reloads and the resulting UI includes the created season', async () => {
  const api = new FakeApi();
  const input: SeasonInput = {
    code: '1449',
    arabicName: 'موسم العمرة 1449',
    operatingStart: '2027-07-01',
    operatingEnd: '2028-06-30',
    salesStart: '2027-06-01',
    salesEnd: '2028-06-01',
  };
  const rows = await createSeasonAndReload(api, input);
  assert.deepEqual(api.calls, ['createSeason:1449', 'listSeasons']);
  const html = renderToStaticMarkup(createElement(SeasonsView, { rows, capabilities: fullCapabilities }));
  assert.match(html, /موسم العمرة 1449/);
});

test('programs are loaded from the API boundary with returned lifecycle and availability state', async () => {
  const api = new FakeApi();
  const rows = await loadPrograms(api);
  assert.deepEqual(api.calls, ['listPrograms']);
  const html = renderToStaticMarkup(createElement(ProgramsView, { rows, capabilities: fullCapabilities }));
  assert.match(html, /عمرة رجب/);
  assert.match(html, /متاح للحجز/);
  assert.match(html, /الحجز مغلق/);
});

test('program creation persists through API then reloads the server list', async () => {
  const api = new FakeApi();
  const input: ProgramInput = {
    code: 'UM-2',
    type: 'UMRAH',
    seasonId: season.id,
    arabicName: 'عمرة شعبان',
    departureDate: '2027-02-01',
    returnDate: '2027-02-10',
    salesStart: '2026-11-01',
    salesClose: '2027-01-20',
    capacity: '30',
    currency: 'EGP',
    prices: { double: '30000' },
  };
  const rows = await createProgramAndReload(api, input);
  assert.deepEqual(api.calls, ['createProgram:UM-2', 'listPrograms']);
  assert.ok(rows.some((item) => item.code === 'UM-2'));
});

test('booking availability is independent from lifecycle in the workspace', () => {
  const closedSales = renderToStaticMarkup(createElement(ProgramWorkspaceView, {
    program,
    versions: [version],
    capabilities: fullCapabilities,
  }));
  assert.match(closedSales, /متاح للحجز/);
  assert.match(closedSales, /الحجز مغلق/);

  const openSales = renderToStaticMarkup(createElement(ProgramWorkspaceView, {
    program: { ...program, bookingOpen: true },
    versions: [version],
    capabilities: fullCapabilities,
  }));
  assert.match(openSales, /متاح للحجز/);
  assert.match(openSales, /الحجز متاح/);
});

test('lifecycle actions call the exact API operation and use returned persisted state', async () => {
  const api = new FakeApi();
  const departed = await applyProgramAction(api, program.id, 'departure');
  assert.deepEqual(api.calls, ['departure:program-1']);
  assert.equal(departed.status, 'IN_TRIP');
  assert.equal(departed.bookingOpen, false);

  api.calls.length = 0;
  const bookingOpened = await applyProgramAction(api, program.id, 'booking-open');
  assert.deepEqual(api.calls, ['booking:program-1:true']);
  assert.equal(bookingOpened.status, 'BOOKABLE');
  assert.equal(bookingOpened.bookingOpen, true);
});

test('unauthorized actions are absent from rendered season and program controls', () => {
  const seasonHtml = renderToStaticMarkup(createElement(SeasonsView, {
    rows: [season],
    capabilities: emptyCapabilities,
    onEdit: () => undefined,
    onClose: () => undefined,
    onCancel: () => undefined,
  }));
  assert.doesNotMatch(seasonHtml, />تعديل</);
  assert.doesNotMatch(seasonHtml, />إغلاق</);
  assert.doesNotMatch(seasonHtml, />إلغاء</);

  const programHtml = renderToStaticMarkup(createElement(ProgramWorkspaceView, {
    program,
    versions: [version],
    capabilities: emptyCapabilities,
    onAction: () => undefined,
    onCancel: () => undefined,
    onReopen: () => undefined,
  }));
  assert.doesNotMatch(programHtml, /فتح الحجز|إغلاق الحجز|تسجيل المغادرة|إلغاء البرنامج|إعادة فتح/);
});

test('API failures are rendered as user-visible feedback states', () => {
  const seasonHtml = renderToStaticMarkup(createElement(SeasonsView, {
    rows: [],
    capabilities: emptyCapabilities,
    error: 'تعذر تحميل المواسم من الخادم',
  }));
  assert.match(seasonHtml, /تعذر تحميل المواسم من الخادم/);
  assert.match(seasonHtml, /role="alert"/);

  const programHtml = renderToStaticMarkup(createElement(ProgramsView, {
    rows: [],
    capabilities: emptyCapabilities,
    error: 'تعذر تحميل البرامج من الخادم',
  }));
  assert.match(programHtml, /تعذر تحميل البرامج من الخادم/);
});
