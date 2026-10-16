import { type CommissionDistribution } from '@elhafez/expense-commission-recognition';
import { createHash } from 'node:crypto';
import { ContractValidationError, decimalAmount, sourceReference, type CompanyId, type DecimalAmount, type SourceReference } from '@elhafez/contracts';
import type { TourismFinanceRepository } from './orchestration.repository.js';
import type { BillingPort, CommissionPort, ControlsPort, CostPort, InventoryPort, ProcurementPort, TreasuryPort } from './ports.js';
import type { BookingReference, CancellationBlocker, FinancialSetup, ServiceCategory, ServiceFinancialSnapshot, StandaloneFinancialReference, Workflow, WorkflowKind } from '../domain/orchestration.js';

function stable(value: unknown): string { if (value === null || typeof value !== 'object') return JSON.stringify(value); if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`; return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(',')}}`; }
function hash(value: unknown) { return createHash('sha256').update(stable(value)).digest('hex'); }
function refKey(value: SourceReference) { return `${value.sourceType}:${value.sourceId}`; }
function required(value: string, field: string) { if (!value?.trim()) throw new ContractValidationError(field, 'is required'); }
function nonNegative(value: DecimalAmount, field: string) { const result = decimalAmount(value); if (result.startsWith('-')) throw new ContractValidationError(field, 'must not be negative'); return result; }
function positive(value:DecimalAmount,field:string){const result=nonNegative(value,field);if(units(result)<=0n)throw new ContractValidationError(field,'must be positive');return result;}
function units(value: DecimalAmount) { const [whole, fraction = ''] = value.split('.');if(fraction.length>18)throw new ContractValidationError('amount','supports at most 18 fractional digits'); return BigInt(whole! + fraction.padEnd(18, '0')); }
function fromUnits(value: bigint) { const negative = value < 0n; const absolute = negative ? -value : value; const whole = absolute / 10n ** 18n; const fraction = absolute % 10n ** 18n; return decimalAmount(`${negative ? '-' : ''}${whole}${fraction ? `.${fraction.toString().padStart(18, '0').replace(/0+$/, '')}` : ''}`); }

export interface BookingInventoryRequest { allocationId: string; contractId: string; resourceType: string; resourceId: string; serviceDate: string; quantity: DecimalAmount; periodEnd?: string; flightSegmentReference?: SourceReference; visaBatchReference?: SourceReference }
export interface ConfirmBookingInput {customerCharges?:readonly {travelerId:string;financialCustomerId:string;partyId:string;amount:DecimalAmount}[];capacityHoldKey?:string;requireStock?:boolean; companyId: CompanyId; branchId?: string; commandKey: string; booking: SourceReference; program: SourceReference; programState: 'OPEN' | 'CLOSED' | 'CANCELLED'; programStateEvidence: string; category: ServiceCategory; costCenterId: string; customerPartyId: string; currency: string; grossAmount: DecimalAmount; discountAmount: DecimalAmount; approvalRequestId?: string; postingDate: string; dueDate: string; invoiceNumber: string; inventory?: BookingInventoryRequest; inventories?: readonly BookingInventoryRequest[]; commission?: { agentPartyId: string; amount: DecimalAmount; agreement?: Omit<CommissionDistribution,'precision'> }; }
export interface CancelBookingInput { companyId: CompanyId; branchId?: string; commandKey: string; booking: SourceReference; travelStarted: boolean; travelEvidence: string; postingDate: string; }
export interface ConfirmStandaloneServiceInput { companyId:CompanyId;branchId:string;commandKey:string;service:SourceReference;revision:number;category:ServiceCategory;debtorPartyId:string;currency:string;grossAmount:DecimalAmount;discountAmount:DecimalAmount;postingDate:string;dueDate:string;invoiceNumber:string;planId:string;planVersion:number;approvalRequestId?:string;commission?:{agentPartyId:string;amount:DecimalAmount} }
export interface ProcurementReference { purchaseOrderId?: string; commitmentId?: string; }
function procurementKey(reference: ProcurementReference): string | undefined { return reference.purchaseOrderId ?? reference.commitmentId; }
function bookingProcurementReferences(booking: BookingReference, extra?: ProcurementReference): ProcurementReference[] {
  const values = [...(booking.procurementReferences ?? []), ...(booking.procurementReference ? [booking.procurementReference] : []), ...(extra ? [extra] : [])];
  const unique = new Map<string, ProcurementReference>();
  for (const value of values) { const key = procurementKey(value); if (key) unique.set(key, value); }
  return [...unique.values()].sort((left, right) => procurementKey(left)!.localeCompare(procurementKey(right)!));
}

export class TourismFinanceOrchestrationApplicationService {
  constructor(private readonly repo: TourismFinanceRepository, private readonly billing: BillingPort, private readonly treasury: TreasuryPort, private readonly commission: CommissionPort, private readonly cost: CostPort, private readonly inventory: InventoryPort, private readonly procurement: ProcurementPort, private readonly controls: ControlsPort) {}

  async prepareStandaloneService(input:{companyId:CompanyId;branchId:string;service:SourceReference;revision:number;planId:string;planVersion:number}) {
    const plan=await this.inventory.standalonePlan(input.companyId,input.planId);
    const blockers:string[]=[];
    if(!plan||plan.branchId!==input.branchId||refKey(plan.service)!==refKey(input.service)||plan.serviceRevision!==input.revision||plan.version!==input.planVersion)blockers.push('SUPPLY_PLAN_MISMATCH');
    else {
      if(new Date(plan.expiresAt)<=new Date())blockers.push('SUPPLY_PLAN_EXPIRED');
      if(plan.residuals.some(item=>!item.supplierId||item.unitCost===undefined||!item.quoteReference))blockers.push('EXTERNAL_PROCUREMENT_DETAILS_REQUIRED');
    }
    return {ready:blockers.length===0,blockers,planId:input.planId,planVersion:input.planVersion};
  }

