import type {ExecutionContext} from '@elhafez/contracts';
import type {CustomerManagementApplicationService} from '@elhafez/customer-management';
import type {SupplierManagementApplicationService} from '@elhafez/supplier-management';
import type {PartyDraft} from '@elhafez/party-registry';
import type {PlatformCoreApplicationService} from '@elhafez/platform-core';
import {TabularExporter,type ExchangeJob,type ExportSource,type ExportStorage,type ImportTarget} from '@elhafez/data-exchange';
import { createHash } from 'node:crypto';
import { ContractValidationError, decimalAmount } from '@elhafez/contracts';
import type { StandaloneServicesApplicationService } from '@elhafez/standalone-services';

export type SystemAdministrationDataset='CUSTOMERS'|'SUPPLIERS'|'SERVICES';
export interface SystemAdministrationDatasetSpec{
 readonly id:SystemAdministrationDataset;
 readonly label:string;
 readonly requiredFields:readonly string[];
 readonly targetFields:readonly string[];
}

const DATASETS:Readonly<Record<SystemAdministrationDataset,SystemAdministrationDatasetSpec>>=Object.freeze({
 CUSTOMERS:Object.freeze({
  id:'CUSTOMERS',label:'العملاء',
  requiredFields:Object.freeze(['kind','displayName']),
  targetFields:Object.freeze(['kind','displayName','legalName','phone','whatsappNumber','email','address','nationalIdentity','taxIdentity','assignedAgentId','commercialNotes'])
 }),
 SUPPLIERS:Object.freeze({
  id:'SUPPLIERS',label:'الموردون',
  requiredFields:Object.freeze(['supplierCode','kind','displayName','defaultCurrency']),
  targetFields:Object.freeze(['supplierCode','kind','displayName','legalName','phone','whatsappNumber','email','address','nationalIdentity','taxIdentity','defaultCurrency','creditDays','contactPerson','notes','categories'])
 }),
 SERVICES:Object.freeze({
  id:'SERVICES',label:'مسودات الخدمات السياحية',
  requiredFields:Object.freeze(['number','serviceTypeId','serviceDate','quantity','customerPartyId','currency','grossAmount']),
  targetFields:Object.freeze(['sourceId','status','number','serviceTypeId','serviceDate','periodEnd','quantity','customerPartyId','debtorKind','debtorPartyId','beneficiaryPartyIds','description','currency','grossAmount','discountAmount','invoiceNumber','postingDate','dueDate'])
 })
});

type CustomerPort=Pick<CustomerManagementApplicationService,'create'|'list'>;
type SupplierPort=Pick<SupplierManagementApplicationService,'create'|'list'>;
type PlatformFilePort=Pick<PlatformCoreApplicationService,'uploadFile'|'getFile'|'authorize'>;
type ServicesPort=Pick<StandaloneServicesApplicationService,'createDraft'|'getService'|'listServices'>;

export class SystemAdministrationExchangeError extends Error{}

export class SystemAdministrationDataExchangeBoundary{
 private readonly exporter=new TabularExporter();
 constructor(private readonly customers:CustomerPort,private readonly suppliers:SupplierPort,private readonly files:PlatformFilePort,private readonly services?:ServicesPort){}

 datasets():readonly SystemAdministrationDatasetSpec[]{return Object.values(DATASETS);}
 requireDataset(value:string):SystemAdministrationDataset{
  const normalized=value.trim().toUpperCase();
  if(normalized==='CUSTOMERS'||normalized==='SUPPLIERS'||normalized==='SERVICES')return normalized;
  throw new SystemAdministrationExchangeError('unsupported data-exchange dataset');
 }
 requiredFields(dataset:SystemAdministrationDataset){return DATASETS[dataset].requiredFields;}

