import type { PrismaClient, Prisma } from '@prisma/client';
import type { BranchId, CompanyId, DecimalAmount } from '@elhafez/contracts';
import type { QuotationsRepository } from '../application/quotations.repository.js';
import { quotationId, type Quotation, type QuotationCommunication, type QuotationHistory, type QuotationRevision, type QuotationTemplate, type LineInput } from '../domain/quotation.js';

type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];
type QuotationRow = {
  id:string; companyId:string; branchId:string; number:string; sourceLeadId:string|null; customerId:string|null;
  customerDisplayName:string; customerContactName:string|null; customerPhone:string|null; customerEmail:string|null; currency:string;
  status:string; approvalStatus:string; approvalActorId:string|null; approvalAt:Date|null; approvalReason:string|null;
  currentRevisionId:string; acceptedRevisionId:string|null; rejectedRevisionId:string|null; rejectionReason:string|null; billingInvoiceId:string|null;
  createdAt:Date; updatedAt:Date;
  revisions:Array<{ id:string; quotationId:string; number:number; validityDate:Date; notes:string|null; terms:string|null; subtotal:unknown; discountTotal:unknown; total:unknown; createdAt:Date; sentAt:Date|null; lines:Array<{id:string;description:string;quantity:unknown;unitPrice:unknown;discount:unknown;taxCode:string|null;total:unknown;manualPriceOverride:boolean;discountRequiresApproval:boolean}> }>;
};
type CommunicationRow = { id:string; companyId:string; branchId:string; quotationId:string; revisionId:string; channel:string; outcome:string; recipientSnapshot:string|null; actorId:string; externalReference:string|null; occurredAt:Date };

export class PrismaQuotationsRepository implements QuotationsRepository {
  constructor(private readonly db: PrismaClient) {}

  async nextNumber(companyId: CompanyId, branchId: BranchId) {
    const row = await this.db.qtNumberCounter.upsert({ where:{companyId_branchId:{companyId,branchId}}, create:{companyId,branchId,nextValue:1}, update:{nextValue:{increment:1}} });
    return row.nextValue;
  }

  async create(value: Quotation, history: QuotationHistory) {
    await this.db.$transaction(async (tx) => {
      await tx.qtQuotation.create({ data: header(value) });
      for (const revision of value.revisions) await createRevision(tx, revision);
      await tx.qtHistory.create({ data: event(history) });
    });
  }

  async save(value: Quotation, history: QuotationHistory) {
    await this.db.$transaction(async (tx) => {
      await tx.qtQuotation.update({ where:{companyId_branchId_id:{companyId:value.companyId,branchId:value.branchId,id:value.id}}, data:header(value) });
      for (const revision of value.revisions) {
        await tx.qtRevision.upsert({ where:{quotationId_number:{quotationId:value.id,number:revision.number}}, create:revisionData(revision), update:revisionData(revision) });
        await tx.qtRevisionLine.deleteMany({ where:{revisionId:revision.id} });
        await tx.qtRevisionLine.createMany({ data: revision.lines.map((line)=>({id:line.id,revisionId:revision.id,description:line.description,quantity:line.quantity,unitPrice:line.unitPrice,discount:line.discount,taxCode:line.taxCode,total:line.total,manualPriceOverride:line.manualPriceOverride,discountRequiresApproval:line.discountRequiresApproval})) });
      }
      await tx.qtHistory.create({ data:event(history) });
    });
  }

  async find(companyId: CompanyId, branchId: BranchId, id: ReturnType<typeof quotationId>) {
    const row = await this.db.qtQuotation.findUnique({ where:{companyId_branchId_id:{companyId,branchId,id}}, include:{revisions:{include:{lines:true},orderBy:{number:'asc'}}} });
    return row ? map(row) : undefined;
  }

  async findBySourceLead(companyId: CompanyId, branchId: BranchId, leadId: string) {
    const row = await this.db.qtQuotation.findFirst({ where:{companyId,branchId,sourceLeadId:leadId}, include:{revisions:{include:{lines:true},orderBy:{number:'asc'}}} });
    return row ? map(row) : undefined;
  }