  async confirmStandaloneService(input:ConfirmStandaloneServiceInput):Promise<StandaloneFinancialReference> {
    required(input.branchId,'branchId');required(input.service.sourceId,'service.sourceId');required(input.debtorPartyId,'debtorPartyId');required(input.invoiceNumber,'invoiceNumber');
    const gross=nonNegative(input.grossAmount,'grossAmount');const discount=nonNegative(input.discountAmount,'discountAmount');
    if(units(discount)>units(gross))throw new ContractValidationError('discountAmount','exceeds gross');
    const net=fromUnits(units(gross)-units(discount));
    const plan=await this.inventory.standalonePlan(input.companyId,input.planId);
    if(!plan||plan.branchId!==input.branchId||refKey(plan.service)!==refKey(input.service)||plan.serviceRevision!==input.revision||plan.version!==input.planVersion)throw new ContractValidationError('planId','reviewed plan does not match service revision');
    if(plan.residuals.some(item=>!item.supplierId||item.unitCost===undefined||!item.quoteReference))throw new ContractValidationError('planId','external procurement requires supplier and quote evidence');
    if(Object.keys(plan.totalsByCurrency).some(currency=>currency!==input.currency))throw new ContractValidationError('currency','stock cost has another currency; FX evidence required');
    const payload={branchId:input.branchId,service:input.service,revision:input.revision,category:input.category,debtorPartyId:input.debtorPartyId,currency:input.currency,grossAmount:gross,discountAmount:discount,postingDate:input.postingDate,dueDate:input.dueDate,invoiceNumber:input.invoiceNumber,planId:input.planId,planVersion:input.planVersion,inputHash:plan.inputHash,approvalRequestId:input.approvalRequestId??null,commission:input.commission??null};
    let workflow=await this.workflow('STANDALONE_CONFIRMATION',input,input.service,payload);
    const existing=await this.repo.standalone(input.companyId,input.service);
    const setup=existing?undefined:await this.repo.setup(input.companyId,input.category);
    if(!existing&&!setup?.active)throw new ContractValidationError('financialSetup',`missing ${input.category} setup`);
    const financialSetup=existing?.financialSetup??{receivableAccountId:setup!.receivableAccountId,revenueAccountId:setup!.revenueAccountId,...(setup!.commissionExpenseAccountId?{commissionExpenseAccountId:setup!.commissionExpenseAccountId}:{}),...(setup!.commissionLiabilityAccountId?{commissionLiabilityAccountId:setup!.commissionLiabilityAccountId}:{})};
    const candidate:StandaloneFinancialReference={id:hash([input.companyId,refKey(input.service)]).slice(0,32),companyId:input.companyId,branchId:input.branchId,service:input.service,revision:input.revision,confirmationPayloadHash:hash(payload),confirmationWorkflowId:workflow.id,status:'CONFIRMING',debtorPartyId:input.debtorPartyId,allocationIds:[],purchaseOrderIds:[],financialSetup};
    const claimed=await this.repo.reserveStandalone(candidate);
    if(claimed.confirmationPayloadHash!==candidate.confirmationPayloadHash||claimed.branchId!==input.branchId)throw new ContractValidationError('service','conflicting financial confirmation');
    if(claimed.confirmationWorkflowId!==workflow.id){const canonical=await this.repo.workflowById(input.companyId,claimed.confirmationWorkflowId);if(!canonical)throw new ContractValidationError('service','canonical workflow missing');workflow=canonical;}
    if(workflow.status==='COMPLETED')return workflow.result as StandaloneFinancialReference;
    if(discount!=='0')await this.controls.authorizeServiceDiscount({companyId:input.companyId,branchId:input.branchId,service:input.service,amount:discount,...(input.approvalRequestId?{approvalRequestId:input.approvalRequestId}:{})});
    const stock=await this.effect(workflow,'STANDALONE_SUPPLY',key=>this.inventory.commitStandalone({companyId:input.companyId,branchId:input.branchId,service:input.service,planId:plan.planId,planVersion:plan.version,inputHash:plan.inputHash},key),value=>value.planId);
    const purchaseOrderIds:string[]=[];
    for(const residual of stock.residuals){
      if(!residual.supplierId||residual.unitCost===undefined||!residual.quoteReference)throw new ContractValidationError('supply','supplier quote evidence is missing');
      const po=await this.effect(workflow,`SERVICE_PO:${residual.requestId}`,()=>this.procurement.createServicePurchaseOrder({id:`tfo-service-po:${workflow.id}:${residual.requestId}`,companyId:input.companyId,branchId:input.branchId,number:`SV-PO-${workflow.id.slice(0,12)}-${residual.requestId}`,supplierId:residual.supplierId!,postingDate:input.postingDate,currency:residual.currency,quoteReference:residual.quoteReference!,requestId:residual.requestId,quantity:residual.quantity,unitCost:residual.unitCost!,service:input.service}),value=>value.id);
      purchaseOrderIds.push(po.id);
    }
    const invoice=net==='0'?undefined:await this.effect(workflow,'SERVICE_BILLING',()=>this.billing.createServiceInvoice({id:`tfo-service-invoice:${workflow.id}`,companyId:input.companyId,branchId:input.branchId,partyId:input.debtorPartyId,number:input.invoiceNumber,postingDate:input.postingDate,dueDate:input.dueDate,currency:input.currency,sourceId:input.service.sourceId,receivableAccountId:financialSetup.receivableAccountId,revenueAccountId:financialSetup.revenueAccountId,amount:net}),value=>value.id);
    let commissionClaimId=claimed.commissionClaimId;
    if(input.commission){const expenseAccountId=financialSetup.commissionExpenseAccountId;const liabilityAccountId=financialSetup.commissionLiabilityAccountId;if(!expenseAccountId||!liabilityAccountId)throw new ContractValidationError('financialSetup','commission accounts required');const claim=await this.effect(workflow,'SERVICE_COMMISSION',()=>this.commission.createServiceCommission({id:`tfo-service-commission:${workflow.id}`,companyId:input.companyId,branchId:input.branchId,agentPartyId:input.commission!.agentPartyId,sourceId:input.service.sourceId,currency:input.currency,amount:input.commission!.amount,expenseAccountId,liabilityAccountId}),value=>value.id);commissionClaimId=claim.id;}
    await this.effect(workflow,'SERVICE_FINANCIAL_SNAPSHOT',()=>this.confirmServiceFinancials({id:`tfo-service-snapshot:${workflow.id}`,companyId:input.companyId,service:input.service,category:input.category,currency:input.currency,saleAmount:net,costAmount:plan.totalsByCurrency[input.currency]??decimalAmount('0'),evidence:{planId:plan.planId,allocationIds:stock.allocationIds,invoiceId:invoice?.id??null}}),value=>value.id);
    const result:StandaloneFinancialReference={...claimed,status:'ACTIVE',allocationIds:stock.allocationIds,purchaseOrderIds,...(invoice?{invoiceId:invoice.id}:{}),...(commissionClaimId?{commissionClaimId}:{})};
    await this.repo.saveStandalone(result);
    return (await this.complete(workflow,result)).result as StandaloneFinancialReference;
  }

  async cancelStandaloneService(input:{companyId:CompanyId;branchId:string;commandKey:string;service:SourceReference;postingDate:string;executionCleared:boolean}):Promise<{cancelled:boolean;blockers:readonly string[];operationId:string}> {
    const reference=await this.repo.standalone(input.companyId,input.service);
    if(!reference||reference.branchId!==input.branchId||reference.status==='CONFIRMING')throw new ContractValidationError('service','active same-branch financial reference required');
    const workflow=await this.workflow('STANDALONE_CANCELLATION',input,input.service,input);
    if(workflow.status==='COMPLETED')return workflow.result as {cancelled:boolean;blockers:readonly string[];operationId:string};
    const blockers:string[]=[];
    if(!input.executionCleared)blockers.push('SERVICE_EXECUTION_EVIDENCE_REQUIRED');
    if(reference.invoiceId){const evidence=await this.billing.cancellationEvidence(input.companyId,reference.invoiceId);if(evidence.settlementRequired||!evidence.cancellationSafe)blockers.push(`CUSTOMER_SETTLEMENT:${reference.invoiceId}`);}
    if(reference.commissionClaimId){const evidence=await this.commission.evidence(input.companyId,reference.commissionClaimId);if(evidence.hasPostedPaymentHistory||!evidence.reversible)blockers.push(`COMMISSION:${reference.commissionClaimId}`);}
    for(const id of reference.allocationIds)for(const item of await this.inventory.blockers(input.companyId,id))blockers.push(`INVENTORY:${id}:${item.type}`);
    for(const id of reference.purchaseOrderIds)for(const item of await this.procurement.blockers(input.companyId,{purchaseOrderId:id}))blockers.push(`PROCUREMENT:${id}:${item.type}`);
    if(blockers.length)return {cancelled:false,blockers,operationId:workflow.id};
    for(const id of reference.purchaseOrderIds)await this.effect(workflow,`CANCEL_SERVICE_PO:${id}`,()=>this.procurement.cancelServicePurchaseOrder(input.companyId,id,`Cancel service ${input.service.sourceId}`),value=>value.id);
    if(reference.commissionClaimId)await this.effect(workflow,'REVERSE_SERVICE_COMMISSION',()=>this.commission.reverse(input.companyId,reference.commissionClaimId!,input.postingDate,`SV-C-${workflow.id}`),value=>value.id);
    if(reference.invoiceId)await this.effect(workflow,'CANCEL_SERVICE_INVOICE',()=>this.billing.cancelInvoice(input.companyId,reference.invoiceId!,input.postingDate,`SV-C-${workflow.id}`),value=>value.id);
    for(const id of reference.allocationIds){const allocation=await this.inventory.allocation(input.companyId,id);if(!allocation)throw new ContractValidationError('inventory','canonical allocation missing');await this.effect(workflow,`RELEASE_SERVICE:${id}`,async key=>{const result=await this.inventory.release(input.companyId,id,allocation.quantity,key);if(!result.success)throw new ContractValidationError('inventory','release blocked');return result;},()=>id);}
    await this.repo.saveStandalone({...reference,status:'CANCELLED'});
    return (await this.complete(workflow,{cancelled:true,blockers:[],operationId:workflow.id})).result as {cancelled:boolean;blockers:readonly string[];operationId:string};
  }

