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
type BillingRead = Pick<BillingSubledgersApplicationService, 'getOpenPosition'>;

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

  async customer360(context: ExecutionContext, id: string) {
    const customer = await this.customers.get(context, customerId(id));
    const leads = (await this.leads.list(context)).filter((lead) => lead.convertedCustomerId === id);
    const leadIds = new Set<string>(leads.map((lead) => lead.id));
    const followups = (await Promise.all(leads.map((lead) => this.followups.forLead(context, lead.id)))).flat();
    const quotations = (await this.quotations.list(context)).filter((quote) => quote.customerId === id || (quote.sourceLeadId !== null && leadIds.has(quote.sourceLeadId)));
    const travelers = await this.travelers.list(context, { customerId: id });
    const financialPositions = await Promise.all(quotations.filter((quote) => quote.billingInvoiceId).map((quote) => this.billing.getOpenPosition(context.companyId, quote.billingInvoiceId!)));
    return {
      customer,
      leads,
      followups,
      quotations,
      travelers,
      quotationLinkedFinancialPositions: financialPositions,
      quotationLinkedFinancialSummaryByCurrency: summarizePositions(financialPositions),
    };
  }

  async agent360(context: ExecutionContext, id: string) {
    const agent = await this.agents.get(context, agentId(id));
    const customers = (await this.customers.list(context)).filter((item) => item.customer.assignedAgentId === id);
    const leads = (await this.leads.list(context)).filter((lead) => lead.referralAgentId === id);
    const customerIds = new Set(customers.map((item) => item.customer.id));
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
    const leadStages = Object.fromEntries(['NEW','CONTACTED','QUALIFIED','QUOTED','WON','LOST'].map((status)=>[status,leads.filter((lead)=>lead.status===status).length]));
    const quotationStatuses = Object.fromEntries(['DRAFT','SENT','REJECTED','ACCEPTED','CONVERTED','EXPIRED'].map((status)=>[status,quotations.filter((quote)=>quote.status===status).length]));
    const quotationValueByCurrency = summarizeQuotationValues(quotations);
    const today=this.now().toISOString().slice(0,10);
    const soon=new Date(this.now().getTime()+7*24*60*60*1000).toISOString().slice(0,10);
    const awaitingApproval=quotations.filter((quote)=>quote.status==='DRAFT'&&quote.approvalStatus==='PENDING');
    const awaitingConversion=quotations.filter((quote)=>quote.status==='ACCEPTED'&&!quote.billingInvoiceId);
    const unresolvedCustomer=quotations.filter((quote)=>Boolean(quote.sourceLeadId)&&!quote.customerId);
    const expiringSoon=quotations.filter((quote)=>['DRAFT','SENT'].includes(quote.status)).filter((quote)=>{const revision=quote.revisions.find((item)=>item.id===quote.currentRevisionId);return Boolean(revision&&revision.validityDate>=today&&revision.validityDate<=soon);});
    return {
      counts:{customers:customers.length,agents:agents.length,travelers:travelers.length,overdueFollowups:overdueFollowups.length},
      leadStages,
      quotationStatuses,
      quotationValueByCurrency,
      attention:{overdueFollowups,awaitingApproval,awaitingConversion,unresolvedCustomer,expiringSoon},
    };
  }
}

function summarizePositions(positions: Array<Awaited<ReturnType<BillingRead['getOpenPosition']>>>) {
  const grouped=new Map<string,{currency:string;documentTotal:string;outstanding:string}>();
  for(const position of positions){const current=grouped.get(position.currency)??{currency:position.currency,documentTotal:'0',outstanding:'0'};current.documentTotal=add(current.documentTotal,position.documentTotal);current.outstanding=add(current.outstanding,position.outstanding);grouped.set(position.currency,current);}
  return [...grouped.values()].sort((a,b)=>a.currency.localeCompare(b.currency));
}
function summarizeQuotationValues(quotations: readonly Quotation[]) {
  const grouped=new Map<string,{currency:string;total:string}>();
  for(const quote of quotations){const revision=quote.revisions.find((item)=>item.id===(quote.acceptedRevisionId??quote.currentRevisionId));if(!revision)continue;const current=grouped.get(quote.currency)??{currency:quote.currency,total:'0'};current.total=add(current.total,revision.total);grouped.set(quote.currency,current);}
  return [...grouped.values()].sort((a,b)=>a.currency.localeCompare(b.currency));
}

export type Customer360View = Awaited<ReturnType<CrmSalesReadModelService['customer360']>>;
export type Agent360View = Awaited<ReturnType<CrmSalesReadModelService['agent360']>>;
export type CrmSalesDashboardView = Awaited<ReturnType<CrmSalesReadModelService['dashboard']>>;
export type CrmFollowupAttention = Followup;
