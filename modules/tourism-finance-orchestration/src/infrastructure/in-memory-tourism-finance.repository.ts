import type { CompanyId, SourceReference } from '@elhafez/contracts';
import type { TourismFinanceRepository } from '../application/orchestration.repository.js';
import type { BookingReference, FinancialSetup, ProgramHistory, ServiceFinancialSnapshot, Workflow, WorkflowStep } from '../domain/orchestration.js';
const key = (reference: SourceReference) => `${reference.sourceType}:${reference.sourceId}`;
export class InMemoryTourismFinanceRepository implements TourismFinanceRepository {
  workflows = new Map<string, Workflow>(); steps = new Map<string, WorkflowStep>(); setups = new Map<string, FinancialSetup>(); bookings = new Map<string, BookingReference>(); snapshots: ServiceFinancialSnapshot[] = []; history: ProgramHistory[] = [];
  async reserveWorkflow(value: Workflow) { const mapKey = `${value.companyId}:${value.commandKey}`; const old = this.workflows.get(mapKey); if (old) return old; this.workflows.set(mapKey, value); return value; }
  async workflow(companyId: CompanyId, commandKey: string) { return this.workflows.get(`${companyId}:${commandKey}`); }
  async workflowById(companyId: CompanyId, id: string) { return [...this.workflows.values()].find((item) => item.companyId === companyId && item.id === id); }
  async workflowsForProgram(companyId: CompanyId, program: SourceReference) { return [...this.workflows.values()].filter((item) => item.companyId === companyId && item.sourceType === program.sourceType && item.sourceId === program.sourceId); }
  async workflowsForBooking(companyId: CompanyId, booking: SourceReference) { return [...this.workflows.values()].filter((item) => item.companyId === companyId && item.sourceType === booking.sourceType && item.sourceId === booking.sourceId); }
  async saveWorkflow(value: Workflow) { this.workflows.set(`${value.companyId}:${value.commandKey}`, value); }
  async step(companyId: CompanyId, workflowId: string, name: string) { return this.steps.get(`${companyId}:${workflowId}:${name}`); }
  async reserveStep(value: WorkflowStep) { const mapKey = `${value.companyId}:${value.workflowId}:${value.name}`; const old = this.steps.get(mapKey); if (old) return old; this.steps.set(mapKey, value); return value; }
  async completeStep(companyId: CompanyId, id: string, ownerReference: string | undefined, result: unknown) { const entry = [...this.steps.entries()].find(([, value]) => value.companyId === companyId && value.id === id); if (!entry) throw new Error('step not found'); const value = { ...entry[1], status: 'COMPLETED' as const, ...(ownerReference ? { ownerReference } : {}), result, completedAt: new Date().toISOString() }; this.steps.set(entry[0], value); return value; }
  async saveSetup(value: FinancialSetup) { this.setups.set(`${value.companyId}:${value.category}`, value); }
  async setup(companyId: CompanyId, category: string) { return this.setups.get(`${companyId}:${category}`); }
  async reserveBooking(value: BookingReference) { const mapKey = `${value.companyId}:${key(value.booking)}`; const old = this.bookings.get(mapKey); if (old) return old; this.bookings.set(mapKey, structuredClone(value)); return structuredClone(value); }
  async saveBooking(value: BookingReference) { this.bookings.set(`${value.companyId}:${key(value.booking)}`, structuredClone(value)); }
  async booking(companyId: CompanyId, source: SourceReference) { return this.bookings.get(`${companyId}:${key(source)}`); }
  async bookingsForProgram(companyId: CompanyId, program: SourceReference) { return [...this.bookings.values()].filter((item) => item.companyId === companyId && key(item.program) === key(program)); }
  async reserveSnapshot(value: ServiceFinancialSnapshot) { const old = this.snapshots.find((item) => item.companyId === value.companyId && key(item.service) === key(value.service) && item.version === value.version); if (old) return old; this.snapshots.push(value); return value; }
  async latestSnapshot(companyId: CompanyId, service: SourceReference) { return this.snapshots.filter((item) => item.companyId === companyId && key(item.service) === key(service)).sort((left, right) => right.version - left.version)[0]; }
  async saveProgramHistory(value: ProgramHistory) { if (!this.history.some((item) => item.companyId === value.companyId && item.id === value.id)) this.history.push(value); }
  async programHistory(companyId: CompanyId, program: SourceReference) { return this.history.filter((item) => item.companyId === companyId && key(item.program) === key(program)); }
}
