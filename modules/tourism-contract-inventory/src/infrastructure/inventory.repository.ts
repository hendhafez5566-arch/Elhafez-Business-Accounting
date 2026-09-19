import type { CompanyId, DecimalAmount } from '@elhafez/contracts';
import type { Allocation, ContractVersion, FlightBlock, FlightBlockConsumption, HotelInventory, StopSale, TourismContract, TransportCapacity, VisaQuota } from '../domain/inventory.js';
import type { AdjustAllocationInput, AllocateCapacityInput, AllocationResult, AmendContractInput, AvailabilityResult, CheckAvailabilityInput, ConsumeFlightBlockInput, CreateFlightBlockInput, CreateHotelInventoryInput, CreateStopSaleInput, CreateTourismContractInput, CreateTransportCapacityInput, CreateVisaQuotaInput, InternalFirstFulfillmentInput, ReleaseAllocationInput, ReleaseResult } from '../application/inventory.application-service.js';

/** Module-owned persistence boundary. Every command is one serializable transaction. */
export interface TourismInventoryRepository {
 createContract(input:CreateTourismContractInput,key:string|undefined,hash:string):Promise<TourismContract>;
 amendContract(input:AmendContractInput,key:string|undefined,hash:string):Promise<ContractVersion>;
 contract(companyId:CompanyId,id:string):Promise<TourismContract|null>;
 versions(companyId:CompanyId,id:string):Promise<ContractVersion[]>;
 createHotel(input:CreateHotelInventoryInput,key:string|undefined,hash:string):Promise<HotelInventory>;
 createFlight(input:CreateFlightBlockInput,key:string|undefined,hash:string):Promise<FlightBlock>;
 createTransport(input:CreateTransportCapacityInput,key:string|undefined,hash:string):Promise<TransportCapacity>;
 createVisa(input:CreateVisaQuotaInput,key:string|undefined,hash:string):Promise<VisaQuota>;
 createStopSale(input:CreateStopSaleInput,key:string|undefined,hash:string):Promise<StopSale>;
 availability(input:CheckAvailabilityInput):Promise<AvailabilityResult>;
 allocate(input:AllocateCapacityInput,key:string|undefined,hash:string):Promise<AllocationResult>;
 release(input:ReleaseAllocationInput,key:string|undefined,hash:string):Promise<ReleaseResult>;
 adjust(input:AdjustAllocationInput,key:string|undefined,hash:string):Promise<{allocation:Allocation;previousQuantity:DecimalAmount;replayed:boolean}>;
 consumeFlight(input:ConsumeFlightBlockInput,key:string|undefined,hash:string):Promise<FlightBlockConsumption>;
 internalFirst(input:InternalFirstFulfillmentInput,key:string|undefined,hash:string):Promise<AllocationResult>;
 attachProcurementReference(companyId:CompanyId,requestId:string,externalReference:string):Promise<void>;
 idempotency(companyId:CompanyId,key:string):Promise<{requestHash:string;result:Record<string,unknown>}|null>;
}

export const TOURISM_INVENTORY_REPOSITORY=Symbol('TOURISM_INVENTORY_REPOSITORY');
