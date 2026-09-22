import type{ExecutionContext}from'@elhafez/contracts';import type{Booking}from'@elhafez/hajj-umrah-bookings';import type{Traveler}from'@elhafez/traveler-management';import type{Allocation}from'@elhafez/tourism-contract-inventory';
export interface TicketAccess{requireBranch(c:ExecutionContext):Promise<void>;requirePermission(c:ExecutionContext,p:string):Promise<void>;audit(c:ExecutionContext,a:string,id:string,m?:Record<string,unknown>):Promise<void>;}
export interface TicketBookingPort{requireTraveler(c:ExecutionContext,b:string,t:string):Promise<Booking>;}
export interface TicketTravelerPort{requireActive(c:ExecutionContext,id:string):Promise<Traveler>;}
export interface TicketInventoryPort{allocation(c:string,id:string):Promise<Allocation|null>;}
export interface TicketFinancePort{actualize(i:{companyId:string;branchId:string;commandKey:string;programId:string;ticketId:string;amount:string;postingDate:string;flightBlockId:string}):Promise<unknown>;}
export const TICKET_ACCESS=Symbol('TICKET_ACCESS'),TICKET_BOOKING_PORT=Symbol('TICKET_BOOKING_PORT'),TICKET_TRAVELER_PORT=Symbol('TICKET_TRAVELER_PORT'),TICKET_INVENTORY_PORT=Symbol('TICKET_INVENTORY_PORT'),TICKET_FINANCE_PORT=Symbol('TICKET_FINANCE_PORT');
