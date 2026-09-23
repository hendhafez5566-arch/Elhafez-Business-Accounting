import { randomUUID } from 'node:crypto';
import ExcelJS from 'exceljs';

export type ExchangeStatus='UPLOADED'|'VALIDATED'|'READY'|'PROCESSING'|'COMPLETED'|'COMPLETED_WITH_ERRORS'|'FAILED';
export interface ExchangeRow { readonly rowNumber:number; readonly source:Readonly<Record<string,string>>; outcome:'PENDING'|'IMPORTED'|'DUPLICATE'|'FAILED'; error?:string }
export interface ExchangeJob { readonly id:string;readonly companyId:string;readonly branchId:string|null;readonly dataset:string|null;readonly direction:'IMPORT'|'EXPORT';status:ExchangeStatus;readonly fileName:string;readonly format:'CSV'|'XLSX'|'GENERATED';readonly mapping:Readonly<Record<string,string>>;readonly idempotencyKey:string;readonly rows:ExchangeRow[];resultKey?:string;readonly createdAt:Date;updatedAt:Date }
export interface ImportTarget { importRow(input:{companyId:string;branchId:string|null;values:Readonly<Record<string,string>>;idempotencyKey:string}):Promise<'IMPORTED'|'DUPLICATE'> }
export interface ExportSource { read(input:{companyId:string;branchId:string|null}):Promise<ReadonlyArray<Readonly<Record<string,string>>>> }
export interface ExportStorage { write(input:{jobId:string;format:'CSV'|'XLSX';rows:ReadonlyArray<Readonly<Record<string,string>>>}):Promise<string> }
export interface TabularParser { readonly format:'CSV'|'XLSX'; parse(content:Uint8Array):Promise<ReadonlyArray<Readonly<Record<string,string>>>> }

export class CsvParser implements TabularParser {
 readonly format='CSV' as const;
 async parse(content:Uint8Array){
  const text=new TextDecoder().decode(content).replace(/^\uFEFF/,'');
  const records=parseCsv(text);
  if(!records.length)return[];
  const headers=records[0];
  if(!headers)return[];
  if(headers.some(value=>!value.trim()))throw new DataExchangeError('CSV headers are required');
  return records.slice(1).filter(row=>row.some(Boolean)).map(row=>Object.fromEntries(headers.map((header,index)=>[header.trim(),row[index]??''])));
 }
}

/** Production XLSX parser backed by ExcelJS; formulas are imported using their cached result. */
export class XlsxParser implements TabularParser {
 readonly format='XLSX' as const;
 async parse(content:Uint8Array){
  const workbook=new ExcelJS.Workbook();
  // ExcelJS 4.4 declares load() against ArrayBuffer while modern Node Buffers
  // are typed over ArrayBufferLike. Copy into an owned ArrayBuffer at this
  // vendor boundary so runtime bytes and static types agree without casts.
  const workbookBuffer=new ArrayBuffer(content.byteLength);
  new Uint8Array(workbookBuffer).set(content);
  await workbook.xlsx.load(workbookBuffer);
  const worksheet=workbook.worksheets[0];
  if(!worksheet)throw new DataExchangeError('XLSX workbook has no worksheet');
  const values:string[][]=[];
  worksheet.eachRow({includeEmpty:false},row=>{
   const cells:string[]=[];
   for(let column=1;column<=row.cellCount;column++)cells.push(xlsxCell(row.getCell(column).value));
   values.push(cells);
  });
  const [headers,...rows]=values;
  if(!headers?.length||headers.some(header=>!header.trim()))throw new DataExchangeError('XLSX headers are required');
  return rows.filter(row=>row.some(Boolean)).map(row=>Object.fromEntries(headers.map((header,index)=>[header.trim(),row[index]??''])));
 }
}

/** Owns tabular serialization while storage remains an injected infrastructure boundary. */
export class TabularExporter {
 async encode(format:'CSV'|'XLSX',rows:ReadonlyArray<Readonly<Record<string,string>>>):Promise<Uint8Array>{
  const headers=tabularHeaders(rows);
  if(format==='CSV'){
   if(!headers.length)return new Uint8Array();
   const lines=[headers.map(csvEscape).join(','),...rows.map(row=>headers.map(header=>csvEscape(row[header]??'')).join(','))];
   return new TextEncoder().encode('\uFEFF'+lines.join('\r\n'));
  }
  const workbook=new ExcelJS.Workbook();
  const sheet=workbook.addWorksheet('Export');
  if(headers.length){
   sheet.addRow(headers);
   for(const row of rows)sheet.addRow(headers.map(header=>row[header]??''));
  }
  const buffer=await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
 }
}