  async configureFinancialSetup(input: FinancialSetup) { required(input.id, 'id'); const value = { ...input, active: true }; await this.repo.saveSetup(value); return value; }
  private async workflow(kind: WorkflowKind, input: { companyId: CompanyId; branchId?: string; commandKey: string }, source: SourceReference, payload: unknown) { required(input.commandKey, 'commandKey'); const payloadHash = hash(payload); const old = await this.repo.workflow(input.companyId, input.commandKey); if (old) { if (old.payloadHash !== payloadHash || old.kind !== kind) throw new ContractValidationError('commandKey', 'conflicting replay'); return old; } const now = new Date().toISOString(); const value: Workflow = { id: hash([input.companyId, input.commandKey]).slice(0, 32), companyId: input.companyId, ...(input.branchId ? { branchId: input.branchId } : {}), kind, commandKey: input.commandKey, payloadHash, sourceType: source.sourceType, sourceId: source.sourceId, status: 'RUNNING', payload, createdAt: now, updatedAt: now }; const reserved = await this.repo.reserveWorkflow(value); if (reserved.payloadHash !== payloadHash) throw new ContractValidationError('commandKey', 'conflicting replay'); return reserved; }
  private async effect<T>(workflow: Workflow, name: string, call: (key: string) => Promise<T>, reference: (result: T) => string | undefined): Promise<T> { const prior = await this.repo.step(workflow.companyId, workflow.id, name); if (prior?.status === 'COMPLETED') return prior.result as T; const step = prior ?? await this.repo.reserveStep({ id: hash([workflow.id, name]).slice(0, 32), companyId: workflow.companyId, workflowId: workflow.id, name, effectKey: `TFO:${workflow.id}:${name}`, status: 'PENDING', createdAt: new Date().toISOString() }); const result = await call(step.effectKey); await this.repo.completeStep(workflow.companyId, step.id, reference(result), result); return result; }
  private async complete(workflow: Workflow, result: unknown, status: Workflow['status'] = 'COMPLETED') { const value = { ...workflow, status, result, updatedAt: new Date().toISOString() }; await this.repo.saveWorkflow(value); return value; }
  private assertBranch(booking: BookingReference, branchId?: string) { if (booking.branchId !== branchId) throw new ContractValidationError('branchId', 'booking belongs to a different branch'); }

