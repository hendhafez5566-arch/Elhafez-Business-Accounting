import type{CompanyId}from'@elhafez/contracts';import type{ItineraryDay,ItineraryHistory}from'../domain/itinerary.js';
export interface ItineraryRepository{create(value:ItineraryDay,history:ItineraryHistory):Promise<ItineraryDay>;save(value:ItineraryDay,history:ItineraryHistory):Promise<ItineraryDay>;get(companyId:CompanyId,branchId:string,id:string):Promise<ItineraryDay|null>;list(companyId:CompanyId,branchId:string,programId:string):Promise<ItineraryDay[]>}
export const ITINERARY_REPOSITORY=Symbol('ITINERARY_REPOSITORY');
