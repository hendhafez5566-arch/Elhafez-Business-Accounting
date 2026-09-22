import type { ExecutionContext, SourceReference } from '@elhafez/contracts';
import type { Program } from '@elhafez/hajj-umrah-programs';
import type { Traveler } from '@elhafez/traveler-management';
import type { Customer } from '@elhafez/customer-management';
import type { Agent } from '@elhafez/agent-management';

export interface BookingAccess {
  requireBranch(context: ExecutionContext): Promise<void>;
  requirePermission(context: ExecutionContext, permission: string): Promise<void>;
  audit(context: ExecutionContext, action: string, id: string, metadata?: Record<string, unknown>): Promise<void>;
}
export interface BookingProgramPort { require(context: ExecutionContext, id: string): Promise<Program>; }
export interface BookingTravelerPort { requireActive(context: ExecutionContext, id: string): Promise<Traveler>; }
export interface BookingCustomerPort { requireActive(context: ExecutionContext, id: string): Promise<Customer>; register(context: ExecutionContext, id: string, bookingId: string): Promise<void>; }
export interface BookingAgentPort { requireActive(context: ExecutionContext, id: string): Promise<Agent>; register(context: ExecutionContext, id: string, bookingId: string): Promise<void>; }

export interface BookingFinanceInventoryRequest {
  readonly allocationId: string;
  readonly contractId: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly serviceDate: string;
  readonly quantity: string;
  readonly periodEnd?: string;
  readonly flightSegmentReference?: SourceReference;
  readonly visaBatchReference?: SourceReference;
}
export interface BookingFinancePort {
  confirm(input: {
    companyId: string; branchId: string; commandKey: string; bookingId: string; programId: string;
    programEvidence: string; category: 'HOTEL'|'FLIGHT'|'TRANSPORT'|'VISA'|'OTHER';
    costCenterId: string; customerPartyId: string; currency: string; grossAmount: string; discountAmount: string;
    approvalRequestId?: string; postingDate: string; dueDate: string; invoiceNumber: string;
    inventories: readonly BookingFinanceInventoryRequest[];
    commission?: { agentPartyId: string; amount: string };
  }): Promise<unknown>;
  cancel(input: {
    companyId: string; branchId: string; commandKey: string; bookingId: string;
    travelStarted: boolean; travelEvidence: string; postingDate: string;
  }): Promise<unknown>;
}

export const BOOKING_ACCESS = Symbol('BOOKING_ACCESS');
export const BOOKING_PROGRAM_PORT = Symbol('BOOKING_PROGRAM_PORT');
export const BOOKING_TRAVELER_PORT = Symbol('BOOKING_TRAVELER_PORT');
export const BOOKING_CUSTOMER_PORT = Symbol('BOOKING_CUSTOMER_PORT');
export const BOOKING_AGENT_PORT = Symbol('BOOKING_AGENT_PORT');
export const BOOKING_FINANCE_PORT = Symbol('BOOKING_FINANCE_PORT');