  async holdBookingCapacity(input:{companyId:CompanyId;branchId:string;commandKey:string;booking:SourceReference;program:SourceReference;expiresAt:string;inventory:BookingInventoryRequest}){
    const expiry=Date.parse(input.expiresAt);if(!Number.isFinite(expiry))throw new ContractValidationError('expiresAt','valid deadline required');positive(input.inventory.quantity,'quantity');
    const workflow=await this.workflow('BOOKING_HOLD',input,input.booking,input);
    if(workflow.status==='HELD')return workflow.result;
    if(workflow.status!=='RUNNING')throw new ContractValidationError('hold','capacity hold has already moved to another lifecycle state');
    try{
      const allocation=await this.effect(workflow,'HOLD_CAPACITY',key=>this.inventory.allocate({companyId:input.companyId,...input.inventory,program:input.program},key),value=>value.allocationId);
      if(!allocation.allocationId)throw new ContractValidationError('capacity','temporary hold requires real contracted capacity');
      const result={allocationId:allocation.allocationId,expiresAt:input.expiresAt};if(!await this.repo.transitionHold(input.companyId,workflow.id,'RUNNING','HELD',result)){const current=await this.repo.workflowById(input.companyId,workflow.id);if(current?.status!=='HELD')throw new ContractValidationError('hold','hold changed while reservation completed');return current.result;}return result;
    }catch(error){if(error instanceof ContractValidationError)await this.repo.transitionHold(input.companyId,workflow.id,'RUNNING','BLOCKED',{reason:error.message});throw error;}
  }
  private async requiredHold(input:{companyId:CompanyId;branchId?:string;booking:SourceReference;capacityHoldKey:string}){
    const hold=await this.repo.workflow(input.companyId,input.capacityHoldKey);
    if(!hold||hold.kind!=='BOOKING_HOLD'||hold.branchId!==input.branchId||hold.sourceType!==input.booking.sourceType||hold.sourceId!==input.booking.sourceId)throw new ContractValidationError('hold','canonical booking hold not found');return hold;
  }
  async releaseBookingHold(input:{companyId:CompanyId;branchId:string;booking:SourceReference;capacityHoldKey:string}){
    let hold=await this.requiredHold(input);if(hold.status==='HOLD_RELEASED')return{released:true};
    if(hold.status==='BLOCKED'){if(!await this.repo.transitionHold(input.companyId,hold.id,'BLOCKED','HOLD_RELEASED'))throw new ContractValidationError('hold','hold changed');return{released:true};}
    if(hold.status==='HELD'){await this.repo.transitionHold(input.companyId,hold.id,'HELD','HOLD_RELEASING');hold=await this.requiredHold(input);}
    if(hold.status!=='HOLD_RELEASING')throw new ContractValidationError('hold','hold is still being reserved or adopted; retry its original operation first');
    const payload=hold.payload as {inventory:BookingInventoryRequest},result=hold.result as {allocationId:string};
    await this.effect(hold,'RELEASE_HOLD',async key=>{const released=await this.inventory.release(input.companyId,result.allocationId,payload.inventory.quantity,key);if(!released.success)throw new ContractValidationError('hold','inventory owner blocks release');return released;},()=>result.allocationId);
    await this.repo.transitionHold(input.companyId,hold.id,'HOLD_RELEASING','HOLD_RELEASED');return{released:true};
  }
  async confirmBooking(input: ConfirmBookingInput) {
    required(input.booking.sourceId, 'booking.sourceId'); required(input.program.sourceId, 'program.sourceId'); required(input.customerPartyId, 'customerPartyId'); required(input.programStateEvidence, 'programStateEvidence'); required(input.dueDate, 'dueDate');
    if (input.programState !== 'OPEN') throw new ContractValidationError('programState', 'selling requires OPEN program');
    const gross = nonNegative(input.grossAmount, 'grossAmount'); const discount = nonNegative(input.discountAmount, 'discountAmount'); if (units(discount) > units(gross)) throw new ContractValidationError('discountAmount', 'cannot exceed gross'); const net = fromUnits(units(gross) - units(discount));
    const charges=input.customerCharges?[...input.customerCharges].sort((a,b)=>a.travelerId.localeCompare(b.travelerId)||a.financialCustomerId.localeCompare(b.financialCustomerId)):undefined;
    if(charges){
      if(!charges.length||charges.length>500||new Set(charges.map(x=>JSON.stringify([x.travelerId,x.financialCustomerId]))).size!==charges.length)throw new ContractValidationError('customerCharges','1..500 distinct traveler/debtor charges required');
      let total=0n;for(const charge of charges){required(charge.travelerId,'travelerId');required(charge.financialCustomerId,'financialCustomerId');required(charge.partyId,'partyId');total+=units(positive(charge.amount,'charge.amount'));}
      if(total!==units(net))throw new ContractValidationError('customerCharges','charges must exactly equal net booking price');
    }
    const inventories = [...(input.inventories ?? (input.inventory ? [input.inventory] : []))].sort((a,b)=>a.allocationId.localeCompare(b.allocationId));
    if (!inventories.length) throw new ContractValidationError('inventory','at least one allocation is required');
    if (new Set(inventories.map(item=>item.allocationId)).size!==inventories.length) throw new ContractValidationError('inventories','duplicate allocation identity');
    if(input.commission?.agreement&&input.commission.agentPartyId!==input.commission.agreement.subordinatePartyId)throw new ContractValidationError('commission','agreement does not belong to booking agent');
    const financialPayload = { ...(charges?{customerCharges:charges}:{}),...(input.capacityHoldKey?{capacityHoldKey:input.capacityHoldKey}:{}),...(input.requireStock?{requireStock:true}:{}),branchId: input.branchId ?? null, booking: input.booking, program: input.program, programState: input.programState, programStateEvidence: input.programStateEvidence, category: input.category, costCenterId: input.costCenterId, customerPartyId: input.customerPartyId, currency: input.currency, grossAmount: gross, discountAmount: discount, approvalRequestId: input.approvalRequestId ?? null, postingDate: input.postingDate, dueDate: input.dueDate, invoiceNumber: input.invoiceNumber, inventories, commission: input.commission ?? null };
    const confirmationPayloadHash = hash(financialPayload); let workflow = await this.workflow('BOOKING_CONFIRMATION', input, input.booking, financialPayload);
    const existing = await this.repo.booking(input.companyId, input.booking);
    const setup = existing ? undefined : await this.repo.setup(input.companyId, input.category);
    if (!existing && !setup?.active) throw new ContractValidationError('financialSetup', `missing ${input.category} setup`);
    const financialSetup = existing?.financialSetup ?? { receivableAccountId: setup!.receivableAccountId, customerAdvanceAccountId: setup!.customerAdvanceAccountId, revenueAccountId: setup!.revenueAccountId, ...(setup!.commissionExpenseAccountId ? { commissionExpenseAccountId: setup!.commissionExpenseAccountId } : {}), ...(setup!.commissionLiabilityAccountId ? { commissionLiabilityAccountId: setup!.commissionLiabilityAccountId } : {}) };
    const reservation: BookingReference = { id: hash([input.companyId, refKey(input.booking)]).slice(0, 32), companyId: input.companyId, ...(input.branchId ? { branchId: input.branchId } : {}), booking: input.booking, program: input.program, customerPartyId: input.customerPartyId, confirmationPayloadHash, status: 'CONFIRMING', allocations: [], ...(input.approvalRequestId ? { approvalRequestId: input.approvalRequestId } : {}), depositVoucherIds: [], workflowId: workflow.id, financialSetup };
    const claimed = await this.repo.reserveBooking(reservation);
    if (claimed.confirmationPayloadHash !== confirmationPayloadHash) throw new ContractValidationError('booking', 'conflicting financial confirmation replay');
    if (claimed.workflowId !== workflow.id) { const canonical = await this.repo.workflowById(input.companyId, claimed.workflowId); if (!canonical) throw new ContractValidationError('booking', 'canonical confirmation workflow is missing'); workflow = canonical; }
    if (workflow.status === 'COMPLETED') return workflow.result;
    let held:Workflow|undefined;
    if(input.capacityHoldKey){
      held=await this.requiredHold({...input,capacityHoldKey:input.capacityHoldKey});
      const payload=held.payload as {program:SourceReference;inventory:BookingInventoryRequest};
      if(refKey(payload.program)!==refKey(input.program)||!inventories.some(x=>stable(x)===stable(payload.inventory)))throw new ContractValidationError('hold','confirmation must preserve the held inventory request');
      if(held.status==='HELD'){await this.repo.transitionHold(input.companyId,held.id,'HELD','HOLD_CONFIRMING');held=await this.requiredHold({...input,capacityHoldKey:input.capacityHoldKey});}
      if(held.status!=='HOLD_CONFIRMING')throw new ContractValidationError('hold','capacity hold is not available for confirmation');
    }
    const claimedSetup = claimed.financialSetup;
    let commissionShares:readonly {partyId:string;amount:DecimalAmount}[]=input.commission?[{partyId:input.commission.agentPartyId,amount:nonNegative(input.commission.amount,'commission')}]:[];
    if(input.commission?.agreement){
      if(!this.commission.plan)throw new ContractValidationError('commission','distribution provider required');
      const plan=await this.effect(workflow,'COMMISSION_DISTRIBUTION',()=>this.commission.plan!(input.companyId,input.currency,input.commission!.amount,input.commission!.agreement!),value=>value.snapshot.agreementId);
      commissionShares=plan.shares;
    }

    if (discount !== '0') await this.controls.authorizeDiscount({ companyId: input.companyId, ...(input.branchId ? { branchId: input.branchId } : {}), booking: input.booking, amount: discount, ...(input.approvalRequestId ? { approvalRequestId: input.approvalRequestId } : {}) });
    await this.effect(workflow, 'COST_CENTER', () => this.cost.ensureProgram(input.companyId, input.program, input.costCenterId), (value) => value.costCenterId);
    const allocations=[] as Array<{allocationId?:string;procurementReference?:string;quantity:DecimalAmount}>;
    for(const request of inventories){const result=await this.effect(workflow,inventories.length===1?'INVENTORY':`INVENTORY:${request.allocationId}`,(key)=>this.inventory.allocate({companyId:input.companyId,...request,program:input.program},held&&stable((held.payload as {inventory:BookingInventoryRequest}).inventory)===stable(request)?`TFO:${held.id}:HOLD_CAPACITY`:key),(value)=>value.allocationId??value.procurementReference);if(input.requireStock&&!result.allocationId)throw new ContractValidationError('capacity','no confirmed capacity; explicit review required');allocations.push({...result,quantity:request.quantity});}
    const customerInvoices=[] as NonNullable<BookingReference['customerInvoices']>[number][];
    if(charges)for(const [index,charge] of charges.entries()){
      const invoice=await this.effect(workflow,'BILLING:'+index,()=>this.billing.createBookingInvoice({id:`tfo-invoice:${workflow.id}:${index}`,companyId:input.companyId,...(input.branchId?{branchId:input.branchId}:{}),partyId:charge.partyId,number:input.invoiceNumber+'-'+(index+1),postingDate:input.postingDate,dueDate:input.dueDate,currency:input.currency,sourceId:workflow.id+':'+index,receivableAccountId:claimedSetup.receivableAccountId,revenueAccountId:claimedSetup.revenueAccountId,amount:charge.amount}),value=>value.id);
      customerInvoices.push({...charge,invoiceId:invoice.id,number:input.invoiceNumber+'-'+(index+1)});
    }
    const invoice = charges?{id:customerInvoices[0]!.invoiceId}:await this.effect(workflow, 'BILLING', () => this.billing.createBookingInvoice({ id: `tfo-invoice:${workflow.id}`, companyId: input.companyId, ...(input.branchId ? { branchId: input.branchId } : {}), partyId: input.customerPartyId, number: input.invoiceNumber, postingDate: input.postingDate, dueDate: input.dueDate, currency: input.currency, sourceId: workflow.id, receivableAccountId: claimedSetup.receivableAccountId, revenueAccountId: claimedSetup.revenueAccountId, amount: net }), (value) => value.id);
    const commissionClaimIds:string[]=[];
    for(const [index,share] of commissionShares.entries()){
      if(share.amount==='0')continue;
      const expenseAccountId=claimedSetup.commissionExpenseAccountId,liabilityAccountId=claimedSetup.commissionLiabilityAccountId;
      if(!expenseAccountId||!liabilityAccountId)throw new ContractValidationError('financialSetup','commission accounts required');
      const suffix=input.commission?.agreement?`:${index}`:'';
      const claim=await this.effect(workflow,`COMMISSION${suffix}`,()=>this.commission.create({id:`tfo-commission:${workflow.id}${suffix}`,companyId:input.companyId,...(input.branchId?{branchId:input.branchId}:{}),agentPartyId:share.partyId,sourceId:workflow.id+suffix,currency:input.currency,amount:share.amount,expenseAccountId,liabilityAccountId}),value=>value.id);
      commissionClaimIds.push(claim.id);
    }
    const commissionClaimId=commissionClaimIds[0];
    const procurementReferences = [...new Map(
      allocations.flatMap((item) => item.procurementReference ? [[item.procurementReference, { purchaseOrderId: item.procurementReference } as ProcurementReference] as const] : []),
    ).values()];
    const finalBooking: BookingReference = {
      ...claimed,
      status: 'ACTIVE',
      invoiceId: invoice.id,
      ...(charges?{customerInvoices}:{}),
      allocations: allocations.flatMap((item) => item.allocationId ? [{ id: item.allocationId, quantity: item.quantity }] : []),
      procurementReferences,
      ...(procurementReferences.length === 1 ? { procurementReference: procurementReferences[0] } : {}),
      ...(commissionClaimId ? { commissionClaimId } : {}),
      commissionClaimIds,
    };
    await this.repo.saveBooking(finalBooking);
    return (await this.complete(workflow, finalBooking)).result;
  }

