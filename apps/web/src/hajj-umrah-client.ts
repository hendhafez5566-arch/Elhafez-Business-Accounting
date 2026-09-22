import { crmRequest } from './crm-core-client.js';

export type SeasonStatus = 'ACTIVE' | 'CLOSED' | 'CANCELLED';
export interface Season {
  readonly id: string;
  readonly code: string;
  readonly arabicName: string;
  readonly englishName?: string;
  readonly hijriLabel?: string;
  readonly operatingStart: string;
  readonly operatingEnd: string;
  readonly salesStart: string;
  readonly salesEnd: string;
  readonly notes?: string;
  readonly status: SeasonStatus;
  readonly version: number;
}
export interface SeasonInput {
  readonly code: string;
  readonly arabicName: string;
  readonly englishName?: string;
  readonly hijriLabel?: string;
  readonly operatingStart: string;
  readonly operatingEnd: string;
  readonly salesStart: string;
  readonly salesEnd: string;
  readonly notes?: string;
}

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
export interface ProgramComponent {
  readonly type: Requirement | 'MEETING' | 'CUSTOM';
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
  readonly single?: string;
  readonly double?: string;
  readonly triple?: string;
  readonly quad?: string;
  readonly quint?: string;
  readonly childWithBed?: string;
  readonly childWithoutBed?: string;
  readonly infant?: string;
}
export interface ProgramInput {
  readonly code: string;
  readonly type: ProgramType;
  readonly seasonId: string;
  readonly arabicName: string;
  readonly englishName?: string;
  readonly groupNumber?: string;
  readonly groupDescription?: string;
  readonly departureDate: string;
  readonly returnDate: string;
  readonly salesStart: string;
  readonly salesClose: string;
  readonly capacity: string;
  readonly currency: string;
  readonly prices: ProgramPrices;
  readonly requirements?: Requirement[];
  readonly components?: ProgramComponent[];
  readonly temporaryHoldMinutes?: number;
  readonly minimumDepositPolicy?: string;
  readonly cancellationPolicy?: string;
  readonly notes?: string;
  readonly operationsManager?: string;
  readonly groupLeader?: string;
  readonly guide?: string;
  readonly contact?: string;
}
export interface Program {
  readonly id: string;
  readonly code: string;
  readonly type: ProgramType;
  readonly seasonId: string;
  readonly arabicName: string;
  readonly englishName?: string;
  readonly groupNumber?: string;
  readonly groupDescription?: string;
  readonly snapshot: {
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
  };
  readonly temporaryHoldMinutes: number;
  readonly minimumDepositPolicy?: string;
  readonly notes?: string;
  readonly operationsManager?: string;
  readonly groupLeader?: string;
  readonly guide?: string;
  readonly contact?: string;
  readonly status: ProgramStatus;
  readonly bookingOpen: boolean;
  readonly currentVersion: number;
  readonly currentVersionId: string;
  readonly departureRecordedAt?: string;
  readonly returnRecordedAt?: string;
}
export interface ProgramVersion {
  readonly id: string;
  readonly version: number;
  readonly effectiveAt: string;
  readonly reason: string;
  readonly actorId: string;
}

export interface HajjUmrahCapabilities {
  readonly seasonManage: boolean;
  readonly seasonLifecycle: boolean;
  readonly programCreate: boolean;
  readonly programEdit: boolean;
  readonly programAmend: boolean;
  readonly programAvailability: boolean;
  readonly programLifecycle: boolean;
  readonly programCancel: boolean;
  readonly programReopen: boolean;
  readonly programClose: boolean;
}

export interface HajjUmrahApi {
  capabilities(): Promise<HajjUmrahCapabilities>;
  listSeasons(): Promise<Season[]>;
  getSeason(id: string): Promise<Season>;
  createSeason(input: SeasonInput): Promise<Season>;
  updateSeason(id: string, input: SeasonInput): Promise<Season>;
  closeSeason(id: string): Promise<Season>;
  cancelSeason(id: string, reason: string): Promise<Season>;
  listPrograms(): Promise<Program[]>;
  getProgram(id: string): Promise<Program>;
  createProgram(input: ProgramInput): Promise<Program>;
  editProgram(id: string, input: ProgramInput): Promise<Program>;
  amendProgram(id: string, input: ProgramInput, reason: string): Promise<Program>;
  versions(id: string): Promise<ProgramVersion[]>;
  openProgram(id: string): Promise<Program>;
  setBookingAvailability(id: string, open: boolean): Promise<Program>;
  recordDeparture(id: string): Promise<Program>;
  recordReturn(id: string): Promise<Program>;
  cancelProgram(id: string, reason: string): Promise<Program>;
  reopenProgram(id: string, reason: string): Promise<Program>;
}

const enc = encodeURIComponent;
const get = <T>(path: string) => crmRequest<T>(path);
const post = <T>(path: string, body: unknown = {}) =>
  crmRequest<T>(path, { method: 'POST', body: JSON.stringify(body) });
const patch = <T>(path: string, body: unknown) =>
  crmRequest<T>(path, { method: 'PATCH', body: JSON.stringify(body) });

export const hajjUmrahApi: HajjUmrahApi = {
  capabilities: () => get('/hajj-umrah/capabilities'),
  listSeasons: () => get('/hajj-umrah/seasons'),
  getSeason: (id) => get(`/hajj-umrah/seasons/${enc(id)}`),
  createSeason: (input) => post('/hajj-umrah/seasons', input),
  updateSeason: (id, input) => patch(`/hajj-umrah/seasons/${enc(id)}`, input),
  closeSeason: (id) => post(`/hajj-umrah/seasons/${enc(id)}/close`),
  cancelSeason: (id, reason) => post(`/hajj-umrah/seasons/${enc(id)}/cancel`, { reason }),
  listPrograms: () => get('/hajj-umrah/programs'),
  getProgram: (id) => get(`/hajj-umrah/programs/${enc(id)}`),
  createProgram: (input) => post('/hajj-umrah/programs', input),
  editProgram: (id, input) => patch(`/hajj-umrah/programs/${enc(id)}/preparing`, input),
  amendProgram: (id, input, reason) => post(`/hajj-umrah/programs/${enc(id)}/amend`, { input, reason }),
  versions: (id) => get(`/hajj-umrah/programs/${enc(id)}/versions`),
  openProgram: (id) => post(`/hajj-umrah/programs/${enc(id)}/open`),
  setBookingAvailability: (id, open) => patch(`/hajj-umrah/programs/${enc(id)}/booking-availability`, { open }),
  recordDeparture: (id) => post(`/hajj-umrah/programs/${enc(id)}/departure`),
  recordReturn: (id) => post(`/hajj-umrah/programs/${enc(id)}/return`),
  cancelProgram: (id, reason) => post(`/hajj-umrah/programs/${enc(id)}/cancel`, { reason }),
  reopenProgram: (id, reason) => post(`/hajj-umrah/programs/${enc(id)}/reopen`, { reason }),
};

export const emptyCapabilities: HajjUmrahCapabilities = {
  seasonManage: false,
  seasonLifecycle: false,
  programCreate: false,
  programEdit: false,
  programAmend: false,
  programAvailability: false,
  programLifecycle: false,
  programCancel: false,
  programReopen: false,
  programClose: false,
};
