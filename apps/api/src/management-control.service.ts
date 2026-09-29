import type { BranchId, CompanyId, ExecutionContext } from '@elhafez/contracts';

export type ManagementDomain = 'CRM_SALES' | 'SUPPLIERS_PROCUREMENT' | 'HAJJ_UMRAH' | 'FINANCE';
export type AttentionSeverity = 'CRITICAL' | 'HIGH' | 'NORMAL';
export interface ManagementAttentionItem {
  readonly sourceKey: string; readonly sourceDomain: ManagementDomain; readonly sourceType: string; readonly sourceId: string;
  readonly title: string; readonly summary: string; readonly severity: AttentionSeverity; readonly status: string;
  readonly companyId: string; readonly branchId?: string; readonly occurredAt?: string; readonly category: string; readonly drillDownPath: string;
}
export interface WorkCenterFilter { readonly domain?: ManagementDomain; readonly severity?: AttentionSeverity; readonly status?: string; readonly category?: string; readonly from?: string; readonly to?: string; }
export interface ManagementSummary {
  readonly crmSales: {
    readonly customers: number; readonly agents: number; readonly travelers: number; readonly overdueFollowups: number;
    readonly leadStages: Readonly<Record<string, number>>; readonly quotationStatuses: Readonly<Record<string, number>>;
    readonly quotationValueByCurrency: readonly { readonly currency: string; readonly total: string }[];
  };
  readonly suppliers: { readonly total: number; readonly openDisputes: number; readonly activeHolds: number };
  readonly hajjUmrah: { readonly activePrograms: number; readonly readinessItems: number; readonly criticalReadinessItems: number };
  readonly finance: { readonly overduePositions: number; readonly overdueByCurrency: readonly { readonly currency: string; readonly amount: string }[] };
}
export interface ManagementOverview {
  readonly generatedAt: string;
  readonly totals: { readonly attention: number; readonly critical: number; readonly high: number };
  readonly domains: readonly { readonly domain: ManagementDomain; readonly count: number }[];
  readonly summary: ManagementSummary;
  readonly items: readonly ManagementAttentionItem[];
}

const sameCode = (left: string, right: string) => left.trim().toUpperCase() === right.trim().toUpperCase();

export class WorkCenterApplicationService {
  compose(companyId: string, branchId: string, items: readonly ManagementAttentionItem[], summary: ManagementSummary, filter: WorkCenterFilter = {}, generatedAt = new Date().toISOString()): ManagementOverview {
    const scoped = items.filter((item) => item.companyId === companyId && (!item.branchId || item.branchId === branchId));
    const selected = scoped.filter((item) =>
      (!filter.domain || item.sourceDomain === filter.domain) &&
      (!filter.severity || item.severity === filter.severity) &&
      (!filter.status || sameCode(item.status, filter.status)) &&
      (!filter.category || sameCode(item.category, filter.category)) &&
      (!filter.from || Boolean(item.occurredAt && item.occurredAt >= filter.from)) &&
      (!filter.to || Boolean(item.occurredAt && item.occurredAt <= endOfDay(filter.to))),
    );
    const order: Record<AttentionSeverity, number> = { CRITICAL: 0, HIGH: 1, NORMAL: 2 };
    const sorted = [...selected].sort((a, b) => order[a.severity] - order[b.severity] || (b.occurredAt ?? '').localeCompare(a.occurredAt ?? '') || a.sourceKey.localeCompare(b.sourceKey));
    const domains = (['CRM_SALES', 'SUPPLIERS_PROCUREMENT', 'HAJJ_UMRAH', 'FINANCE'] as const).map((domain) => ({ domain, count: scoped.filter((item) => item.sourceDomain === domain).length }));
    return { generatedAt, totals: { attention: scoped.length, critical: scoped.filter((item) => item.severity === 'CRITICAL').length, high: scoped.filter((item) => item.severity === 'HIGH').length }, domains, summary, items: sorted };
  }
}