  async recordFamilyDeposit(input:{companyId:CompanyId;branchId:string;commandKey:string;familyReference:string;treasuryId:string;number:string;postingDate:string;amount:DecimalAmount;allocations:readonly {booking:SourceReference;invoiceId?:string;amount:DecimalAmount}[]}){
    const amount=positive(input.amount,'amount');required(input.familyReference,'familyReference');
    if(!input.allocations.length||input.allocations.length>50)throw new ContractValidationError('allocations','1..50 explicit booking allocations required');
    if(new Set(input.allocations.map(x=>JSON.stringify([refKey(x.booking),x.invoiceId??null]))).size!==input.allocations.length)throw new ContractValidationError('allocations','duplicate booking');
    let sum=0n;for(const item of input.allocations){sum+=units(positive(item.amount,'amount'));const booking=await this.repo.booking(input.companyId,item.booking);if(!booking?.invoiceId||booking.status!=='ACTIVE')throw new ContractValidationError('booking','active invoiced booking required');this.assertBranch(booking,input.branchId);const invoices=bookingInvoices(booking);if(invoices.length>1&&!item.invoiceId||item.invoiceId&&!invoices.some(x=>x.invoiceId===item.invoiceId))throw new ContractValidationError('invoiceId','explicit invoice belonging to booking required');}
    if(sum!==units(amount))throw new ContractValidationError('allocations','reviewed allocations must exactly equal received amount');
    const workflow=await this.workflow('BOOKING_DEPOSIT',input,sourceReference('FAMILY_RECEIPT',input.familyReference),input);
    if(workflow.status==='COMPLETED')return workflow.result;
    const receipts:unknown[]=[];
    for(const [index,item] of input.allocations.entries())receipts.push(await this.effect(workflow,'FAMILY_ALLOCATION:'+refKey(item.booking)+(item.invoiceId?':'+item.invoiceId:''),()=>this.recordBookingDeposit({companyId:input.companyId,branchId:input.branchId,commandKey:input.commandKey+':'+index,booking:item.booking,...(item.invoiceId?{invoiceId:item.invoiceId}:{}),treasuryId:input.treasuryId,number:input.number+'-'+(index+1),postingDate:input.postingDate,amount:item.amount}),()=>refKey(item.booking)));
    return(await this.complete(workflow,{workflowId:workflow.id,amount,receipts})).result;
  }
  async recordBookingDeposit(input: { companyId: CompanyId; branchId?: string; commandKey: string; booking: SourceReference; invoiceId?:string; treasuryId: string; number: string; postingDate: string; amount: DecimalAmount }) { const booking = await this.repo.booking(input.companyId, input.booking); if (!booking?.invoiceId) throw new ContractValidationError('booking', 'confirmed financial reference not found'); this.assertBranch(booking, input.branchId); const choices=bookingInvoices(booking);if(choices.length>1&&!input.invoiceId)throw new ContractValidationError('invoiceId','choose the individual debtor invoice explicitly');const selected=choices.find(x=>x.invoiceId===(input.invoiceId??booking.invoiceId));if(!selected)throw new ContractValidationError('invoiceId','invoice does not belong to booking');const amount = nonNegative(input.amount, 'amount'); if (amount === '0') throw new ContractValidationError('amount', 'must be positive'); const setup = await this.requiredSetupForBooking(booking); const workflow = await this.workflow('BOOKING_DEPOSIT', input, input.booking, { ...input, amount }); if (workflow.status === 'COMPLETED') return workflow.result; if(booking.status!=='ACTIVE')throw new ContractValidationError('booking','active financial booking required');const voucher = await this.effect(workflow, 'TREASURY_DEPOSIT', () => this.treasury.postDeposit({ id: `tfo-deposit:${workflow.id}`, companyId: input.companyId, ...(input.branchId ? { branchId: input.branchId } : {}), treasuryId: input.treasuryId, partyId: selected.partyId, invoiceId: selected.invoiceId, number: input.number, postingDate: input.postingDate, amount, controlAccountId: setup.receivableAccountId, advanceAccountId: setup.customerAdvanceAccountId }), (value) => value.id); if (!booking.depositVoucherIds.includes(voucher.id)) await this.repo.saveBooking({ ...booking, depositVoucherIds: [...booking.depositVoucherIds, voucher.id] }); return (await this.complete(workflow, { workflowId: workflow.id, voucherId: voucher.id, invoiceId: selected.invoiceId })).result; }
  private async requiredSetupForBooking(booking: BookingReference) {
    // BLOCKER-5: Use snapshotted financial setup from booking confirmation
    return {
        receivableAccountId: booking.financialSetup.receivableAccountId,
        customerAdvanceAccountId: booking.financialSetup.customerAdvanceAccountId,
        revenueAccountId: booking.financialSetup.revenueAccountId,
        costAccountId: '', // Not needed for deposit
        commissionExpenseAccountId: booking.financialSetup.commissionExpenseAccountId,
        commissionLiabilityAccountId: booking.financialSetup.commissionLiabilityAccountId,
      };
  }

