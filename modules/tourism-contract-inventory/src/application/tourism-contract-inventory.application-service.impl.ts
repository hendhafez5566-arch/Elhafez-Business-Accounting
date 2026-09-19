import { decimalAmount, type CompanyId } from '@elhafez/contracts';
import type { Allocation, ContractVersion, FlightBlock, FlightBlockConsumption, HotelInventory, StopSale, TourismContract, TransportCapacity, VisaQuota } from '../domain/inventory.js';
import type { TourismInventoryRepository } from '../infrastructure/inventory.repository.js';
import type { AdjustAllocationInput, AllocateCapacityInput, AllocationResult, AmendContractInput, AvailabilityResult, CheckAvailabilityInput, ConsumeFlightBlockInput, CostEffectPort, CreateFlightBlockInput, CreateHotelInventoryInput, CreateStopSaleInput, CreateTourismContractInput, CreateTransportCapacityInput, CreateVisaQuotaInput, IdempotencyCheckResult, InternalFirstFulfillmentInput, ProcurementPort, ReleaseAllocationInput, ReleaseResult, TourismContractInventoryApplicationService } from './inventory.application-service.js';
import { idempotencyHash } from './idempotency-hash.js';

const quantity=(value:unknown)=>{const result=decimalAmount(value);if(result.startsWith('-')||result==='0')throw new Error('quantity must be positive');return result};
export class TourismContractInventoryApplicationServiceImpl implements TourismContractInventoryApplicationService {
 constructor(private readonly repo:TourismInventoryRepository,private readonly cost:CostEffectPort,private readonly procurement:ProcurementPort){}
 createContract(i:CreateTourismContractInput,k?:string):Promise<TourismContract>{return this.repo.createContract(i,k,idempotencyHash(i))}
 amendContract(i:AmendContractInput,k?:string):Promise<ContractVersion>{return this.repo.amendContract(i,k,idempotencyHash(i))}
 getContract(c:CompanyId,id:string):Promise<TourismContract|null>{return this.repo.contract(c,id)}
 getContractVersions(c:CompanyId,id:string):Promise<ContractVersion[]>{return this.repo.versions(c,id)}
 createHotelInventory(i:CreateHotelInventoryInput,k?:string):Promise<HotelInventory>{quantity(i.contractedQuantity);return this.repo.createHotel(i,k,idempotencyHash(i))}
 createFlightBlock(i:CreateFlightBlockInput,k?:string):Promise<FlightBlock>{quantity(i.totalSeats);return this.repo.createFlight(i,k,idempotencyHash(i))}
 createTransportCapacity(i:CreateTransportCapacityInput,k?:string):Promise<TransportCapacity>{quantity(i.capacityUnits);return this.repo.createTransport(i,k,idempotencyHash(i))}
 createVisaQuota(i:CreateVisaQuotaInput,k?:string):Promise<VisaQuota>{quantity(i.quotaTotal);return this.repo.createVisa(i,k,idempotencyHash(i))}
 createStopSale(i:CreateStopSaleInput,k?:string):Promise<StopSale>{return this.repo.createStopSale(i,k,idempotencyHash(i))}
 checkAvailability(i:CheckAvailabilityInput):Promise<AvailabilityResult>{return this.repo.availability(i)}
 allocateCapacity(i:AllocateCapacityInput,k?:string):Promise<AllocationResult>{quantity(i.quantity);if(i.resourceType==='FLIGHT_BLOCK'&&!i.flightSegmentReference)throw new Error('real flight-segment evidence is required');return this.repo.allocate(i,k,idempotencyHash(i))}
 releaseAllocation(i:ReleaseAllocationInput,k?:string):Promise<ReleaseResult>{quantity(i.quantity);return this.repo.release(i,k,idempotencyHash(i))}
 async adjustAllocation(i:AdjustAllocationInput,k?:string):Promise<Allocation>{quantity(i.newQuantity);decimalAmount(i.costAmount);const r=await this.repo.adjust(i,k,idempotencyHash(i));if(!r.replayed)await this.cost.recordAllocationAdjustment({companyId:i.companyId,effectId:i.costEffectId,program:r.allocation.program,allocationId:r.allocation.id,previousQuantity:r.previousQuantity,newQuantity:r.allocation.quantity,costAmount:i.costAmount,postingDate:i.postingDate});return r.allocation}
 consumeFlightBlock(i:ConsumeFlightBlockInput,k?:string):Promise<FlightBlockConsumption>{quantity(i.seats);return this.repo.consumeFlight(i,k,idempotencyHash(i))}
 async fulfillWithInternalFirst(i:InternalFirstFulfillmentInput,k?:string):Promise<AllocationResult>{quantity(i.requiredQuantity);const r=await this.repo.internalFirst(i,k,idempotencyHash(i));if(r.procurementRequest&&!r.procurementRequest.externalReference){const ref=await this.procurement.requestResidual({companyId:i.companyId,requestId:r.procurementRequest.id,supplierId:i.supplierId,type:i.contractType,quantity:r.procurementRequest.residualQuantity,program:i.program,referenceData:i.referenceData});await this.repo.attachProcurementReference(i.companyId,r.procurementRequest.id,ref);return {...r,procurementRequest:{...r.procurementRequest,externalReference:ref}}}return r}
 async checkIdempotency(c:CompanyId,k:string):Promise<IdempotencyCheckResult>{const prior=await this.repo.idempotency(c,k);return prior?{exists:true,priorResult:prior.result}:{exists:false}}
}