interface CrmRead { dashboard(context:ExecutionContext):Promise<{ counts:{customers:number;agents:number;travelers:number;overdueFollowups:number}; leadStages:Record<string,number>; quotationStatuses:Record<string,number>; quotationValueByCurrency:readonly {currency:string;total:string}[]; attention:{ overdueFollowups:readonly {id:string;leadId:string;nextAction:string|null;scheduledAt:string}[]; awaitingApproval:readonly {id:string;number:string;updatedAt:string}[]; awaitingConversion:readonly {id:string;number:string;updatedAt:string}[] } }> }
interface SupplierRead { searchSuppliers(context:ExecutionContext):Promise<readonly {party:{id:string}}[]>; overview(context:ExecutionContext,id:string):Promise<{supplier:{party:{displayName:string}};disputes:{open:readonly {id:string;title:string;severity:string;status:string;openedAt:string}[]};holds:{active:readonly {id:string;reason:string;createdAt:string}[]}}> }
interface ProgramRead { list(context:ExecutionContext):Promise<readonly {id:string;code:string;status:string}[]> }
interface ReadinessRead { workQueue(context:ExecutionContext,programId:string):Promise<readonly {key:string;priority:AttentionSeverity;category:string;title:string;detail:string;dueAt?:string;reference?:{sourceType:string;sourceId:string}}[]> }
interface ReportingRead { aging(scope:{companyId:CompanyId;branchIds:readonly BranchId[]},side:'CUSTOMER'):Promise<{positions:readonly {evidenceId:string;dueDate?:string;currency:string;openAmount:string}[]}> }
interface TreasuryRead {
  listCheques(companyId:CompanyId):Promise<readonly {id:string;voucherId:string;direction:'INCOMING'|'OUTGOING';number:string;amount:string;currency:string;dueDate?:string;status:'ISSUED'|'DEPOSITED'|'CLEARED'|'BOUNCED'|'VOIDED'}[]>;
  listVouchers(companyId:CompanyId):Promise<readonly {id:string;branchId?:string}[]>;
}
interface ProcurementRead {
  listPurchaseOrders(companyId:CompanyId,branchId:BranchId):Promise<readonly {id:string;supplierId:string;number:string;status:string;orderDate?:string;createdAt:string;lines:readonly {orderedQuantity:string;invoicedQuantity:string}[]}[]>;
}

