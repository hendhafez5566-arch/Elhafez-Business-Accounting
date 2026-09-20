import { createHash } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { HistoricalEquivalence, HistoricalImportRecord } from '../application/historical-import.application-service.js';
import type { HistoricalImportRepository } from '../application/historical-import.repository.js';

const add=(a:string,b:string):string=>{const scale=Math.max((a.split('.')[1]??'').length,(b.split('.')[1]??'').length);const unit=10n**BigInt(scale);const parse=(v:string)=>{const negative=v.startsWith('-'),parts=(negative?v.slice(1):v).split('.'),i=parts[0]??'0',f=parts[1]??'';const n=BigInt(i)*unit+BigInt((f+'0'.repeat(scale)).slice(0,scale));return negative?-n:n};const n=parse(a)+parse(b),sign=n<0n?'-':'',abs=n<0n?-n:n,s=abs.toString().padStart(scale+1,'0');return scale?`${sign}${s.slice(0,-scale)}.${s.slice(-scale)}`:`${sign}${s}`};
const str=(v:unknown,fallback?:string):string=>typeof v==='string'&&v.length?v:(fallback??'');
const optional=(v:unknown):string|undefined=>typeof v==='string'&&v.length?v:undefined;

/** AC-14 restore adapter. Canonical GL rows and provenance are committed atomically. */
export class PrismaHistoricalImportRepository implements HistoricalImportRepository {
  constructor(private readonly db:PrismaClient){}
  async find(runId:string,collection:string,sourceId:string){const v=await this.db.generalLedgerHistoricalImport.findUnique({where:{runId_collection_sourceId:{runId,collection,sourceId}}});return v?{...v,owner:'GeneralLedger',payload:v.payload as Record<string,unknown>,branchId:v.branchId??undefined,debit:v.debit.toString(),credit:v.credit.toString(),amount:v.amount.toString()} as HistoricalImportRecord:undefined}
  async create(r:HistoricalImportRecord){
    await this.db.$transaction(async tx=>{
      if(r.collection==='accounts') await this.restoreAccount(tx,r);
      else if(r.collection==='journals') await this.restoreJournal(tx,r);
      else throw new Error(`unsupported GeneralLedger historical collection ${r.collection}`);
      await tx.generalLedgerHistoricalImport.create({data:{id:r.id,runId:r.runId,collection:r.collection,sourceId:r.sourceId,sourcePayloadHash:r.sourcePayloadHash,companyId:r.companyId,branchId:r.branchId,payload:r.payload as object,payloadJson:r.payloadJson,debit:r.debit,credit:r.credit,amount:r.amount}});
    });
  }
  async equivalence(runId:string,companyId:string):Promise<HistoricalEquivalence>{
    const provenance=await this.db.generalLedgerHistoricalImport.findMany({where:{runId,companyId},orderBy:[{collection:'asc'},{sourceId:'asc'}]});
    const ids=(collection:string)=>provenance.filter(x=>x.collection===collection).map(x=>x.sourceId);
    const accounts=await this.db.glAccount.findMany({where:{companyId,id:{in:ids('accounts')}},orderBy:{id:'asc'}});
    const journals=await this.db.glJournal.findMany({where:{companyId,id:{in:ids('journals')}},include:{lines:{orderBy:{id:'asc'}}},orderBy:{id:'asc'}});
    const canonical=[...accounts.map(x=>({collection:'accounts',id:x.id,code:x.code,name:x.name,classification:x.classification,active:x.active,postable:x.postable,parentId:x.parentId,controlType:x.controlType})),...journals.map(x=>({collection:'journals',id:x.id,number:x.number,postingDate:x.postingDate.toISOString().slice(0,10),kind:x.kind,sourceType:x.sourceType,sourceId:x.sourceId,reversalOfId:x.reversalOfId,lines:x.lines.map(l=>({id:l.id,accountId:l.accountId,debit:l.debit?.toString(),credit:l.credit?.toString(),partyId:l.partyId,costCenterId:l.costCenterId,foreignAmount:l.foreignAmount?.toString(),foreignCurrency:l.foreignCurrency,fxRateId:l.fxRateId,fxRate:l.fxRate?.toString()}))}))];
    const debit=journals.flatMap(x=>x.lines).reduce((a,x)=>add(a,x.debit?.toString()??'0'),'0');
    const credit=journals.flatMap(x=>x.lines).reduce((a,x)=>add(a,x.credit?.toString()??'0'),'0');
    return {records:String(canonical.length),payloadDigest:createHash('sha256').update(JSON.stringify(canonical)).digest('hex'),debit,credit,amount:'0',journalCount:String(journals.length),foreignCurrencyEvidence:String(journals.flatMap(x=>x.lines).filter(x=>x.foreignCurrency&&x.foreignAmount!==null).length),fxRateEvidence:String(journals.flatMap(x=>x.lines).filter(x=>x.fxRate!==null).length),reversalLineage:String(journals.filter(x=>x.kind==='REVERSAL'&&x.reversalOfId).length)};
  }
  private async restoreAccount(tx:Prisma.TransactionClient,r:HistoricalImportRecord){const p=r.payload;await tx.glAccount.create({data:{id:r.sourceId,companyId:r.companyId,code:str(p.code,r.sourceId),name:str(p.name,r.sourceId),classification:str(p.classification,'ASSET'),active:p.active!==false,postable:p.postable!==false,parentId:optional(p.parentId),controlType:optional(p.controlType)}})}
  private async restoreJournal(tx:Prisma.TransactionClient,r:HistoricalImportRecord){
    const p=r.payload;
    const lines=Array.isArray(p.lines)?p.lines:[];
    if(!lines.length)throw new Error('historical journal requires lines');
    await tx.glJournal.create({data:{id:r.sourceId,companyId:r.companyId,number:str(p.number,r.sourceId),postingDate:new Date(str(p.postingDate,str(p.date))),kind:str(p.kind,'STANDARD'),sourceType:str(p.sourceType,'HISTORICAL'),sourceId:str(p.sourceId,r.sourceId),requestHash:r.sourcePayloadHash,correlationId:optional(p.correlationId),reversalOfId:optional(p.reversalOfId)??optional(p.reversalSourceId),fiscalYearId:optional(p.fiscalYearId)}});
    await tx.glJournalLine.createMany({data:lines.map((raw,index)=>{
      if(raw===null||typeof raw!=='object'||Array.isArray(raw))throw new Error('invalid historical journal line');
      const l=raw as Record<string,unknown>;
      return {id:str(l.id,`${r.sourceId}:line:${index+1}`),companyId:r.companyId,journalId:r.sourceId,accountId:str(l.accountId),...(l.debit!==undefined?{debit:str(l.debit)}:{}),...(l.credit!==undefined?{credit:str(l.credit)}:{}),partyId:optional(l.partyId),costCenterId:optional(l.costCenterId),...(l.foreignAmount!==undefined?{foreignAmount:str(l.foreignAmount)}:{}),foreignCurrency:optional(l.foreignCurrency),fxRateId:optional(l.fxRateId),...(l.fxRate!==undefined?{fxRate:str(l.fxRate)}:{})};
    })});
  }
}