  async list(companyId: CompanyId, branchId: BranchId, query?: string) {
    const rows = await this.db.qtQuotation.findMany({ where:{companyId,branchId,...query?{OR:[{number:{contains:query,mode:'insensitive'}},{customerDisplayName:{contains:query,mode:'insensitive'}}]}:{}}, include:{revisions:{include:{lines:true},orderBy:{number:'asc'}}}, orderBy:{createdAt:'desc'} });
    return rows.map(map);
  }

  async addCommunication(value: QuotationCommunication) {
    await this.db.qtCommunication.create({ data:{ id:value.id, companyId:value.companyId, branchId:value.branchId, quotationId:value.quotationId, revisionId:value.revisionId, channel:value.channel, outcome:value.outcome, recipientSnapshot:value.recipientSnapshot, actorId:value.actorId, externalReference:value.externalReference, occurredAt:new Date(value.occurredAt) } });
  }

  async communications(companyId: CompanyId, branchId: BranchId, quotationId_: ReturnType<typeof quotationId>) {
    const rows = await this.db.qtCommunication.findMany({ where:{companyId,branchId,quotationId:quotationId_}, orderBy:{occurredAt:'asc'} });
    return rows.map(mapCommunication);
  }
  async saveTemplate(v:QuotationTemplate){
    const row=await this.db.qtTemplate.upsert({where:{companyId_branchId_id:{companyId:v.companyId,branchId:v.branchId,id:v.id}},create:{id:v.id,companyId:v.companyId,branchId:v.branchId,code:v.code,name:v.name,currency:v.currency,defaultValidityDays:v.defaultValidityDays,terms:v.terms,notes:v.notes,lines:v.lines as unknown as Prisma.InputJsonValue,active:v.active,createdAt:new Date(v.createdAt),updatedAt:new Date(v.updatedAt)},update:{code:v.code,name:v.name,currency:v.currency,defaultValidityDays:v.defaultValidityDays,terms:v.terms,notes:v.notes,lines:v.lines as unknown as Prisma.InputJsonValue,active:v.active,updatedAt:new Date(v.updatedAt)}});
    return mapTemplate(row);
  }
  async template(companyId:CompanyId,branchId:BranchId,id:string){const row=await this.db.qtTemplate.findUnique({where:{companyId_branchId_id:{companyId,branchId,id}}});return row?mapTemplate(row):undefined;}
  async listTemplates(companyId:CompanyId,branchId:BranchId){return(await this.db.qtTemplate.findMany({where:{companyId,branchId},orderBy:[{active:'desc'},{name:'asc'}]})).map(mapTemplate);}
}

