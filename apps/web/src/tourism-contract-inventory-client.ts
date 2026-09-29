import { crmGet, crmPost } from './crm-core-client.js';

const base='/tourism/contracts-inventory';
const enc=encodeURIComponent;
export type InventoryResult=Record<string,unknown>;
export interface TourismInventorySupplierReference{supplier:{id:string;supplierCode:string;status:string;approvalStatus:string};party:{id:string;displayName:string}}
export interface TourismInventoryProgramReference{id:string;code:string;nameAr:string;status:string}

export const tourismContractInventoryApi={
 suppliers:()=>crmGet<TourismInventorySupplierReference[]>('/suppliers'),
 programs:()=>crmGet<TourismInventoryProgramReference[]>('/tourism/programs'),
 createContract:(input:{type:'HOTEL'|'FLIGHT_BLOCK'|'TRANSPORT'|'VISA'|'SERVICE';supplierId?:string;effectiveFrom:string;effectiveTo:string;commandKey?:string})=>crmPost<InventoryResult>(base+'/contracts',input),
 contract:(id:string)=>crmGet<InventoryResult|null>(base+'/contracts/'+enc(id)),
 versions:(id:string)=>crmGet<InventoryResult[]>(base+'/contracts/'+enc(id)+'/versions'),
 createHotel:(input:{contractId:string;hotelId:string;roomId?:string;serviceDate:string;contractedQuantity:string;commandKey?:string})=>crmPost<InventoryResult>(base+'/hotel-inventory',input),
 createFlight:(input:{contractId:string;flightNumber:string;origin:string;destination:string;departureDate:string;totalSeats:string;commandKey?:string})=>crmPost<InventoryResult>(base+'/flight-blocks',input),
 createTransport:(input:{contractId:string;vehicleId:string;capacityUnits:string;periodStart:string;periodEnd:string;commandKey?:string})=>crmPost<InventoryResult>(base+'/transport-capacity',input),
 createVisa:(input:{contractId:string;visaType:string;nationality?:string;quotaTotal:string;effectiveFrom:string;effectiveTo:string;commandKey?:string})=>crmPost<InventoryResult>(base+'/visa-quotas',input),
 stopSale:(input:{contractId:string;reason:string;effectiveFrom:string;effectiveTo:string;commandKey?:string})=>crmPost<InventoryResult>(base+'/stop-sales',input),
 availability:(input:{contractId:string;resourceType:'HOTEL'|'FLIGHT_BLOCK'|'TRANSPORT'|'VISA'|'SERVICE';resourceId:string;serviceDate:string;periodEnd?:string})=>crmPost<InventoryResult>(base+'/availability',input),
 allocate:(input:{contractId:string;resourceType:'HOTEL'|'FLIGHT_BLOCK'|'TRANSPORT'|'VISA'|'SERVICE';resourceId:string;program:{sourceType:string;sourceId:string};serviceDate:string;periodEnd?:string;quantity:string;commandKey?:string})=>crmPost<InventoryResult>(base+'/allocations',input),
 allocation:(id:string)=>crmGet<InventoryResult|null>(base+'/allocations/'+enc(id)),
 release:(id:string,input:{quantity:string;commandKey?:string})=>crmPost<InventoryResult>(base+'/allocations/'+enc(id)+'/release',input),
 amendContract:(id:string,input:{terms:Record<string,unknown>;effectiveFrom:string;effectiveTo:string;commandKey?:string})=>crmPost<InventoryResult>(base+'/contracts/'+enc(id)+'/amendments',input),
 createService:(input:{contractId:string;category:'CAMP'|'MEAL'|'VISIT'|'GUIDE'|'RAWDA'|'INSURANCE'|'OTHER';name:string;description?:string;unit:string;serviceStart:string;serviceEnd:string;capacity:string;releaseDeadline?:string;commandKey?:string})=>crmPost<InventoryResult>(base+'/service-inventory',input),
};
