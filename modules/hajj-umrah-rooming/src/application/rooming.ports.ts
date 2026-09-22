import type{ExecutionContext}from'@elhafez/contracts';
import type{Booking}from'@elhafez/hajj-umrah-bookings';
import type{Program}from'@elhafez/hajj-umrah-programs';
import type{Traveler}from'@elhafez/traveler-management';
import type{Allocation}from'@elhafez/tourism-contract-inventory';
export interface RoomingAccess{requireBranch(c:ExecutionContext):Promise<void>;requirePermission(c:ExecutionContext,p:string):Promise<void>;audit(c:ExecutionContext,a:string,id:string,m?:Record<string,unknown>):Promise<void>;}
export interface RoomingBookingPort{requireTraveler(c:ExecutionContext,bookingId:string,travelerId:string):Promise<Booking>;}
export interface RoomingProgramPort{require(c:ExecutionContext,id:string):Promise<Program>;}
export interface RoomingTravelerPort{requireActive(c:ExecutionContext,id:string):Promise<Traveler>;}
export interface RoomingInventoryPort{allocation(companyId:string,id:string):Promise<Allocation|null>;}
export const ROOMING_ACCESS=Symbol('ROOMING_ACCESS'),ROOMING_BOOKING_PORT=Symbol('ROOMING_BOOKING_PORT'),ROOMING_PROGRAM_PORT=Symbol('ROOMING_PROGRAM_PORT'),ROOMING_TRAVELER_PORT=Symbol('ROOMING_TRAVELER_PORT'),ROOMING_INVENTORY_PORT=Symbol('ROOMING_INVENTORY_PORT');
