import type { ExecutionContext } from '@elhafez/contracts';
import { customerId, type CustomerManagementApplicationService } from '@elhafez/customer-management';
import { agentId, type AgentManagementApplicationService } from '@elhafez/agent-management';
import type { CrmLeadsApplicationService } from '@elhafez/crm-leads';
import type { CrmFollowupsApplicationService, Followup } from '@elhafez/crm-followups';
import type { QuotationsApplicationService, Quotation } from '@elhafez/quotations';
import type { TravelerManagementApplicationService } from '@elhafez/traveler-management';
import type { BillingSubledgersApplicationService } from '@elhafez/billing-subledgers';

type CustomersRead = Pick<CustomerManagementApplicationService, 'get' | 'list'>;
type AgentsRead = Pick<AgentManagementApplicationService, 'get' | 'list'>;
type LeadsRead = Pick<CrmLeadsApplicationService, 'list'>;
type FollowupsRead = Pick<CrmFollowupsApplicationService, 'forLead' | 'overdue'>;
type QuotationsRead = Pick<QuotationsApplicationService, 'list'>;
type TravelersRead = Pick<TravelerManagementApplicationService, 'list'>;
type BillingRead = Pick<BillingSubledgersApplicationService, 'getOpenPosition' | 'listInvoices'>;

const SCALE = 10n ** 18n;
function scaled(value: string): bigint {
  const negative=value.startsWith('-');
  const unsigned=negative?value.slice(1):value;
  const [whole,fraction='']=unsigned.split('.');
  const result=BigInt(whole!+fraction.padEnd(18,'0'));
  return negative?-result:result;
}
function decimal(value: bigint): string {
  const negative=value<0n, absolute=negative?-value:value, whole=absolute/SCALE, fraction=absolute%SCALE;
  const text=fraction===0n?whole.toString():`${whole}.${fraction.toString().padStart(18,'0').replace(/0+$/,'')}`;
  return negative&&text!=='0'?`-${text}`:text;
}
function add(left:string,right:string){return decimal(scaled(left)+scaled(right));}
function nonZero(value:string){return scaled(value)!==0n;}

type FinancialPosition={invoiceId:string;number:string;postingDate:string;dueDate:string|null;currency:string;documentTotal:string;outstanding:string;status:string;overdue:boolean;sourceType:string;sourceId:string};