  async settleBookingCancellation(input: { companyId: CompanyId; branchId?: string; commandKey: string; booking: SourceReference; postingDate: string; number: string }) { const booking = await this.repo.booking(input.companyId, input.booking); if (!booking) throw new ContractValidationError('booking', 'financial reference not found'); this.assertBranch(booking, input.branchId); const workflow = await this.workflow('BOOKING_SETTLEMENT', input, input.booking, input); if (workflow.status === 'COMPLETED') return workflow.result; for (const voucherId of booking.depositVoucherIds) await this.effect(workflow, `REVERSE_DEPOSIT:${voucherId}`, () => this.treasury.reverseDeposit(input.companyId, voucherId, input.postingDate, `${input.number}-${voucherId}`), (value) => value.id); return (await this.complete(workflow, { workflowId: workflow.id, settled: true, retainedVoucherIds: booking.depositVoucherIds })).result; }
  async getBookingCancellationBlockers(input: { companyId: CompanyId; branchId?: string; booking: SourceReference; travelStarted: boolean; travelEvidence: string; procurement?: ProcurementReference }) {
    const booking = await this.repo.booking(input.companyId, input.booking);
    if (!booking?.invoiceId) throw new ContractValidationError('booking', 'confirmed financial reference not found');
    this.assertBranch(booking, input.branchId);
    const blockers: CancellationBlocker[] = [];
    if (input.travelStarted) blockers.push({ type: 'TRAVEL_STARTED', reference: input.travelEvidence });
    const billingInvoices=await Promise.all(bookingInvoices(booking).map(async invoice=>({invoiceId:invoice.invoiceId,evidence:await this.billing.cancellationEvidence(input.companyId,invoice.invoiceId)})));
    for(const invoice of billingInvoices)if(invoice.evidence.settlementRequired)blockers.push({type:'CUSTOMER_SETTLEMENT_REQUIRED',reference:invoice.invoiceId});
    for(const claimId of bookingCommissionClaims(booking)){const evidence=await this.commission.evidence(input.companyId,claimId);if(evidence.hasPostedPaymentHistory||!evidence.reversible)blockers.push({type:'PAID_COMMISSION',reference:claimId});}
    for (const allocation of booking.allocations) for (const item of await this.inventory.blockers(input.companyId, allocation.id)) blockers.push({ type: 'INVENTORY', reference: allocation.id, detail: item.type });
    for (const reference of bookingProcurementReferences(booking, input.procurement)) {
      for (const item of await this.procurement.blockers(input.companyId, reference)) blockers.push({ type: item.type, reference: item.purchaseOrderId, detail: item.lineId });
    }
    return { booking, blockers, billingEvidence: billingInvoices[0]!.evidence,...(booking.customerInvoices?{billingInvoicesEvidence:billingInvoices}:{}) };
  }
  async cancelBooking(input: CancelBookingInput) { const workflow = await this.workflow('BOOKING_CANCELLATION', input, input.booking, input); if (workflow.status === 'COMPLETED') return workflow.result; const evidence = await this.getBookingCancellationBlockers(input); if (evidence.blockers.length) { const settlement = evidence.blockers.some((item) => item.type === 'CUSTOMER_SETTLEMENT_REQUIRED'); return (await this.complete(workflow, { workflowId: workflow.id, blockers: evidence.blockers }, settlement ? 'SETTLEMENT_REQUIRED' : 'BLOCKED')).result; } const booking = evidence.booking; for(const claimId of bookingCommissionClaims(booking))await this.effect(workflow,`REVERSE_COMMISSION:${claimId}`,()=>this.commission.reverse(input.companyId,claimId,input.postingDate,`C-${workflow.id}:${claimId}`),value=>value.id); for(const [index,invoice] of bookingInvoices(booking).entries())await this.effect(workflow, booking.customerInvoices?'CANCEL_INVOICE:'+index:'CANCEL_INVOICE', () => this.billing.cancelInvoice(input.companyId, invoice.invoiceId, input.postingDate, `C-${workflow.id}`+(booking.customerInvoices?':'+index:'')), (value) => value.id); for (const allocation of booking.allocations) await this.effect(workflow, `RELEASE:${allocation.id}`, async (key) => { const released = await this.inventory.release(input.companyId, allocation.id, allocation.quantity, key); if (!released.success) throw new ContractValidationError('inventory', 'owner rejected full allocation release'); return released; }, () => allocation.id); await this.repo.saveBooking({ ...booking, status: 'CANCELLED' }); return (await this.complete(workflow, { workflowId: workflow.id, cancelled: true })).result; }
  async cancelProgram(input: { companyId: CompanyId; branchId?: string; commandKey: string; program: SourceReference; bookings?: readonly { booking: SourceReference; travelStarted: boolean; travelEvidence: string; procurement?: ProcurementReference }[]; programTravelStarted?: boolean; programTravelEvidence?: string; postingDate: string }) {
    const bookings: readonly { booking: SourceReference; travelStarted: boolean; travelEvidence: string; procurement?: ProcurementReference }[] =
      input.bookings ?? (await this.repo.bookingsForProgram(input.companyId, input.program)).map((value) => ({
        booking: value.booking,
        travelStarted: input.programTravelStarted === true,
        travelEvidence: input.programTravelEvidence ?? 'PROGRAM_TRAVEL_STATE:UNKNOWN',
      }));
    const command = { ...input, bookings };
    const workflow = await this.workflow('PROGRAM_CANCELLATION', command, input.program, command); if (workflow.status === 'COMPLETED') return workflow.result;
    const evaluate = async () => (await Promise.all(bookings.map((item) => this.getBookingCancellationBlockers({ companyId: input.companyId, ...(input.branchId ? { branchId: input.branchId } : {}), ...item })))).flatMap((item) => item.blockers);
    let blockers = await evaluate(); if (blockers.length) return (await this.complete(workflow, { workflowId: workflow.id, blockers }, blockers.some((item) => item.type === 'CUSTOMER_SETTLEMENT_REQUIRED') ? 'SETTLEMENT_REQUIRED' : 'BLOCKED')).result;
    blockers = await evaluate(); if (blockers.length) return (await this.complete(workflow, { workflowId: workflow.id, blockers }, 'BLOCKED')).result;
    const persistedBookings = await Promise.all(bookings.map((item) => this.repo.booking(input.companyId, item.booking)));
    const procurementReferences = [...new Map(
      bookings.flatMap((item, index) => persistedBookings[index] ? bookingProcurementReferences(persistedBookings[index]!, item.procurement) : (item.procurement ? [item.procurement] : []))
        .flatMap((reference) => procurementKey(reference) ? [[procurementKey(reference)!, reference] as const] : []),
    ).values()].sort((left, right) => procurementKey(left)!.localeCompare(procurementKey(right)!));
    for (const reference of procurementReferences) { const fresh = await this.procurement.blockers(input.companyId, reference); if (fresh.length) return (await this.complete(workflow, { workflowId: workflow.id, blockers: fresh }, 'BLOCKED')).result; try { await this.effect(workflow, `PROCUREMENT_CLEANUP:${reference.purchaseOrderId ?? reference.commitmentId}`, () => this.procurement.cleanupForProgramCancellation(input.companyId, reference), (value) => value.id); } catch (error) { if (error instanceof ContractValidationError) return (await this.complete(workflow, { workflowId: workflow.id, blockers: [{ type: 'PROCUREMENT_CLEANUP_REJECTED', reference: reference.purchaseOrderId ?? reference.commitmentId, detail: error.message }] }, 'BLOCKED')).result; throw error; } }
    const childResults: Array<{ booking: SourceReference; result: unknown; status: 'BLOCKED'|'SETTLEMENT_REQUIRED'|'CANCELLED' }> = [];
    for (const item of bookings) {
      const result = await this.cancelBooking({ companyId: input.companyId, ...(input.branchId ? { branchId: input.branchId } : {}), commandKey: `${input.commandKey}:booking:${refKey(item.booking)}`, booking: item.booking, travelStarted: item.travelStarted, travelEvidence: item.travelEvidence, postingDate: input.postingDate }) as { cancelled?: boolean; blockers?: CancellationBlocker[] };
      childResults.push({ booking: item.booking, result, status: result.cancelled ? 'CANCELLED' : result.blockers?.some((blocker) => blocker.type === 'CUSTOMER_SETTLEMENT_REQUIRED') ? 'SETTLEMENT_REQUIRED' : 'BLOCKED' });
    }
    const childBlockers = childResults.filter((item) => item.status === 'BLOCKED' || item.status === 'SETTLEMENT_REQUIRED');
    if (childBlockers.length) { const allBlockers = childBlockers.flatMap((item) => { const result = item.result as { blockers: CancellationBlocker[] }; return result.blockers.map((blocker) => ({ ...blocker, booking: item.booking })); }); const requiresSettlement = allBlockers.some((item) => item.type === 'CUSTOMER_SETTLEMENT_REQUIRED'); return (await this.complete(workflow, { workflowId: workflow.id, blockers: allBlockers, childFailures: childBlockers.map((item) => refKey(item.booking)) }, requiresSettlement ? 'SETTLEMENT_REQUIRED' : 'BLOCKED')).result; }
    await this.repo.saveProgramHistory({ id: hash([workflow.id, 'CANCELLED']).slice(0, 32), companyId: input.companyId, program: input.program, kind: 'CANCELLED', workflowId: workflow.id, evidence: { bookings: bookings.map((item) => item.booking) }, createdAt: new Date().toISOString() }); return (await this.complete(workflow, { workflowId: workflow.id, cancelled: true })).result;
  }
  async closeProgram(input: { companyId: CompanyId; branchId?: string; commandKey: string; program: SourceReference; operationalEvidence: string }) { const workflow = await this.workflow('PROGRAM_CLOSE', input, input.program, input); if (workflow.status === 'COMPLETED') return workflow.result; await this.repo.saveProgramHistory({ id: hash([workflow.id, 'CLOSED']).slice(0, 32), companyId: input.companyId, program: input.program, kind: 'CLOSED', workflowId: workflow.id, evidence: { operationalEvidence: input.operationalEvidence }, createdAt: new Date().toISOString() }); return (await this.complete(workflow, { workflowId: workflow.id, closed: true })).result; }
  async getProgramDeletionEligibility(companyId: CompanyId, program: SourceReference) { const history = await this.repo.programHistory(companyId, program); const bookings = await this.repo.bookingsForProgram(companyId, program); const cancelled = history.some((item) => item.kind === 'CANCELLED'); const active = bookings.filter((item) => item.status !== 'CANCELLED'); return { deletable: cancelled && active.length === 0, retainedEvidenceReferences: [...history.map((item) => item.id), ...bookings.flatMap((item) => [...bookingInvoices(item).map(x=>x.invoiceId), ...bookingCommissionClaims(item), ...item.allocations.map((allocation) => allocation.id), ...bookingProcurementReferences(item).map((reference) => procurementKey(reference))].filter((value): value is string => Boolean(value)))], ...(cancelled && active.length === 0 ? {} : { reason: cancelled ? 'ACTIVE_BOOKING_FINANCIAL_STATE' : 'PROGRAM_CANCELLATION_NOT_COMPLETED' }) }; }
  async evaluateFinancialReadiness(input: { companyId: CompanyId; branchId?: string; program: SourceReference; requiredCategories: readonly ServiceCategory[]; approvalRequestIds?: readonly string[]; allocationIds?: readonly string[]; procurementReferences?: readonly ProcurementReference[] }) {
    const blockers: string[] = []; const evidenceReferences: string[] = [refKey(input.program)];
    // BR-053: Derive authoritative financial scope from persisted program/booking/workflow state
    const allBookings = await this.repo.bookingsForProgram(input.companyId, input.program);
    const allProgramWorkflows = await this.repo.workflowsForProgram(input.companyId, input.program);
    if (input.branchId && (allBookings.some((item) => item.branchId !== input.branchId) || allProgramWorkflows.some((item) => item.branchId && item.branchId !== input.branchId))) {
      blockers.push('BRANCH_SCOPE_MISMATCH');
    }
    const bookings = input.branchId ? allBookings.filter((item) => item.branchId === input.branchId) : allBookings;
    const programWorkflows = input.branchId ? allProgramWorkflows.filter((item) => !item.branchId || item.branchId === input.branchId) : allProgramWorkflows;
    const bookingWorkflows = (await Promise.all(bookings.map((booking) => this.repo.workflowsForBooking(input.companyId, booking.booking)))).flat();
    const workflows = [...new Map([...programWorkflows, ...bookingWorkflows].map((item) => [item.id, item])).values()];
    
    // 1. Check required category setup (persisted)
    for (const category of input.requiredCategories) {
      const setup = await this.repo.setup(input.companyId, category);
      if (!setup?.active) blockers.push(`MISSING_SETUP:${category}`);
      else evidenceReferences.push(setup.id);
    }
    
    // 2. Check program Cost Center association (from Cost owned data)
    try { const center = await this.cost.resolveProgram(input.companyId, input.program); evidenceReferences.push(center.costCenterId); }
    catch { blockers.push('MISSING_PROGRAM_COST_CENTER'); }
    
    // 3. Check all persisted allocations from bookings
    const allAllocationIds = new Set<string>();
    for (const booking of bookings) {
      for (const allocation of booking.allocations) allAllocationIds.add(allocation.id);
    }
    for (const id of (input.allocationIds ?? [])) allAllocationIds.add(id);
    for (const allocationId of allAllocationIds) {
      const ownerBlockers = await this.inventory.blockers(input.companyId, allocationId);
      blockers.push(...ownerBlockers.map((item) => `INVENTORY:${allocationId}:${item.type}`));
      evidenceReferences.push(allocationId);
    }
    
    // 4. Check persisted commission claim references from bookings
    for (const booking of bookings) {
      for (const claimId of bookingCommissionClaims(booking)) {
        const commEvidence = await this.commission.evidence(input.companyId, claimId);
        if (commEvidence.hasPostedPaymentHistory) blockers.push(`PAID_COMMISSION:${claimId}`);
        evidenceReferences.push(...bookingCommissionClaims(booking));
      }
    }
    
    // 5. Check persisted procurement references from bookings
    const allProcurementRefs = new Map<string, ProcurementReference>();
    for (const booking of bookings) for (const reference of bookingProcurementReferences(booking)) { const key = procurementKey(reference); if (key) allProcurementRefs.set(key, reference); }
    for (const ref of input.procurementReferences ?? []) {
      const key = ref.purchaseOrderId ?? ref.commitmentId!;
      allProcurementRefs.set(key, ref);
    }
    for (const reference of allProcurementRefs.values()) {
      const ownerBlockers = await this.procurement.blockers(input.companyId, reference);
      blockers.push(...ownerBlockers.map((item) => `PROCUREMENT:${item.type}:${item.purchaseOrderId}`));
      evidenceReferences.push(reference.purchaseOrderId ?? reference.commitmentId!);
    }
    
    // 6. Check unresolved workflows (from AC-12 owned data)
    const unresolvedWorkflows = workflows.filter((w) => w.status === 'RUNNING' || w.status === 'BLOCKED' || w.status === 'SETTLEMENT_REQUIRED');
    for (const workflow of unresolvedWorkflows) {
      blockers.push(`UNRESOLVED_WORKFLOW:${workflow.kind}:${workflow.id}`);
      evidenceReferences.push(workflow.id);
    }
    
    // 7. A cancelled booking is financially settled only when its own cancellation workflow completed.
    // Program cancellation history is not required for an individually cancelled booking.
    for (const booking of bookings) {
      if (booking.status !== 'CANCELLED') continue;
      const cancellationWorkflows = await this.repo.workflowsForBooking(input.companyId, booking.booking);
      const completedCancellation = cancellationWorkflows.find((workflow) =>
        workflow.kind === 'BOOKING_CANCELLATION' &&
        workflow.status === 'COMPLETED' &&
        Boolean((workflow.result as { cancelled?: boolean } | undefined)?.cancelled),
      );
      if (completedCancellation) {
        evidenceReferences.push(booking.id, completedCancellation.id);
        continue;
      }
      blockers.push(`BOOKING_CANCELLATION_INCOMPLETE:${booking.id}`);
      evidenceReferences.push(booking.id);
    }
    
    // 8. Check approval requestId from booking confirmation evidence (from Controls owned data)
    const approvalRequestIdsFromBookings = new Set<string>();
    for (const booking of bookings) if (booking.approvalRequestId) approvalRequestIdsFromBookings.add(booking.approvalRequestId);
    const allApprovalRequestIds = new Set([...approvalRequestIdsFromBookings, ...(input.approvalRequestIds ?? [])]);
    for (const requestId of allApprovalRequestIds) {
      if (!(await this.controls.approvalResolved(input.companyId, requestId))) blockers.push(`APPROVAL_UNRESOLVED:${requestId}`);
      else evidenceReferences.push(requestId);
    }
    
    return { ready: blockers.length === 0, blockers, warnings: [], evidenceReferences };
  }

