import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { MigrationControlApplicationService, type AcceptedSourceIdentity, type MigrationConfig, type MigrationIssueCode } from '@elhafez/platform-core';
import { ACCEPTED_LEGACY_SOURCE_IDENTITY } from './config.js';
import { readRawSnapshot } from './snapshot-reader.js';
import { AC14_STAGES } from './stages.js';
import { AC14_OWNER_IMPORT_GATEWAY, type Ac14OwnerImportGateway, type EquivalenceValues, type HistoricalImportUnit } from './owner-import.gateway.js';
import { assertCompleteGoldenScenarioRegistry } from './golden-scenario.registry.js';
import { LegacyJournalValidationError, normalizeLegacyJournal } from './legacy-journal.js';
export interface Ac14ExecutionRequest { snapshotPath?:string; targetBaselineSha:string; implementationVersion:string; declaredSourceIdentity:AcceptedSourceIdentity; config:MigrationConfig; mode:'DRY_RUN'|'EXECUTE'|'RESUME'|'VERIFY' }
const objectRecord=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const canonical=(v:unknown):unknown=>Array.isArray(v)?v.map(canonical):objectRecord(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
const sourceId=(r:Record<string,unknown>)=>typeof r.id==='string'&&r.id.trim()?r.id.trim():undefined;
@Injectable()
export class Ac14MigrationCoordinator {
 constructor(@Inject(MigrationControlApplicationService)private readonly control:MigrationControlApplicationService,@Inject(AC14_OWNER_IMPORT_GATEWAY)private readonly owners:Ac14OwnerImportGateway){}
 async run(request:Ac14ExecutionRequest){
  this.control.validateSourceIdentity(request.declaredSourceIdentity,ACCEPTED_LEGACY_SOURCE_IDENTITY);this.control.validateConfig(request.config);
  if(request.mode==='VERIFY')return this.verifyExisting(this.requiredRunId(request.config));
  if(!request.snapshotPath)throw new Error('snapshotPath is required');
  const snapshot=await readRawSnapshot(request.snapshotPath);
  const created=await this.control.createRun({...request.declaredSourceIdentity,targetBaselineSha:request.targetBaselineSha,implementationVersion:request.implementationVersion,mode:request.mode,config:request.config});
  await this.control.registerSourceSha256(created.id,snapshot.sha256);
  if(request.mode==='RESUME'&&created.status!=='PAUSED'&&created.status!=='RUNNING'&&created.status!=='FAILED')throw new Error('resume requires an existing paused, running, or failed run');
  const write=request.mode!=='DRY_RUN';
  if(write&&(created.status==='PLANNED'||created.status==='PAUSED'))await this.control.transitionRunStatus(created.id,'RUNNING');
  for(const [stage,owner,collections] of AC14_STAGES){
   if(!owner)continue;
   const prior=await this.control.getCheckpoint(created.id,stage);if(write&&prior?.status==='COMPLETE')continue;
   let count=prior?.processedCount??0;if(write)await this.control.recordCheckpoint({runId:created.id,stage,cursor:prior?.cursor,processedCount:count,status:'IN_PROGRESS'});
   for(const collection of collections){const raw=snapshot.root[collection];if(raw===undefined)continue;if(!Array.isArray(raw)){await this.issue(created.id,'UNKNOWN_COLLECTION_SHAPE',stage,collection,null,`${collection} must be an array`);continue;}
    for(const value of raw){if(!objectRecord(value)||!sourceId(value)){await this.issue(created.id,'SOURCE_IDENTITY_MISMATCH',stage,collection,null,'record requires a non-empty string id');continue;}const id=sourceId(value)!;const branch=this.resolveBranch(value.branchId,request.config);if(branch.error){await this.issue(created.id,branch.error,stage,collection,id,'source branch has no explicit target mapping');continue;}let payload=value;try{if(collection==='journals')payload=normalizeLegacyJournal(value) as Record<string,unknown>;}catch(error){if(!(error instanceof LegacyJournalValidationError))throw error;await this.issue(created.id,error.code,stage,collection,id,error.message);continue;}
     const unit:HistoricalImportUnit={runId:created.id,stage,owner,collection,sourceId:id,sourcePayloadHash:hash(value),targetCompanyId:request.config.targetCompanyId,...(branch.target?{targetBranchId:branch.target}:{}),payload};
     try{this.owners.validateUnit(unit);if(write){const outcome=await this.owners.importUnit(unit);if(outcome.status==='REJECTED'){await this.issue(created.id,outcome.code,stage,collection,id,outcome.detail);continue;}await this.control.recordCrosswalk({runId:created.id,sourceCollection:collection,sourceId:id,targetOwner:owner,targetKind:outcome.targetKind,targetId:outcome.targetId,sourcePayloadHash:unit.sourcePayloadHash});count++;await this.control.recordCheckpoint({runId:created.id,stage,cursor:`${collection}:${id}`,processedCount:count,status:'IN_PROGRESS'});}}catch(error){await this.issue(created.id,'UNSUPPORTED_LEGACY_CONSTRUCT',stage,collection,id,error instanceof Error?error.message:'owner validation failed');}
    }}if(write)await this.control.recordCheckpoint({runId:created.id,stage,processedCount:count,status:'COMPLETE'});
  }
  const evidence=await assertCompleteGoldenScenarioRegistry();
  if(!write){const issues=await this.control.listIssues(created.id);await this.control.reconcileRunCounts(created.id,0,issues.length);return this.control.transitionRunStatus(created.id,'DRY_RUN');}
  const reporting=await this.owners.rebuildReporting(created.id,request.config);
  if(reporting.evidenceCount==='0')await this.issue(created.id,'UNSUPPORTED_LEGACY_CONSTRUCT','reporting-rebuild','reporting',null,'canonical owner state produced no reporting evidence');
  await this.recordOwnerEquivalence(created.id,request.config.targetCompanyId,this.expectedEquivalence(snapshot.root));
  await this.control.recordCheckpoint({runId:created.id,stage:'golden-scenarios',processedCount:evidence.length,status:'COMPLETE'});
  await this.control.recordCheckpoint({runId:created.id,stage:'reporting-rebuild',processedCount:Number(reporting.evidenceCount),status:reporting.evidenceCount==='0'?'FAILED':'COMPLETE'});
  await this.control.recordCheckpoint({runId:created.id,stage:'equivalence',processedCount:this.owners.ownerNames().length,status:'COMPLETE'});
  const crosswalks=await this.control.listCrosswalks(created.id),issues=await this.control.listIssues(created.id);await this.control.reconcileRunCounts(created.id,crosswalks.length,issues.length);
  await this.control.transitionRunStatus(created.id,'VERIFYING');return this.readiness(created.id);
 }
 async status(runId:string){return{run:await this.control.getRun(runId),checkpoints:await this.control.listCheckpoints(runId),issues:await this.control.listIssues(runId),equivalence:await this.control.listEquivalence(runId)}}
 private async verifyExisting(runId:string){const run=await this.control.getRun(runId);await this.recordOwnerEquivalence(runId,run.targetCompanyId);return this.readiness(runId,false)}
 private async recordOwnerEquivalence(runId:string,companyId:string,expectedByOwner?:ReadonlyMap<string,EquivalenceValues>){const prior=await this.control.listEquivalence(runId);for(const owner of this.owners.ownerNames()){const actual=await this.owners.ownerEquivalence(owner,runId,companyId);const expected=expectedByOwner?.get(owner)??Object.fromEntries(prior.filter(x=>x.scope===owner).map(x=>[x.checkKey,x.expectedValue]));for(const key of Object.keys(expected).sort()){const expectedValue=expected[key]??'';const actualValue=actual[key]??'';await this.control.recordEquivalence({runId,scope:owner,checkKey:key,expectedValue,actualValue,status:expectedValue===actualValue?'MATCH':'MISMATCH'});}}}
 private async readiness(runId:string,transition=true){const issues=await this.control.listIssues(runId),eq=await this.control.listEquivalence(runId),cp=await this.control.listCheckpoints(runId);const required=AC14_STAGES.map(([stage])=>stage).filter(stage=>stage!=='source-preflight'&&stage!=='cutover-readiness');const scopes=new Set(eq.filter(x=>x.status==='MATCH').map(x=>x.scope));const ready=!issues.length&&!cp.some(x=>x.status==='FAILED')&&scopes.size===this.owners.ownerNames().length&&eq.every(x=>x.status==='MATCH')&&required.every(s=>cp.some(x=>x.stage===s&&x.status==='COMPLETE'))&&cp.some(x=>x.stage==='golden-scenarios'&&x.status==='COMPLETE'&&x.processedCount===40)&&cp.some(x=>x.stage==='reporting-rebuild'&&x.status==='COMPLETE'&&x.processedCount>0);await this.control.recordCheckpoint({runId,stage:'cutover-readiness',processedCount:ready?1:0,status:ready?'COMPLETE':'FAILED'});if(!transition)return{...(await this.status(runId)),ready};return this.control.transitionRunStatus(runId,ready?'READY':'FAILED')}
 private expectedEquivalence(root:Record<string,unknown>):ReadonlyMap<string,EquivalenceValues>{const result=new Map<string,EquivalenceValues>();for(const [,owner,collections] of AC14_STAGES){if(!owner)continue;const rows=collections.flatMap(collection=>{const value=root[collection];return Array.isArray(value)?value.filter(objectRecord).map(payload=>({collection,payload:collection==='journals'?normalizeLegacyJournal(payload):payload})):[];});const sum=(field:string)=>rows.reduce((total,row)=>addDecimal(total,decimalFrom(row.payload[field])),'0');const values:Record<string,string>={records:String(rows.length),debit:sum('debit'),credit:sum('credit'),amount:sum('amount')};if(owner==='GeneralLedger'){const journals=rows.filter(x=>x.collection==='journals');const lines=journals.flatMap(x=>Array.isArray(x.payload.lines)?x.payload.lines.filter(objectRecord):[]);values.records=String(rows.length);values.debit=lines.reduce((a,l)=>addDecimal(a,decimalFrom(l.debit)),'0');values.credit=lines.reduce((a,l)=>addDecimal(a,decimalFrom(l.credit)),'0');values.journalCount=String(journals.length);values.foreignCurrencyEvidence=String(lines.filter(l=>typeof l.foreignCurrency==='string'&&l.foreignCurrency).length);values.fxRateEvidence=String(lines.filter(l=>typeof l.fxRate==='string'&&l.fxRate).length);values.reversalLineage=String(journals.filter(j=>j.payload.kind==='REVERSAL'&&typeof j.payload.reversalSourceId==='string').length);}result.set(owner,values);}return result;}
 private requiredRunId(config:MigrationConfig){if(!config.runId)throw new Error('runId is required');return config.runId}
 private resolveBranch(value:unknown,config:MigrationConfig):{target?:string;error?:MigrationIssueCode}{if(value===undefined||value===null||value==='')return config.allowUnscopedSourceRecords?{}:{error:'MISSING_BRANCH_MAPPING'};if(typeof value!=='string'||!config.branchMap[value])return{error:'MISSING_BRANCH_MAPPING'};return{target:config.branchMap[value]}}
 private async issue(runId:string,code:MigrationIssueCode,stage:string,collection:string,id:string|null,detail:string){await this.control.recordIssue({runId,code,stage,sourceCollection:collection,sourceId:id,detail})}
}
const decimalFrom=(value:unknown)=>typeof value==='string'&&/^-?\d+(?:\.\d+)?$/.test(value)?value:'0';
const addDecimal=(a:string,b:string)=>{const scale=Math.max((a.split('.')[1]??'').length,(b.split('.')[1]??'').length),unit=10n**BigInt(scale);const parse=(v:string)=>{const negative=v.startsWith('-'),[whole='0',fraction='']=(negative?v.slice(1):v).split('.'),n=BigInt(whole)*unit+BigInt(fraction.padEnd(scale,'0'));return negative?-n:n};const n=parse(a)+parse(b),negative=n<0n,absolute=negative?-n:n,text=absolute.toString().padStart(scale+1,'0');return `${negative?'-':''}${scale?`${text.slice(0,-scale)}.${text.slice(-scale).replace(/0+$/,'')}`:text}`.replace(/\.$/,'')};
