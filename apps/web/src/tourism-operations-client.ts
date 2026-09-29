import{crmGet,crmPatch,crmPost}from'./crm-core-client.js';
export type TourismProgramStatus='PREPARING'|'OPEN'|'OPERATING'|'CLOSED'|'CANCELLED';
export interface TourismProgram{readonly id:string;readonly code:string;readonly nameAr:string;readonly nameEn?:string;readonly departureDate:string;readonly returnDate:string;readonly salesOpen:string;readonly salesClose:string;readonly currency:string;readonly notes?:string;readonly status:TourismProgramStatus;readonly revision:number}
export interface TourismProgramInput{code:string;nameAr:string;nameEn?:string;departureDate:string;returnDate:string;salesOpen:string;salesClose:string;currency:string;notes?:string}
export interface ItineraryDay{id:string;programId:string;dayNumber:number;serviceDate:string;title:string;description?:string;location?:string;revision:number}
export type TourismBookingStatus='DRAFT'|'CONFIRMING'|'CONFIRMED'|'CANCELLING'|'CANCELLATION_REQUIRED'|'CANCELLED'|'COMPLETED';
export interface TourismBooking{id:string;code:string;programId:string;customerId:string;customerPartyId:string;travelerIds:readonly string[];status:TourismBookingStatus;pendingCommandKey?:string;revision:number;financialEvidence?:{workflowId:string;invoiceId?:string;allocationIds:readonly string[];commissionClaimId?:string}}
export interface TourismBookingConfirm{commandKey:string;category:'HOTEL'|'FLIGHT'|'TRANSPORT'|'VISA'|'OTHER';costCenterId:string;currency:string;grossAmount:string;discountAmount:string;postingDate:string;dueDate:string;invoiceNumber:string;inventories:{allocationId:string;contractId:string;resourceType:string;resourceId:string;serviceDate:string;quantity:string;periodEnd?:string}[];approvalRequestId?:string}
export interface TourismCustomerReference{customer:{id:string;partyId:string;number:string;status:string};party:{id:string;displayName:string}}
export interface TourismTravelerReference{id:string;fullName:string;partyId:string|null;customerId:string|null;status:string}
const enc=encodeURIComponent,base='/tourism';
export const tourismOperationsApi={
 programs:()=>crmGet<TourismProgram[]>(base+'/programs'),
 createProgram:(input:TourismProgramInput)=>crmPost<TourismProgram>(base+'/programs',input),
 updateProgram:(id:string,input:TourismProgramInput)=>crmPatch<TourismProgram>(base+'/programs/'+enc(id),input),
 openProgram:(id:string)=>crmPost<TourismProgram>(base+'/programs/'+enc(id)+'/open',{}),
 startProgram:(id:string)=>crmPost<TourismProgram>(base+'/programs/'+enc(id)+'/start',{}),
 closeProgram:(id:string)=>crmPost<TourismProgram>(base+'/programs/'+enc(id)+'/close',{}),
 cancelProgram:(id:string,input:{reason:string;commandKey:string;postingDate:string})=>crmPost<TourismProgram>(base+'/programs/'+enc(id)+'/cancel',input),
 itinerary:(programId:string)=>crmGet<ItineraryDay[]>(base+'/programs/'+enc(programId)+'/itinerary'),
 createItinerary:(programId:string,input:Omit<ItineraryDay,'id'|'programId'|'revision'>)=>crmPost<ItineraryDay>(base+'/programs/'+enc(programId)+'/itinerary',input),
 updateItinerary:(programId:string,id:string,input:Omit<ItineraryDay,'id'|'programId'|'revision'>&{expectedRevision:number})=>crmPatch<ItineraryDay>(base+'/programs/'+enc(programId)+'/itinerary/'+enc(id),input),
 bookings:()=>crmGet<TourismBooking[]>(base+'/bookings'),
 customers:()=>crmGet<TourismCustomerReference[]>('/crm/customers?status=ACTIVE'),
 travelers:()=>crmGet<TourismTravelerReference[]>('/crm/travelers?status=ACTIVE'),
 createBooking:(input:{code:string;programId:string;customerId:string;travelerIds:string[]})=>crmPost<TourismBooking>(base+'/bookings',input),
 confirmBooking:(id:string,input:TourismBookingConfirm)=>crmPost<TourismBooking>(base+'/bookings/'+enc(id)+'/confirm',input),
 cancelBooking:(id:string,input:{commandKey:string;postingDate:string})=>crmPost<TourismBooking>(base+'/bookings/'+enc(id)+'/cancel',input),
 completeBooking:(id:string)=>crmPost<TourismBooking>(base+'/bookings/'+enc(id)+'/complete',{}),
};