  async evaluateBookingFinancialReadiness(input: { companyId: CompanyId; branchId?: string; booking: SourceReference; program: SourceReference; requiredCategories: readonly ServiceCategory[] }) {
    const blockers: string[] = [];
    const evidenceReferences: string[] = [refKey(input.program), refKey(input.booking)];
    const booking = await this.repo.booking(input.companyId, input.booking);
    if (!booking) return { ready: false, blockers: [`MISSING_BOOKING_FINANCIAL_REFERENCE:${input.booking.sourceId}`], warnings: [], evidenceReferences };
    if (refKey(booking.program) !== refKey(input.program)) {
      return { ready: false, blockers: [`BOOKING_PROGRAM_MISMATCH:${input.booking.sourceId}`], warnings: [], evidenceReferences };
    }
    if (input.branchId && booking.branchId !== input.branchId) {
      return { ready: false, blockers: ['BRANCH_SCOPE_MISMATCH'], warnings: [], evidenceReferences };
    }
    evidenceReferences.push(booking.id, booking.workflowId);
    if (booking.status !== 'ACTIVE') blockers.push(`BOOKING_FINANCIAL_STATE:${booking.status}`);

    for (const category of input.requiredCategories) {
      const setup = await this.repo.setup(input.companyId, category);
      if (!setup?.active) blockers.push(`MISSING_SETUP:${category}`);
      else evidenceReferences.push(setup.id);
    }

    try {
      const center = await this.cost.resolveProgram(input.companyId, input.program);
      evidenceReferences.push(center.costCenterId);
    } catch {
      blockers.push('MISSING_PROGRAM_COST_CENTER');
    }

    for (const allocation of booking.allocations) {
      const ownerBlockers = await this.inventory.blockers(input.companyId, allocation.id);
      blockers.push(...ownerBlockers.map((item) => `INVENTORY:${allocation.id}:${item.type}`));
      evidenceReferences.push(allocation.id);
    }

    for (const claimId of bookingCommissionClaims(booking)) {
      const commissionEvidence = await this.commission.evidence(input.companyId, claimId);
      if (commissionEvidence.hasPostedPaymentHistory) blockers.push(`PAID_COMMISSION:${claimId}`);
      evidenceReferences.push(...bookingCommissionClaims(booking));
    }

    for (const reference of bookingProcurementReferences(booking)) {
      const ownerBlockers = await this.procurement.blockers(input.companyId, reference);
      blockers.push(...ownerBlockers.map((item) => `PROCUREMENT:${item.type}:${item.purchaseOrderId}`));
      const referenceId = reference.purchaseOrderId ?? reference.commitmentId;
      if (referenceId) evidenceReferences.push(referenceId);
    }

    const workflows = await this.repo.workflowsForBooking(input.companyId, input.booking);
    for (const workflow of workflows.filter((item) => item.status === 'RUNNING' || item.status === 'BLOCKED' || item.status === 'SETTLEMENT_REQUIRED')) {
      blockers.push(`UNRESOLVED_WORKFLOW:${workflow.kind}:${workflow.id}`);
      evidenceReferences.push(workflow.id);
    }

    if (booking.approvalRequestId) {
      if (!(await this.controls.approvalResolved(input.companyId, booking.approvalRequestId))) blockers.push(`APPROVAL_UNRESOLVED:${booking.approvalRequestId}`);
      else evidenceReferences.push(booking.approvalRequestId);
    }

    return { ready: blockers.length === 0, blockers, warnings: [], evidenceReferences: [...new Set(evidenceReferences)] };
  }