function xlsxCell(value:ExcelJS.CellValue):string {
 if(value===null||value===undefined)return'';
 if(value instanceof Date)return value.toISOString();
 if(typeof value==='object'){
  if('result'in value)return xlsxCell(value.result??'');
  if('text'in value)return value.text;
  if('richText'in value)return value.richText.map(part=>part.text).join('');
  if('error'in value)return value.error;
 }
 return String(value);
}

function tabularHeaders(rows:ReadonlyArray<Readonly<Record<string,string>>>):string[]{
 const seen=new Set<string>();
 for(const row of rows)for(const key of Object.keys(row))if(!seen.has(key)){seen.add(key);}
 return [...seen];
}

function csvEscape(value:string):string{
 return /[",\r\n]/.test(value)?`"${value.replace(/"/g,'""')}"`:value;
}

function parseCsv(text:string){
 const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){
  const char=text[i];
  if(char==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
  else if(char===','&&!quoted){row.push(cell);cell='';}
  else if((char==='\n'||char==='\r')&&!quoted){if(char==='\r'&&text[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell='';}
  else cell+=char;
 }
 if(quoted)throw new DataExchangeError('CSV contains an unterminated quoted field');
 if(cell||row.length){row.push(cell);rows.push(row);}
 return rows;
}

export class DataExchangeError extends Error{}
export interface DataExchangeRepository { save(job:ExchangeJob):Promise<void>; find(companyId:string,id:string):Promise<ExchangeJob|undefined>; findByKey(companyId:string,key:string):Promise<ExchangeJob|undefined>; list(companyId:string):Promise<readonly ExchangeJob[]> }

export class DataExchangeApplicationService {
 constructor(private readonly repository:DataExchangeRepository,private readonly parsers:readonly TabularParser[]=[new CsvParser()]){}

 async ingest(input:{companyId:string;branchId?:string;dataset?:string;fileName:string;format:'CSV'|'XLSX';content:Uint8Array;mapping:Readonly<Record<string,string>>;idempotencyKey:string}){
  const parser=this.parsers.find(value=>value.format===input.format);
  if(!parser)throw new DataExchangeError(`${input.format} parser is unavailable`);
  return this.upload({...input,rows:await parser.parse(input.content)});
 }

 async upload(input:{companyId:string;branchId?:string;dataset?:string;fileName:string;format:'CSV'|'XLSX';rows:ReadonlyArray<Readonly<Record<string,string>>>;mapping:Readonly<Record<string,string>>;idempotencyKey:string}){
  if(!input.fileName.trim()||!input.idempotencyKey.trim())throw new DataExchangeError('source and idempotency key are required');
  const prior=await this.repository.findByKey(input.companyId,input.idempotencyKey);
  if(prior)return prior;
  const mapping=Object.keys(input.mapping).length?{...input.mapping}:identityMapping(input.rows[0]);
  const now=new Date();
  const job:ExchangeJob={
   id:randomUUID(),companyId:input.companyId,branchId:input.branchId??null,dataset:input.dataset?.trim()||null,direction:'IMPORT',status:'UPLOADED',
   fileName:input.fileName,format:input.format,mapping,idempotencyKey:input.idempotencyKey,
   rows:input.rows.map((source,rowNumber)=>({rowNumber:rowNumber+1,source:{...source},outcome:'PENDING'})),createdAt:now,updatedAt:now
  };
  await this.repository.save(job);
  return job;
 }

 async setMapping(companyId:string,id:string,mapping:Readonly<Record<string,string>>){
  const job=await this.require(companyId,id);
  if(job.direction!=='IMPORT')throw new DataExchangeError('only import jobs can be mapped');
  if(job.status==='PROCESSING'||job.status==='COMPLETED'||job.rows.some(row=>row.outcome==='IMPORTED'||row.outcome==='DUPLICATE'))throw new DataExchangeError('mapping cannot change after import execution has started');
  const normalized=normalizeMapping(mapping,job.rows);
  const updated:ExchangeJob={...job,mapping:normalized,status:'UPLOADED',updatedAt:new Date(),rows:job.rows.map(row=>({...row,outcome:'PENDING',error:undefined}))};
  await this.repository.save(updated);
  return updated;
 }

 async preview(companyId:string,id:string,required:readonly string[]){
  const job=await this.require(companyId,id);
  if(job.direction!=='IMPORT')throw new DataExchangeError('only import jobs can be previewed');
  for(const row of job.rows){
   const mapped=mapRow(job.mapping,row.source);
   const missing=required.find(field=>!(mapped[field]??row.source[field])?.trim());
   if(missing){row.outcome='FAILED';row.error=`Missing ${missing}`;}
   else if(row.outcome==='FAILED'&&row.error?.startsWith('Missing ')){row.outcome='PENDING';delete row.error;}
  }
  job.status=job.rows.some(value=>value.outcome==='FAILED')?'VALIDATED':'READY';
  job.updatedAt=new Date();
  await this.repository.save(job);
  return job;
 }

 async execute(companyId:string,id:string,target:ImportTarget){
  const job=await this.require(companyId,id);
  if(job.direction!=='IMPORT')throw new DataExchangeError('only import jobs can be executed');
  if(!['READY','VALIDATED','COMPLETED_WITH_ERRORS','FAILED'].includes(job.status))throw new DataExchangeError('job is not executable');
  job.status='PROCESSING';
  await this.repository.save(job);
  for(const row of job.rows){
   if(row.outcome==='IMPORTED'||row.outcome==='DUPLICATE'||(row.outcome==='FAILED'&&row.error?.startsWith('Missing ')))continue;
   try{
    row.outcome=await target.importRow({companyId:job.companyId,branchId:job.branchId,values:mapRow(job.mapping,row.source),idempotencyKey:`${job.id}:${row.rowNumber}`});
    delete row.error;
   }catch(error){
    row.outcome='FAILED';
    row.error=error instanceof Error?error.message:'Unknown row failure';
   }
   await this.repository.save(job);
  }
  job.status=job.rows.some(value=>value.outcome==='FAILED')?'COMPLETED_WITH_ERRORS':'COMPLETED';
  job.updatedAt=new Date();
  await this.repository.save(job);
  return job;
 }

 async createExport(input:{companyId:string;branchId?:string;dataset?:string;fileName:string;format:'CSV'|'XLSX';idempotencyKey:string},source:ExportSource,storage:ExportStorage){
  const prior=await this.repository.findByKey(input.companyId,input.idempotencyKey);
  if(prior)return prior;
  const now=new Date();
  const job:ExchangeJob={id:randomUUID(),companyId:input.companyId,branchId:input.branchId??null,dataset:input.dataset?.trim()||null,direction:'EXPORT',status:'PROCESSING',fileName:input.fileName,format:input.format,mapping:{},idempotencyKey:input.idempotencyKey,rows:[],createdAt:now,updatedAt:now};
  await this.repository.save(job);
  try{
   job.resultKey=await storage.write({jobId:job.id,format:input.format,rows:await source.read({companyId:job.companyId,branchId:job.branchId})});
   job.status='COMPLETED';
  }catch(error){
   job.status='FAILED';
   const message=error instanceof Error?error.message:'Unknown export failure';
   job.rows.push({rowNumber:0,source:{},outcome:'FAILED',error:message});
  }
  job.updatedAt=new Date();
  await this.repository.save(job);
  return job;
 }

 async get(companyId:string,id:string){return this.require(companyId,id);}
 async list(companyId:string,direction?:ExchangeJob['direction']){
  const jobs=await this.repository.list(companyId);
  return direction?jobs.filter(job=>job.direction===direction):jobs;
 }
 private async require(companyId:string,id:string){
  const job=await this.repository.find(companyId,id);
  if(!job)throw new DataExchangeError('job not found');
  return job;
 }
}

function identityMapping(row:Readonly<Record<string,string>>|undefined):Record<string,string>{
 return Object.fromEntries(Object.keys(row??{}).map(key=>[key,key]));
}
function normalizeMapping(mapping:Readonly<Record<string,string>>,rows:readonly ExchangeRow[]):Record<string,string>{
 const sourceFields=new Set(rows.flatMap(row=>Object.keys(row.source)));
 const normalized:Record<string,string>={};
 const targets=new Set<string>();
 for(const [sourceValue,targetValue] of Object.entries(mapping)){
  const source=sourceValue.trim(),target=targetValue.trim();
  if(!source||!target)throw new DataExchangeError('mapping source and target are required');
  if(sourceFields.size&& !sourceFields.has(source))throw new DataExchangeError(`mapping source ${source} does not exist in the import`);
  if(targets.has(target))throw new DataExchangeError(`mapping target ${target} is duplicated`);
  normalized[source]=target;targets.add(target);
 }
 if(!Object.keys(normalized).length)throw new DataExchangeError('at least one column mapping is required');
 return normalized;
}
function mapRow(mapping:Readonly<Record<string,string>>,source:Readonly<Record<string,string>>):Record<string,string>{
 return Object.fromEntries(Object.entries(mapping).map(([sourceField,targetField])=>[targetField,source[sourceField]??'']));
}

export class InMemoryDataExchangeRepository implements DataExchangeRepository {
 private readonly jobs=new Map<string,ExchangeJob>();
 async save(job:ExchangeJob){this.jobs.set(job.id,structuredClone(job));}
 async find(companyId:string,id:string){const value=this.jobs.get(id);return value?.companyId===companyId?structuredClone(value):undefined;}
 async findByKey(companyId:string,key:string){const value=[...this.jobs.values()].find(job=>job.companyId===companyId&&job.idempotencyKey===key);return value&&structuredClone(value);}
 async list(companyId:string){return [...this.jobs.values()].filter(job=>job.companyId===companyId).map(job=>structuredClone(job));}
}
