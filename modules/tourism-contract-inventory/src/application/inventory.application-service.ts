import type { CompanyId, DecimalAmount, SourceReference } from '@elhafez/contracts';
import type { Allocation, ContractType, ContractVersion, FlightBlock, FlightBlockConsumption, HotelInventory, ProcurementRequest, StopSale, TourismContract, TransportCapacity, VisaQuota } from '../domain/inventory.js';

interface Base { readonly companyId:CompanyId; readonly sourceReference?:SourceReference }
export interface CreateTourismContractInput extends Base { readonly type:ContractType; readonly supplierId?:string; readonly effectiveFrom:string; readonly effectiveTo:string }
export interface AmendContractInput extends Base { readonly contractId:string; readonly terms:Record<string,unknown>; readonly effectiveFrom:string; readonly effectiveTo?:string }
export interface CreateHotelInventoryInput extends Base { readonly contractId:string; readonly hotelId:string; readonly roomId?:string; readonly serviceDate:string; readonly contractedQuantity:DecimalAmount }
export interface CreateFlightBlockInput extends Base { readonly contractId:string; readonly flightNumber:string; readonly origin:string; readonly destination:string; readonly departureDate:string; readonly totalSeats:DecimalAmount }
export interface CreateTransportCapacityInput extends Base { readonly contractId:string; readonly vehicleId:string; readonly capacityUnits:DecimalAmount; readonly periodStart:string; readonly periodEnd:string }
export interface CreateVisaQuotaInput extends Base { readonly contractId:string; readonly visaType:string; readonly nationality?:string; readonly quotaTotal:DecimalAmount; readonly effectiveFrom:string; readonly effectiveTo:string }
export interface CreateStopSaleInput extends Base { readonly contractId:string; readonly reason:string; readonly effectiveFrom:string; readonly effectiveTo:string }
export interface AllocateCapacityInput extends Base { readonly contractId:string; readonly resourceType:ContractType; readonly resourceId:string; readonly program:SourceReference; readonly serviceDate:string; readonly periodEnd?:string; readonly quantity:DecimalAmount; readonly flightSegmentReference?:SourceReference; readonly visaBatchReference?:SourceReference }
export interface ReleaseAllocationInput extends Base { readonly allocationId:string; readonly quantity:DecimalAmount; readonly downstreamEvidence?:SourceReference }
export interface AdjustAllocationInput extends Base { readonly allocationId:string; readonly newQuantity:DecimalAmount; readonly costEffectId:string; readonly costAmount:DecimalAmount; readonly postingDate:string }
export interface ConsumeFlightBlockInput extends Base { readonly flightBlockId:string; readonly program:SourceReference; readonly seats:DecimalAmount; readonly flightSegmentReference:SourceReference }
export interface InternalFirstFulfillmentInput extends Base { readonly program:SourceReference; readonly contractType:ContractType; readonly resourceId:string; readonly serviceDate:string; readonly periodEnd?:string; readonly requiredQuantity:DecimalAmount; readonly referenceData:Record<string,unknown>; readonly supplierId:string }
export interface CheckAvailabilityInput { readonly companyId:CompanyId; readonly contractId:string; readonly resourceType:ContractType; readonly resourceId:string; readonly serviceDate:string; readonly periodEnd?:string }
export interface AvailabilityResult { readonly available:boolean; readonly availableQuantity:DecimalAmount; readonly blockerReason?:string }
export interface AllocationResult { readonly allocation?:Allocation; readonly procurementRequest?:ProcurementRequest }
export interface ReleaseResult { readonly success:boolean; readonly blockerEvidence?:string; readonly releasedQuantity:DecimalAmount }
export interface IdempotencyCheckResult { readonly exists:boolean; readonly priorResult?:Record<string,unknown> }

export interface CostEffectPort { recordAllocationAdjustment(input:{companyId:CompanyId; effectId:string; program:SourceReference; allocationId:string; previousQuantity:DecimalAmount; newQuantity:DecimalAmount; costAmount:DecimalAmount; postingDate:string}):Promise<void> }
export interface ProcurementPort { requestResidual(input:{companyId:CompanyId; requestId:string; supplierId:string; type:ContractType; quantity:DecimalAmount; program:SourceReference; referenceData:Record<string,unknown>}):Promise<string> }
export interface TourismContractInventoryApplicationService {
 createContract(input:CreateTourismContractInput,key?:string):Promise<TourismContract>; amendContract(input:AmendContractInput,key?:string):Promise<ContractVersion>; getContract(companyId:CompanyId,id:string):Promise<TourismContract|null>; getContractVersions(companyId:CompanyId,id:string):Promise<ContractVersion[]>;
 createHotelInventory(input:CreateHotelInventoryInput,key?:string):Promise<HotelInventory>; createFlightBlock(input:CreateFlightBlockInput,key?:string):Promise<FlightBlock>; createTransportCapacity(input:CreateTransportCapacityInput,key?:string):Promise<TransportCapacity>; createVisaQuota(input:CreateVisaQuotaInput,key?:string):Promise<VisaQuota>; createStopSale(input:CreateStopSaleInput,key?:string):Promise<StopSale>;
 checkAvailability(input:CheckAvailabilityInput):Promise<AvailabilityResult>; allocateCapacity(input:AllocateCapacityInput,key?:string):Promise<AllocationResult>; releaseAllocation(input:ReleaseAllocationInput,key?:string):Promise<ReleaseResult>; adjustAllocation(input:AdjustAllocationInput,key?:string):Promise<Allocation>; consumeFlightBlock(input:ConsumeFlightBlockInput,key?:string):Promise<FlightBlockConsumption>; fulfillWithInternalFirst(input:InternalFirstFulfillmentInput,key?:string):Promise<AllocationResult>; checkIdempotency(companyId:CompanyId,key:string):Promise<IdempotencyCheckResult>;
}
