import type { HistoricalImportRepository } from './historical-import.repository.js';

export interface HistoricalImportCommand { readonly runId:string; readonly collection:string; readonly sourceId:string; readonly sourcePayloadHash:string; readonly companyId:string; readonly branchId?:string; readonly payload:Readonly<Record<string,unknown>> }
export interface HistoricalImportResult { readonly status:'IMPORTED'|'CONVERGED'; readonly targetKind:string; readonly targetId:string }
export interface HistoricalEquivalence { readonly records:string; readonly payloadDigest:string; readonly debit:string; readonly credit:string; readonly amount:string }
export interface HistoricalImportRecord extends HistoricalImportCommand { readonly id:string; readonly owner:string; readonly payloadJson:string; readonly debit:string; readonly credit:string; readonly amount:string; readonly createdAt:Date }

const canonical=(v:unknown):unknown=>Array.isArray(v)?v.map(canonical):v!==null&&typeof v==='object'?Object.fromEntries(Object.keys(v as Record<string,unknown>).sort().map(k=>[k,canonical((v as Record<string,unknown>)[k])])):v;
const decimal=/^-?\d+(?:\.\d+)?$/;
function exact(value:unknown,name:string):string { if(value===undefined||value===null||value==='')return '0'; if(typeof value!=='string'||!decimal.test(value))throw new Error(`${name} must be an exact decimal string`); return value; }

/** Owner-only historical boundary. It persists immutable source truth and never invokes normal posting commands. */
export class HistoricalImportApplicationService {
  static readonly owner='ExpenseRecognition';
  constructor(private readonly repository:HistoricalImportRepository){}
  validate(command:HistoricalImportCommand):HistoricalImportRecord {
    if(!command.runId||!command.collection||!command.sourceId||!command.companyId||!/^[a-f0-9]{64}$/i.test(command.sourcePayloadHash))throw new Error('invalid historical import identity');
    const payloadJson=JSON.stringify(canonical(command.payload));
    // sourcePayloadHash covers the raw source object. Canonical payload is retained separately for owner evidence.
    return Object.freeze({...command,id:`${command.runId}:${command.collection}:${command.sourceId}`,owner:HistoricalImportApplicationService.owner,payloadJson,debit:exact(command.payload.debit,'debit'),credit:exact(command.payload.credit,'credit'),amount:exact(command.payload.amount,'amount'),createdAt:new Date(0)});
  }
  async importHistorical(command:HistoricalImportCommand):Promise<HistoricalImportResult>{ const record=this.validate(command); const existing=await this.repository.find(record.runId,record.collection,record.sourceId); if(existing){if(existing.sourcePayloadHash!==record.sourcePayloadHash||existing.payloadJson!==record.payloadJson)throw new Error('historical source identity conflict');return {status:'CONVERGED',targetKind:record.collection,targetId:existing.id};} await this.repository.create(record); return {status:'IMPORTED',targetKind:record.collection,targetId:record.id}; }
  async equivalence(runId:string,companyId:string):Promise<HistoricalEquivalence>{return this.repository.equivalence(runId,companyId)}
}
