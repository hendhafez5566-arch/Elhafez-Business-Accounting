import{crmGet,crmPost}from'./crm-core-client.js';
export type ContractType='HOTEL'|'FLIGHT_BLOCK'|'TRANSPORT'|'VISA'|'SERVICE';
export interface TourismInventoryCapabilities{view:boolean;manage:boolean}
export interface ContractRow{id:string;type:ContractType;status:string;supplierId?:string;effectiveFrom:string;effectiveTo:string;createdAt:string}
export interface HotelStock{id:string;contractId:string;hotelId:string;roomId?:string;serviceDate:string;contractedQuantity:string;allocatedQuantity:string;availableQuantity:string;status:string}
export interface FlightStock{id:string;contractId:string;flightNumber:string;origin:string;destination:string;departureDate:string;totalSeats:string;consumedSeats:string;availableSeats:string}
export interface TransportStock{id:string;contractId:string;vehicleId:string;capacityUnits:string;periodStart:string;periodEnd:string;consumedUnits:string}
export interface VisaStock{id:string;contractId:string;visaType:string;nationality?:string;quotaTotal:string;quotaConsumed:string;quotaRemaining:string;effectiveFrom:string;effectiveTo:string}
export interface ServiceStock{id:string;contractId:string;category:string;name:string;unit:string;serviceStart:string;serviceEnd:string;capacity:string;allocatedQuantity:string;availableQuantity:string;status:string}
export interface StopSaleRow{id:string;contractId:string;reason:string;effectiveFrom:string;effectiveTo:string;isActive:boolean}
export interface AllocationRow{id:string;contractId:string;resourceType:string;resourceId:string;serviceDate:string;periodEnd?:string;quantity:string;status:string}
export interface TourismInventoryOverview{contracts:ContractRow[];hotels:HotelStock[];flights:FlightStock[];transport:TransportStock[];visas:VisaStock[];services:ServiceStock[];stopSales:StopSaleRow[];allocations:AllocationRow[]}
const base='/tourism/inventory',enc=encodeURIComponent;
export const tourismInventoryApi={
 capabilities:()=>crmGet<TourismInventoryCapabilities>(base+'/capabilities'),
 overview:(contractId?:string)=>crmGet<TourismInventoryOverview>(base+(contractId?'?contractId='+enc(contractId):'')),
 createContract:(x:{type:ContractType;supplierId?:string;effectiveFrom:string;effectiveTo:string})=>crmPost(base+'/contracts',x),
 amendContract:(id:string,x:{terms:Record<string,unknown>;effectiveFrom:string;effectiveTo?:string})=>crmPost(base+'/contracts/'+enc(id)+'/amend',x),
 createHotel:(x:{contractId:string;hotelId:string;roomId?:string;serviceDate:string;contractedQuantity:string})=>crmPost(base+'/hotels',x),
 createFlight:(x:{contractId:string;flightNumber:string;origin:string;destination:string;departureDate:string;totalSeats:string})=>crmPost(base+'/flights',x),
 createTransport:(x:{contractId:string;vehicleId:string;capacityUnits:string;periodStart:string;periodEnd:string})=>crmPost(base+'/transport',x),
 createVisa:(x:{contractId:string;visaType:string;nationality?:string;quotaTotal:string;effectiveFrom:string;effectiveTo:string})=>crmPost(base+'/visas',x),
 createService:(x:{contractId:string;category:'CAMP'|'MEAL'|'VISIT'|'GUIDE'|'RAWDA'|'INSURANCE'|'OTHER';name:string;description?:string;unit:string;serviceStart:string;serviceEnd:string;capacity:string;releaseDeadline?:string})=>crmPost(base+'/services',x),
 createStopSale:(x:{contractId:string;reason:string;effectiveFrom:string;effectiveTo:string})=>crmPost(base+'/stop-sales',x),
 releaseAllocation:(id:string,quantity:string)=>crmPost(base+'/allocations/'+enc(id)+'/release',{quantity}),
};