export class CrmSalesReadModelService {
  constructor(
    private readonly customers: CustomersRead,
    private readonly agents: AgentsRead,
    private readonly leads: LeadsRead,
    private readonly followups: FollowupsRead,
    private readonly quotations: QuotationsRead,
    private readonly travelers: TravelersRead,
    private readonly billing: BillingRead,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private async customerFinancialPositions(context:ExecutionContext,partyId:string):Promise<FinancialPosition[]> {
    const today=this.now().toISOString().slice(0,10);
    const invoices=(await this.billing.listInvoices(context.companyId)).filter((invoice)=>
      invoice.partyId===partyId &&
      (invoice.type==='CUSTOMER'||invoice.type==='OPENING_CUSTOMER_BALANCE') &&
      (invoice.branchId===undefined||invoice.branchId===context.branchId) &&
      (invoice.status==='POSTED'||invoice.status==='CANCELLED'),
    );
    return invoices.map((invoice)=>{
      const documentTotal=invoice.lines.reduce((total,line)=>add(total,add(String(line.amount),String(line.taxAmount??'0'))),'0');
      return {invoiceId:invoice.id,number:invoice.number,postingDate:invoice.postingDate,dueDate:invoice.dueDate??null,currency:invoice.currency,documentTotal,outstanding:String(invoice.outstanding),status:invoice.status,overdue:invoice.status==='POSTED'&&Boolean(invoice.dueDate&&invoice.dueDate<today)&&nonZero(String(invoice.outstanding)),sourceType:invoice.sourceType,sourceId:invoice.sourceId};
    }).sort((a,b)=>b.postingDate.localeCompare(a.postingDate));
  }

  async customersWorkspace(context:ExecutionContext) {
    const customers=await this.customers.list(context);
    return Promise.all(customers.map(async(value)=>{
      const financialPositions=await this.customerFinancialPositions(context,value.party.id);
      const openPositions=financialPositions.filter(position=>position.status==='POSTED'&&nonZero(position.outstanding));
      return {...value,financialSummaryByCurrency:summarizeFinancialPositions(financialPositions),openPositionCount:openPositions.length,overduePositionCount:openPositions.filter(position=>position.overdue).length,hasOutstanding:openPositions.length>0};
    }));
  }

  async customer360(context: ExecutionContext, id: string) {
    const customer = await this.customers.get(context, customerId(id));
    const leads = (await this.leads.list(context)).filter((lead) => lead.convertedCustomerId === id);
    const leadIds = new Set<string>(leads.map((lead) => lead.id));
    const followups = (await Promise.all(leads.map((lead) => this.followups.forLead(context, lead.id)))).flat();
    const quotations = (await this.quotations.list(context)).filter((quote) => quote.customerId === id || (quote.sourceLeadId !== null && leadIds.has(quote.sourceLeadId)));
    const travelers = await this.travelers.list(context, { customerId: id });
    const financialPositions = await this.customerFinancialPositions(context,customer.party.id);
    const quotationLinkedFinancialPositions = await Promise.all(quotations.filter((quote) => quote.billingInvoiceId).map((quote) => this.billing.getOpenPosition(context.companyId, quote.billingInvoiceId!)));
    return {
      customer,
      leads,
      followups,
      quotations,
      travelers,
      financialPositions,
      financialSummaryByCurrency:summarizeFinancialPositions(financialPositions),
      overdueFinancialPositions:financialPositions.filter(position=>position.overdue),
      quotationLinkedFinancialPositions,
      quotationLinkedFinancialSummaryByCurrency: summarizePositions(quotationLinkedFinancialPositions),
    };
  }

  async agent360(context: ExecutionContext, id: string) {
    const agent = await this.agents.get(context, agentId(id));
    const customers = (await this.customers.list(context)).filter((item) => item.customer.assignedAgentId === id);
    const leads = (await this.leads.list(context)).filter((lead) => lead.referralAgentId === id);
    const customerIds = new Set<string>(customers.map((item) => item.customer.id));
    const leadIds = new Set<string>(leads.map((lead) => lead.id));
    const quotations = (await this.quotations.list(context)).filter((quote) =>
      (quote.customerId !== null && customerIds.has(quote.customerId)) ||
      (quote.sourceLeadId !== null && leadIds.has(quote.sourceLeadId)),
    );
    return { agent, customers, leads, quotations };
  }

  async dashboard(context: ExecutionContext) {
    const [customers, agents, leads, overdueFollowups, quotations, travelers] = await Promise.all([
      this.customers.list(context), this.agents.list(context), this.leads.list(context), this.followups.overdue(context), this.quotations.list(context), this.travelers.list(context),
    ]);
    const customerFinancial=await Promise.all(customers.map(async value=>({customerId:value.customer.id,partyId:value.party.id,positions:await this.customerFinancialPositions(context,value.party.id)})));
    const openCustomerPositions=customerFinancial.flatMap(value=>value.positions.filter(position=>position.status==='POSTED'&&nonZero(position.outstanding)).map(position=>({...position,customerId:value.customerId})));
    const leadStages = Object.fromEntries(['NEW','CONTACTED','QUALIFIED','QUOTED','WON','LOST'].map((status)=>[status,leads.filter((lead)=>lead.status===status).length]));
    const quotationStatuses = Object.fromEntries(['DRAFT','SENT','REJECTED','ACCEPTED','CONVERTED','EXPIRED'].map((status)=>[status,quotations.filter((quote)=>quote.status===status).length]));
    const quotationValueByCurrency = summarizeQuotationValues(quotations);
    const today=this.now().toISOString().slice(0,10);
    const soon=new Date(this.now().getTime()+7*24*60*60*1000).toISOString().slice(0,10);
    const awaitingApproval=quotations.filter((quote)=>quote.status==='DRAFT'&&quote.approvalStatus==='PENDING');
    const awaitingConversion=quotations.filter((quote)=>quote.status==='ACCEPTED'&&!quote.billingInvoiceId);
    const unresolvedCustomer=quotations.filter((quote)=>Boolean(quote.sourceLeadId)&&!quote.customerId);
    const expiringSoon=quotations.filter((quote)=>['DRAFT','SENT'].includes(quote.status)).filter((quote)=>{const revision=quote.revisions.find((item)=>item.id===quote.currentRevisionId);return Boolean(revision&&revision.validityDate>=today&&revision.validityDate<=soon);});
    const customersWithOutstanding=new Set(openCustomerPositions.map(position=>position.customerId)).size;
    const overdueReceivables=openCustomerPositions.filter(position=>position.overdue);
    return {
      counts:{customers:customers.length,agents:agents.length,travelers:travelers.length,overdueFollowups:overdueFollowups.length,customersWithOutstanding,overdueReceivables:overdueReceivables.length},
      leadStages,
      quotationStatuses,
      quotationValueByCurrency,
      receivablesByCurrency:summarizeFinancialPositions(openCustomerPositions),
      attention:{overdueFollowups,overdueReceivables,awaitingApproval,awaitingConversion,unresolvedCustomer,expiringSoon},
    };
  }
}

function summarizePositions(positions: Array<Awaited<ReturnType<BillingRead['getOpenPosition']>>>) {
  const grouped=new Map<string,{currency:string;documentTotal:string;outstanding:string}>();
  for(const position of positions){const current=grouped.get(position.currency)??{currency:position.currency,documentTotal:'0',outstanding:'0'};current.documentTotal=add(current.documentTotal,String(position.documentTotal));current.outstanding=add(current.outstanding,String(position.outstanding));grouped.set(position.currency,current);}
  return [...grouped.values()].sort((a,b)=>a.currency.localeCompare(b.currency));
}
function summarizeFinancialPositions(positions:readonly Pick<FinancialPosition,'currency'|'documentTotal'|'outstanding'>[]) {
  const grouped=new Map<string,{currency:string;documentTotal:string;outstanding:string}>();
  for(const position of positions){const current=grouped.get(position.currency)??{currency:position.currency,documentTotal:'0',outstanding:'0'};current.documentTotal=add(current.documentTotal,position.documentTotal);current.outstanding=add(current.outstanding,position.outstanding);grouped.set(position.currency,current);}
  return [...grouped.values()].sort((a,b)=>a.currency.localeCompare(b.currency));
}
function summarizeQuotationValues(quotations: readonly Quotation[]) {
  const grouped=new Map<string,{currency:string;total:string}>();
  for(const quote of quotations){const revision=quote.revisions.find((item)=>item.id===(quote.acceptedRevisionId??quote.currentRevisionId));if(!revision)continue;const current=grouped.get(quote.currency)??{currency:quote.currency,total:'0'};current.total=add(current.total,revision.total);grouped.set(quote.currency,current);}
  return [...grouped.values()].sort((a,b)=>a.currency.localeCompare(b.currency));
}

export type CustomerWorkspaceView = Awaited<ReturnType<CrmSalesReadModelService['customersWorkspace']>>;
export type Customer360View = Awaited<ReturnType<CrmSalesReadModelService['customer360']>>;
export type Agent360View = Awaited<ReturnType<CrmSalesReadModelService['agent360']>>;
export type CrmSalesDashboardView = Awaited<ReturnType<CrmSalesReadModelService['dashboard']>>;
export type CrmFollowupAttention = Followup;