export class ManagementControlService {
  constructor(
    private readonly workCenter: WorkCenterApplicationService,
    private readonly crm: CrmRead,
    private readonly suppliers: SupplierRead,
    private readonly programs: ProgramRead,
    private readonly readiness: ReadinessRead,
    private readonly reporting: ReportingRead,
    private readonly treasury: TreasuryRead,
    private readonly procurement: ProcurementRead,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async overview(context: ExecutionContext, filter: WorkCenterFilter = {}): Promise<ManagementOverview> {
    const [crm, supplierResult, hajjResult, aging, chequeItems, procurementItems] = await Promise.all([
      this.crm.dashboard(context), this.supplierAttention(context), this.hajjAttention(context),
      this.reporting.aging({ companyId: context.companyId, branchIds: [context.branchId] }, 'CUSTOMER'),
      this.chequeAttention(context), this.procurementAttention(context),
    ]);
    const items: ManagementAttentionItem[] = [];
    for (const row of crm.attention.overdueFollowups) items.push(this.item(context, 'CRM_SALES', 'FOLLOWUP', row.id, 'متابعة عميل متأخرة', row.nextAction ?? `متابعة العميل المحتمل ${row.leadId}`, 'HIGH', 'OVERDUE', 'FOLLOW_UP', '/crm/followups', row.scheduledAt));
    for (const row of crm.attention.awaitingApproval) items.push(this.item(context, 'CRM_SALES', 'QUOTATION', row.id, 'عرض سعر ينتظر الموافقة', `عرض السعر ${row.number}`, 'HIGH', 'PENDING', 'APPROVAL', '/crm/quotations', row.updatedAt));
    for (const row of crm.attention.awaitingConversion) items.push(this.item(context, 'CRM_SALES', 'QUOTATION', row.id, 'عرض سعر مقبول ينتظر التحويل', `عرض السعر ${row.number}`, 'NORMAL', 'ACCEPTED', 'CONVERSION', '/crm/quotations', row.updatedAt));
    items.push(...supplierResult.items, ...hajjResult.items, ...chequeItems, ...procurementItems);
    const today = this.now().toISOString().slice(0, 10);
    const overdue = aging.positions.filter((value) => Boolean(value.dueDate && value.dueDate < today));
    for (const row of overdue) items.push(this.item(context, 'FINANCE', 'RECEIVABLE', row.evidenceId, 'ذمة عميل مستحقة', `مبلغ مستحق ${row.openAmount} ${row.currency}`, 'HIGH', 'OVERDUE', 'FINANCIAL', '/management/exceptions', row.dueDate));
    const summary: ManagementSummary = {
      crmSales: { ...crm.counts, leadStages: crm.leadStages, quotationStatuses: crm.quotationStatuses, quotationValueByCurrency: crm.quotationValueByCurrency },
      suppliers: { total: supplierResult.total, openDisputes: supplierResult.openDisputes, activeHolds: supplierResult.activeHolds },
      hajjUmrah: { activePrograms: hajjResult.activePrograms, readinessItems: hajjResult.items.length, criticalReadinessItems: hajjResult.items.filter((item) => item.severity === 'CRITICAL').length },
      finance: { overduePositions: overdue.length, overdueByCurrency: sumByCurrency(overdue.map((row) => ({ currency: row.currency, amount: row.openAmount }))) },
    };
    return this.workCenter.compose(context.companyId, context.branchId, items, summary, filter, this.now().toISOString());
  }

  private async supplierAttention(context: ExecutionContext) {
    const suppliers = await this.suppliers.searchSuppliers(context);
    const views = await Promise.all(suppliers.map((row) => this.suppliers.overview(context, row.party.id)));
    const items = views.flatMap((view) => [
      ...view.disputes.open.map((row) => this.item(context, 'SUPPLIERS_PROCUREMENT', 'SUPPLIER_DISPUTE', row.id, 'نزاع مورد مفتوح', `${view.supplier.party.displayName}: ${row.title}`, row.severity === 'CRITICAL' ? 'CRITICAL' : row.severity === 'HIGH' ? 'HIGH' : 'NORMAL', row.status, 'DISPUTE', '/procurement/supplier-intelligence', row.openedAt)),
      ...view.holds.active.map((row) => this.item(context, 'SUPPLIERS_PROCUREMENT', 'SUPPLIER_HOLD', row.id, 'إيقاف مورد نشط', `${view.supplier.party.displayName}: ${row.reason}`, 'HIGH', 'ACTIVE', 'HOLD', '/procurement/supplier-intelligence', row.createdAt)),
    ]);
    return { items, total: suppliers.length, openDisputes: views.reduce((total, view) => total + view.disputes.open.length, 0), activeHolds: views.reduce((total, view) => total + view.holds.active.length, 0) };
  }

  private async hajjAttention(context: ExecutionContext) {
    const programs = (await this.programs.list(context)).filter((program) => !['CLOSED', 'CANCELLED'].includes(program.status));
    const queues = await Promise.all(programs.map(async (program) => ({ program, items: await this.readiness.workQueue(context, program.id) })));
    return {
      activePrograms: programs.length,
      items: queues.flatMap(({ program, items }) => items.map((row) => this.item(context, 'HAJJ_UMRAH', row.reference?.sourceType ?? 'READINESS', row.reference?.sourceId ?? `${program.id}:${row.key}`, `${program.code} — ${row.title}`, row.detail, row.priority, 'OPEN', row.category, '/hajj-umrah/readiness', row.dueAt))),
    };
  }

  private async chequeAttention(context:ExecutionContext):Promise<ManagementAttentionItem[]> {
    const [cheques,vouchers]=await Promise.all([this.treasury.listCheques(context.companyId),this.treasury.listVouchers(context.companyId)]);
    const branchVoucherIds=new Set(vouchers.filter(row=>row.branchId===context.branchId).map(row=>row.id));
    const today=this.now().toISOString().slice(0,10),items:ManagementAttentionItem[]=[];
    for(const row of cheques){if(!branchVoucherIds.has(row.voucherId)||row.status==='CLEARED'||row.status==='VOIDED')continue;
      if(row.status==='BOUNCED'){items.push(this.item(context,'FINANCE','CHEQUE',row.id,'شيك مرتجع',`${row.number} — ${row.amount} ${row.currency}`,'CRITICAL','BOUNCED','CHEQUE','/accounting',row.dueDate));continue;}
      if(!row.dueDate)continue;const remaining=daysBetween(today,row.dueDate);if(remaining>7)continue;
      items.push(this.item(context,'FINANCE','CHEQUE',row.id,row.direction==='INCOMING'?'استحقاق شيك وارد':'استحقاق شيك صادر',`${row.number} — ${row.amount} ${row.currency} — ${row.dueDate}`,remaining<0?'HIGH':'NORMAL',remaining<0?'OVERDUE':'DUE_SOON','CHEQUE_DUE','/accounting',row.dueDate));
    }
    return items;
  }

  private async procurementAttention(context:ExecutionContext):Promise<ManagementAttentionItem[]> {
    const orders=await this.procurement.listPurchaseOrders(context.companyId,context.branchId),items:ManagementAttentionItem[]=[];
    for(const order of orders){if(['DRAFT','CANCELLED','DISPOSED','INVOICED'].includes(order.status))continue;const pending=order.lines.filter(line=>scaled(line.orderedQuantity)>scaled(line.invoicedQuantity));if(!pending.length)continue;
      items.push(this.item(context,'SUPPLIERS_PROCUREMENT','SUPPLIER_COMMITMENT',order.id,'التزام مورد غير مفوتر بالكامل',`أمر شراء ${order.number} — المورد ${order.supplierId} — ${pending.length} بند غير مفوتر بالكامل`,order.status==='RECEIVED'||order.status==='PARTIALLY_INVOICED'?'HIGH':'NORMAL','UNINVOICED','SUPPLIER_COMMITMENT','/procurement/purchase-orders',order.orderDate??order.createdAt));
    }
    return items;
  }

  private item(context: ExecutionContext, domain: ManagementDomain, type: string, id: string, title: string, summary: string, severity: AttentionSeverity, status: string, category: string, path: string, occurredAt?: string): ManagementAttentionItem {
    return { sourceKey: `${type}:${id}`, sourceDomain: domain, sourceType: type, sourceId: id, title, summary, severity, status, companyId: context.companyId, branchId: context.branchId, ...(occurredAt ? { occurredAt } : {}), category, drillDownPath: path };
  }
}

function endOfDay(value: string) { return value.length === 10 ? `${value}T23:59:59.999Z` : value; }
function daysBetween(from:string,to:string){return Math.floor((Date.parse(`${to}T00:00:00Z`)-Date.parse(`${from}T00:00:00Z`))/86400000);}
function sumByCurrency(values: readonly { currency: string; amount: string }[]) {
  const totals = new Map<string, bigint>();
  for (const value of values) totals.set(value.currency, (totals.get(value.currency) ?? 0n) + scaled(value.amount));
  return [...totals].sort(([left], [right]) => left.localeCompare(right)).map(([currency, amount]) => ({ currency, amount: decimal(amount) }));
}
function scaled(value: string) { const negative = value.startsWith('-'); const [whole = '0', fraction = ''] = (negative ? value.slice(1) : value).split('.'); const result = BigInt(whole) * 10n ** 18n + BigInt(fraction.padEnd(18, '0')); return negative ? -result : result; }
function decimal(value: bigint) { const negative = value < 0n; const absolute = negative ? -value : value; const whole = absolute / 10n ** 18n; const fraction = absolute % 10n ** 18n; return `${negative ? '-' : ''}${whole}${fraction ? `.${fraction.toString().padStart(18, '0').replace(/0+$/, '')}` : ''}`; }
