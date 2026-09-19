import type { CompanyId, DecimalAmount, SourceReference } from '@elhafez/contracts';
export type ServiceCategory='HOTEL'|'FLIGHT'|'TRANSPORT'|'VISA'|'OTHER';
export type WorkflowKind='BOOKING_CONFIRMATION'|'BOOKING_DEPOSIT'|'BOOKING_CANCELLATION'|'PROGRAM_CANCELLATION'|'PROGRAM_CLOSE'|'MILESTONE_ACTUALIZATION';
export type WorkflowStatus='RUNNING'|'BLOCKED'|'SETTLEMENT_REQUIRED'|'COMPLETED';
export interface Workflow {id:string;companyId:CompanyId;branchId?:string;kind:WorkflowKind;commandKey:string;payloadHash:string;sourceType:string;sourceId:string;status:WorkflowStatus;payload:unknown;result?:unknown;createdAt:string;updatedAt:string}
export interface WorkflowStep {id:string;companyId:CompanyId;workflowId:string;name:string;effectKey:string;status:'PENDING'|'COMPLETED';ownerReference?:string;result?:unknown;createdAt:string;completedAt?:string}
export interface FinancialSetup {id:string;companyId:CompanyId;category:ServiceCategory;customerPartyId:string;receivableAccountId:string;revenueAccountId:string;costAccountId:string;commissionExpenseAccountId?:string;commissionLiabilityAccountId?:string;active:boolean}
export interface BookingReference {id:string;companyId:CompanyId;branchId?:string;booking:SourceReference;program:SourceReference;invoiceId:string;allocationIds:string[];commissionClaimId?:string;workflowId:string}
export interface ServiceFinancialSnapshot {id:string;companyId:CompanyId;service:SourceReference;version:number;category:ServiceCategory;currency:string;saleAmount:DecimalAmount;costAmount:DecimalAmount;status:'CONFIRMED'|'AMENDED';supersedesId?:string;evidence:unknown;createdAt:string}
export interface ProgramHistory {id:string;companyId:CompanyId;program:SourceReference;kind:'CANCELLED'|'CLOSED';workflowId:string;evidence:unknown;createdAt:string}
export interface CancellationBlocker {type:'TRAVEL_STARTED'|'CUSTOMER_SETTLEMENT_REQUIRED'|'PAID_COMMISSION'|'INVENTORY'|'SUPPLIER_EXECUTION'|'SUPPLIER_INVOICE';reference:string;detail?:string}