 importTarget(dataset:SystemAdministrationDataset,context:ExecutionContext):ImportTarget{
  return {importRow:async input=>{
   this.assertScope(context,input.companyId,input.branchId);
   if(dataset==='SERVICES'){
    await this.files.authorize(context.actorId,context.companyId,'tourism.services.manage');
    if(!this.services)throw new SystemAdministrationExchangeError('service import owner is unavailable');
    const values=input.values;
    const status=(optional(values,'status')??'DRAFT').toUpperCase();
    if(status!=='DRAFT')throw new SystemAdministrationExchangeError(`legacy ${status} requires financial and supply reconciliation; no automatic reposting`);
    const sourceId=optional(values,'sourceId')??input.idempotencyKey;
    const id=createHash('sha256').update(JSON.stringify([context.companyId,context.branchId,input.idempotencyKey])).digest('hex').slice(0,32);
    const existing=await this.services.getService(context.companyId,id).catch(error=>{if(error instanceof ContractValidationError&&error.field==='serviceId')return null;throw error});
    if(existing){if(existing.service.branchId!==context.branchId||existing.service.number!==required(values,'number'))throw new SystemAdministrationExchangeError('import identity conflict');return 'DUPLICATE';}
    const debtorKind=(optional(values,'debtorKind')??'CUSTOMER').toUpperCase();
    if(debtorKind!=='CUSTOMER'&&debtorKind!=='AGENT')throw new SystemAdministrationExchangeError('debtorKind must be CUSTOMER or AGENT');
    const customerPartyId=required(values,'customerPartyId');
    const serviceDate=required(values,'serviceDate');
    await this.services.createDraft({companyId:context.companyId,branchId:context.branchId,actorId:context.actorId,id,commandKey:`dex-service:${input.idempotencyKey}`,number:required(values,'number'),serviceTypeId:required(values,'serviceTypeId'),serviceDate,
     ...(optional(values,'periodEnd')?{periodEnd:optional(values,'periodEnd')}:{}),quantity:decimalAmount(required(values,'quantity')),
     debtorKind,debtorPartyId:debtorKind==='CUSTOMER'?customerPartyId:required(values,'debtorPartyId'),customerPartyId,
     beneficiaryPartyIds:(optional(values,'beneficiaryPartyIds')??'').split(/[|,]/).map(value=>value.trim()).filter(Boolean),
     details:{description:optional(values,'description')??'',legacySourceId:sourceId,importCommandKey:input.idempotencyKey},
     currency:required(values,'currency'),grossAmount:decimalAmount(required(values,'grossAmount')),discountAmount:decimalAmount(optional(values,'discountAmount')??'0'),
     invoiceNumber:optional(values,'invoiceNumber')??required(values,'number'),postingDate:optional(values,'postingDate')??serviceDate,dueDate:optional(values,'dueDate')??serviceDate});
    return 'IMPORTED';
   }
   if(dataset==='CUSTOMERS'){
    const result=await this.customers.create(context,{
     party:partyDraft(input.values),
     assignedAgentId:optional(input.values,'assignedAgentId')??null,
     commercialNotes:optional(input.values,'commercialNotes')
    });
    if(result.status==='REVIEW_REQUIRED')throw new SystemAdministrationExchangeError('customer duplicate requires manual review');
    return result.status==='CREATED'?'IMPORTED':'DUPLICATE';
   }
   const credit=optional(input.values,'creditDays');
   const creditDays=credit===undefined?0:Number(credit);
   if(!Number.isInteger(creditDays)||creditDays<0)throw new SystemAdministrationExchangeError('creditDays must be a non-negative integer');
   const result=await this.suppliers.create(context,{
    supplierCode:required(input.values,'supplierCode'),
    defaultCurrency:required(input.values,'defaultCurrency'),
    creditDays,
    contactPerson:optional(input.values,'contactPerson'),
    notes:optional(input.values,'notes'),
    categories:optional(input.values,'categories')?.split(/[|,]/).map(value=>value.trim()).filter(Boolean),
    party:partyDraft(input.values)
   });
   if(result.status==='REVIEW_REQUIRED')throw new SystemAdministrationExchangeError('supplier duplicate requires manual review');
   return result.status==='CREATED'?'IMPORTED':'DUPLICATE';
  }};
 }