function header(value: Quotation) {
  return { id:value.id,companyId:value.companyId,branchId:value.branchId,number:value.number,sourceLeadId:value.sourceLeadId,customerId:value.customerId,customerDisplayName:value.customerSnapshot.displayName,customerContactName:value.customerSnapshot.contactName,customerPhone:value.customerSnapshot.phone,customerEmail:value.customerSnapshot.email,currency:value.currency,status:value.status,approvalStatus:value.approvalStatus,approvalActorId:value.approvalActorId,approvalAt:value.approvalAt?new Date(value.approvalAt):null,approvalReason:value.approvalReason,currentRevisionId:value.currentRevisionId,acceptedRevisionId:value.acceptedRevisionId,rejectedRevisionId:value.rejectedRevisionId,rejectionReason:value.rejectionReason,billingInvoiceId:value.billingInvoiceId,createdAt:new Date(value.createdAt),updatedAt:new Date(value.updatedAt) };
}
function revisionData(value: QuotationRevision) { return { id:value.id,quotationId:value.quotationId,number:value.number,validityDate:new Date(value.validityDate+'T00:00:00Z'),notes:value.notes,terms:value.terms,subtotal:value.subtotal,discountTotal:value.discountTotal,total:value.total,createdAt:new Date(value.createdAt),sentAt:value.sentAt?new Date(value.sentAt):null }; }
async function createRevision(tx: Tx, value: QuotationRevision) { await tx.qtRevision.create({ data:{...revisionData(value),lines:{create:value.lines.map((line)=>({id:line.id,description:line.description,quantity:line.quantity,unitPrice:line.unitPrice,discount:line.discount,taxCode:line.taxCode,total:line.total,manualPriceOverride:line.manualPriceOverride,discountRequiresApproval:line.discountRequiresApproval}))}} }); }
function event(value: QuotationHistory) { return { id:value.id,companyId:value.companyId,branchId:value.branchId,quotationId:value.quotationId,kind:value.kind,revisionId:value.revisionId,actorId:value.actorId,detail:value.detail,occurredAt:new Date(value.occurredAt) }; }
function map(row: QuotationRow): Quotation { return { id:quotationId(row.id),companyId:row.companyId as CompanyId,branchId:row.branchId as BranchId,number:row.number,sourceLeadId:row.sourceLeadId,customerId:row.customerId,customerSnapshot:{displayName:row.customerDisplayName,contactName:row.customerContactName,phone:row.customerPhone,email:row.customerEmail},currency:row.currency,status:row.status as Quotation['status'],approvalStatus:row.approvalStatus as Quotation['approvalStatus'],approvalActorId:row.approvalActorId,approvalAt:row.approvalAt?.toISOString()??null,approvalReason:row.approvalReason,currentRevisionId:row.currentRevisionId,acceptedRevisionId:row.acceptedRevisionId,rejectedRevisionId:row.rejectedRevisionId,rejectionReason:row.rejectionReason,billingInvoiceId:row.billingInvoiceId,createdAt:row.createdAt.toISOString(),updatedAt:row.updatedAt.toISOString(),revisions:row.revisions.map((revision)=>({id:revision.id,quotationId:quotationId(revision.quotationId),number:revision.number,validityDate:revision.validityDate.toISOString().slice(0,10),notes:revision.notes,terms:revision.terms,subtotal:String(revision.subtotal) as DecimalAmount,discountTotal:String(revision.discountTotal) as DecimalAmount,total:String(revision.total) as DecimalAmount,createdAt:revision.createdAt.toISOString(),sentAt:revision.sentAt?.toISOString()??null,lines:revision.lines.map((line)=>({id:line.id,description:line.description,quantity:String(line.quantity) as DecimalAmount,unitPrice:String(line.unitPrice) as DecimalAmount,discount:String(line.discount) as DecimalAmount,taxCode:line.taxCode,total:String(line.total) as DecimalAmount,manualPriceOverride:line.manualPriceOverride,discountRequiresApproval:line.discountRequiresApproval}))})) }; }
function mapCommunication(row: CommunicationRow): QuotationCommunication { return { id:row.id,companyId:row.companyId as CompanyId,branchId:row.branchId as BranchId,quotationId:quotationId(row.quotationId),revisionId:row.revisionId,channel:row.channel as QuotationCommunication['channel'],outcome:row.outcome as QuotationCommunication['outcome'],recipientSnapshot:row.recipientSnapshot,actorId:row.actorId,externalReference:row.externalReference,occurredAt:row.occurredAt.toISOString() }; }

function mapTemplate(row:{id:string;companyId:string;branchId:string;code:string;name:string;currency:string;defaultValidityDays:number;terms:string|null;notes:string|null;lines:unknown;active:boolean;createdAt:Date;updatedAt:Date}):QuotationTemplate{return{id:row.id,companyId:row.companyId as CompanyId,branchId:row.branchId as BranchId,code:row.code,name:row.name,currency:row.currency,defaultValidityDays:row.defaultValidityDays,terms:row.terms,notes:row.notes,lines:Array.isArray(row.lines)?row.lines as unknown as LineInput[]:[],active:row.active,createdAt:row.createdAt.toISOString(),updatedAt:row.updatedAt.toISOString()};}