  private snapshotCandidate(input: { id: string; companyId: CompanyId; service: SourceReference; category: ServiceCategory; currency: string; saleAmount: DecimalAmount; costAmount: DecimalAmount; evidence: unknown }, version: number, status: ServiceFinancialSnapshot['status'], supersedesId?: string): ServiceFinancialSnapshot { const normalized = { ...input, saleAmount: nonNegative(input.saleAmount, 'saleAmount'), costAmount: nonNegative(input.costAmount, 'costAmount') }; return { ...normalized, version, status, ...(supersedesId ? { supersedesId } : {}), requestHash: hash({ service: input.service, version, category: normalized.category, currency: normalized.currency, saleAmount: normalized.saleAmount, costAmount: normalized.costAmount, evidence: normalized.evidence, supersedesId: supersedesId ?? null }), createdAt: new Date().toISOString() }; }
  async confirmServiceFinancials(input: { id: string; companyId: CompanyId; service: SourceReference; category: ServiceCategory; currency: string; saleAmount: DecimalAmount; costAmount: DecimalAmount; evidence: unknown }) { const candidate = this.snapshotCandidate(input, 1, 'CONFIRMED'); const existing = await this.repo.latestSnapshot(input.companyId, input.service); if (existing) { if (existing.version !== 1 || existing.requestHash !== candidate.requestHash) throw new ContractValidationError('serviceFinancials', 'confirmed fields are immutable; use amendment'); return existing; } const reserved = await this.repo.reserveSnapshot(candidate); if (reserved.requestHash !== candidate.requestHash) throw new ContractValidationError('serviceFinancials', 'conflicting concurrent confirmation'); return reserved; }
  async amendServiceFinancials(input: { id: string; companyId: CompanyId; service: SourceReference; category: ServiceCategory; currency: string; saleAmount: DecimalAmount; costAmount: DecimalAmount; evidence: unknown }) { const old = await this.repo.latestSnapshot(input.companyId, input.service); if (!old) throw new ContractValidationError('service', 'no confirmed financial snapshot'); const candidate = this.snapshotCandidate(input, old.version + 1, 'AMENDED', old.id); const reserved = await this.repo.reserveSnapshot(candidate); if (reserved.requestHash !== candidate.requestHash || reserved.supersedesId !== old.id) throw new ContractValidationError('serviceFinancials', 'conflicting concurrent amendment'); return reserved; }
  async actualizeIssuance(input: { companyId: CompanyId; branchId?: string; commandKey: string; program: SourceReference; service: SourceReference; kind: 'TICKET' | 'VISA'; amount: DecimalAmount; postingDate: string; flightSegmentReference?: SourceReference; visaAllocationReference?: SourceReference }) { const evidence = input.kind === 'TICKET' ? input.flightSegmentReference : input.visaAllocationReference; if (!evidence) throw new ContractValidationError(input.kind === 'TICKET' ? 'flightSegmentReference' : 'visaAllocationReference', `real ${input.kind === 'TICKET' ? 'flight segment' : 'visa allocation'} required`); const amount = nonNegative(input.amount, 'amount'); const workflow = await this.workflow('MILESTONE_ACTUALIZATION', input, input.service, { ...input, amount }); if (workflow.status === 'COMPLETED') return workflow.result; const result = await this.effect(workflow, 'COST_ACTUALIZATION', () => this.cost.actualize({ id: `tfo-cost:${workflow.id}`, companyId: input.companyId, program: input.program, service: input.service, amount, postingDate: input.postingDate, evidence }), (value) => value.id); return (await this.complete(workflow, { workflowId: workflow.id, costEffectId: result.id })).result; }
}

function bookingCommissionClaims(booking:BookingReference):string[]{return [...new Set(booking.commissionClaimIds??(booking.commissionClaimId?[booking.commissionClaimId]:[]))];}

function bookingInvoices(booking:BookingReference){return booking.customerInvoices??(booking.invoiceId?[{invoiceId:booking.invoiceId,partyId:booking.customerPartyId}]:[]);}