 exportSource(dataset:SystemAdministrationDataset,context:ExecutionContext):ExportSource{
  return {read:async input=>{
   this.assertScope(context,input.companyId,input.branchId);
   if(dataset==='SERVICES'){
    await this.files.authorize(context.actorId,context.companyId,'tourism.services.view');
    if(!this.services)throw new SystemAdministrationExchangeError('service export owner is unavailable');
    const rows=await this.services.listServices(context.companyId,context.branchId);
    return Promise.all(rows.map(async row=>{const record=await this.services!.getService(context.companyId,row.id);return {number:row.number,status:row.status,serviceTypeId:record.revision.serviceTypeId,serviceDate:record.revision.serviceDate,quantity:record.revision.quantity,customerPartyId:record.revision.customerPartyId,description:typeof record.revision.details.description==='string'?record.revision.details.description:''}}));
   }
   if(dataset==='CUSTOMERS'){
    const rows=await this.customers.list(context);
    return rows.map(view=>({
     customerNumber:view.customer.number,status:view.customer.status,kind:view.party.kind,displayName:view.party.displayName,
     legalName:view.party.legalName??'',phone:view.party.phone??'',whatsappNumber:view.party.whatsappNumber??'',email:view.party.email??'',
     address:view.party.address??'',nationalIdentity:view.party.nationalIdentity??'',taxIdentity:view.party.taxIdentity??'',
     assignedAgentId:view.customer.assignedAgentId??'',commercialNotes:view.customer.commercialNotes??''
    }));
   }
   const rows=await this.suppliers.list(context);
   return rows.map(view=>({
    supplierCode:view.supplier.supplierCode,status:view.supplier.status,approvalStatus:view.supplier.approvalStatus,
    defaultCurrency:view.supplier.defaultCurrency,creditDays:String(view.supplier.creditDays),kind:view.party.kind,displayName:view.party.displayName,
    legalName:view.party.legalName??'',phone:view.party.phone??'',whatsappNumber:view.party.whatsappNumber??'',email:view.party.email??'',
    address:view.party.address??'',nationalIdentity:view.party.nationalIdentity??'',taxIdentity:view.party.taxIdentity??'',
    contactPerson:view.supplier.contactPerson??'',notes:view.supplier.notes??'',categories:view.categories.join('|')
   }));
  }};
 }

 exportStorage(context:ExecutionContext):ExportStorage{
  return {write:async input=>{
   const content=await this.exporter.encode(input.format,input.rows);
   const stored=await this.files.uploadFile({
    companyId:context.companyId,createdBy:context.actorId,
    contentType:input.format==='CSV'?'text/csv; charset=utf-8':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    content
   });
   return stored.id;
  }};
 }

 async downloadExport(job:ExchangeJob,context:ExecutionContext){
  if(job.companyId!==context.companyId||job.direction!=='EXPORT'||job.status!=='COMPLETED'||!job.resultKey)throw new SystemAdministrationExchangeError('completed export is required');
  const stored=await this.files.getFile(context.companyId,job.resultKey,true);
  if(!('metadata'in stored))throw new SystemAdministrationExchangeError('export binary is unavailable');
  return{fileId:stored.metadata.id,fileName:job.fileName,contentType:stored.metadata.contentType,contentBase64:Buffer.from(stored.content).toString('base64')};
 }

 private assertScope(context:ExecutionContext,companyId:string,branchId:string|null){
  if(companyId!==context.companyId||branchId!==(context.branchId??null))throw new SystemAdministrationExchangeError('data-exchange scope mismatch');
 }
}

function partyDraft(values:Readonly<Record<string,string>>):PartyDraft{
 const kind=required(values,'kind').toUpperCase();
 if(kind!=='PERSON'&&kind!=='ORGANIZATION')throw new SystemAdministrationExchangeError('kind must be PERSON or ORGANIZATION');
 return{
  kind,
  displayName:required(values,'displayName'),
  legalName:optional(values,'legalName'),
  phone:optional(values,'phone'),
  whatsappNumber:optional(values,'whatsappNumber'),
  email:optional(values,'email'),
  address:optional(values,'address'),
  nationalIdentity:optional(values,'nationalIdentity'),
  taxIdentity:optional(values,'taxIdentity')
 };
}
function required(values:Readonly<Record<string,string>>,field:string){const value=values[field]?.trim();if(!value)throw new SystemAdministrationExchangeError(`${field} is required`);return value;}
function optional(values:Readonly<Record<string,string>>,field:string){const value=values[field]?.trim();return value||undefined;}
