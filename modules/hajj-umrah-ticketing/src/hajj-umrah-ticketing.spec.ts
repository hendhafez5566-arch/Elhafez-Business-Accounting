import assert from 'node:assert/strict';
import test from 'node:test';
import { executionContext, sourceReference, type CompanyId, type ExecutionContext, type SourceReference } from '@elhafez/contracts';
import { HajjUmrahTicketingApplicationService } from './application/hajj-umrah-ticketing.application-service.js';
import type { TicketRepository } from './application/ticket.repository.js';
import type { TicketAccess, TicketFinancePort } from './application/ticket.ports.js';
import type { TicketHistory, TicketRecord } from './domain/ticket.js';

class MemoryTickets implements TicketRepository {
  readonly rows = new Map<string, TicketRecord>();
  readonly historyRows: TicketHistory[] = [];
  async create(value: TicketRecord, history: TicketHistory) { this.rows.set(value.id, value); this.historyRows.push(history); return value; }
  async save(value: TicketRecord, history: TicketHistory) { this.rows.set(value.id, value); this.historyRows.push(history); return value; }
  async get(companyId: string, branchId: string, id: string) { const row=this.rows.get(id); return row?.companyId===companyId&&row.branchId===branchId?row:null; }
  async list(companyId: string, branchId: string, programId?: string) { return [...this.rows.values()].filter(row=>row.companyId===companyId&&row.branchId===branchId&&(!programId||row.programId===programId)); }
  async history(companyId: string, branchId: string, id: string) { return this.historyRows.filter(row=>row.companyId===companyId&&row.branchId===branchId&&row.ticketId===id); }
}
class Access implements TicketAccess {
  async requireBranch(context: ExecutionContext) { if(context.branchId!=='b1') throw new Error('branch denied'); }
  async requirePermission() {}
  async audit() {}
}
const context=executionContext('c1','b1','u1');
const realSegment:SourceReference=sourceReference('FLIGHT_SEGMENT','MS-845:CAI-JED:2027-01-01T06:00Z');

function fixture(segment:SourceReference|undefined=realSegment){
  const repo=new MemoryTickets();
  let sequence=0;
  const forwarded:Parameters<TicketFinancePort['actualize']>[0][]=[];
  const service=new HajjUmrahTicketingApplicationService(
    repo,new Access(),
    {async requireTraveler(){return{id:'b',companyId:'c1' as CompanyId,branchId:'b1',code:'B',programId:'p1',customerId:'c',customerPartyId:'party',travelerIds:['t1'],status:'CONFIRMED',financialState:'CONFIRMED',allocationIds:['a1'],createdAt:'',updatedAt:''}}},
    {async requireActive(_context,id){return{id:id as never,companyId:'c1' as CompanyId,fullName:'T',dateOfBirth:null,gender:null,nationality:null,partyId:null,customerId:null,status:'ACTIVE',createdAt:'',updatedAt:''}}},
    {async allocation(){return{id:'a1',companyId:'c1' as CompanyId,contractId:'fc',contractVersionId:'fv',resourceType:'FLIGHT_BLOCK',resourceId:'flight-block-1',program:sourceReference('HAJJ_UMRAH_PROGRAM','p1'),serviceDate:'2027-01-01',quantity:'1' as never,status:'CONFIRMED',...(segment?{flightSegmentReference:segment}:{}),createdAt:''}}},
    {async actualize(input){forwarded.push(input);return{workflowId:`w-${forwarded.length}`}}},
    ()=>new Date('2026-09-22T00:00:00Z'),()=>`id-${++sequence}`,
  );
  return {repo,service,forwarded};
}

test('ticket reservation blocks a flight allocation that lacks persisted real segment evidence',async()=>{
  const value=fixture(undefined);
  await assert.rejects(
    ()=>value.service.reserve(context,{bookingId:'b',travelerId:'t1',allocationId:'a1',pnr:'PNR1'}),
    /persisted real flight-segment evidence/,
  );
});

test('ticket stores canonical segment snapshot and forwards the exact reference to TFO',async()=>{
  const value=fixture();
  const ticket=await value.service.reserve(context,{bookingId:'b',travelerId:'t1',allocationId:'a1',pnr:'PNR1'});
  assert.deepEqual(ticket.flightSegmentReference,realSegment);
  const issued=await value.service.issue(context,ticket.id,{commandKey:'issue:1',ticketNumber:'T-1',amount:'50',postingDate:'2026-09-22'});
  assert.equal(issued.status,'ISSUED');
  assert.equal(value.forwarded.length,1);
  assert.deepEqual(value.forwarded[0]?.flightSegmentReference,realSegment);
  assert.notDeepEqual(value.forwarded[0]?.flightSegmentReference,{sourceType:'TCI_FLIGHT_BLOCK',sourceId:'flight-block-1'});
});

test('reissue and void preserve full history',async()=>{
  const value=fixture();
  const ticket=await value.service.reserve(context,{bookingId:'b',travelerId:'t1',allocationId:'a1',pnr:'PNR1'});
  await value.service.issue(context,ticket.id,{commandKey:'issue:1',ticketNumber:'T-1',amount:'50',postingDate:'2026-09-22'});
  const reissued=await value.service.reissue(context,ticket.id,{commandKey:'reissue:1',ticketNumber:'T-2',amount:'10',postingDate:'2026-09-22'});
  assert.equal(reissued.status,'REISSUED');
  await value.service.voidTicket(context,ticket.id,'schedule change');
  assert.deepEqual((await value.service.historyFor(context,ticket.id)).map(row=>row.action),['RESERVED','ISSUED','REISSUED','VOIDED']);
});

test('company branch isolation is enforced',async()=>{
  const value=fixture();
  await assert.rejects(()=>value.service.list(executionContext('c1','other','u1')),/branch denied/);
});
