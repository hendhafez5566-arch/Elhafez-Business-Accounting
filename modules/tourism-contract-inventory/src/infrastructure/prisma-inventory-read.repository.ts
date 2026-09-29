import type{PrismaClient}from'@prisma/client';import type{CompanyId}from'@elhafez/contracts';import type{ContractStatus,ContractType}from'../domain/inventory.js';import type{TourismInventoryContractOption,TourismInventoryReadRepository,TourismInventoryResourceOption}from'../application/inventory-read.repository.js';
const day=(value:Date)=>value.toISOString().slice(0,10);
export class PrismaTourismInventoryReadRepository implements TourismInventoryReadRepository{
 constructor(private readonly db:PrismaClient){}
 async listAvailable(companyId:CompanyId):Promise<readonly TourismInventoryContractOption[]>{
  const contracts=await this.db.tciContract.findMany({where:{companyId,status:{in:['ACTIVE','AMENDED']}},orderBy:[{type:'asc'},{effectiveFrom:'asc'}]});
  if(!contracts.length)return[];
  const ids=contracts.map(row=>row.id);
  const[hotels,flights,transport,visas,services]=await Promise.all([
   this.db.tciHotelInventory.findMany({where:{companyId,contractId:{in:ids}},orderBy:{serviceDate:'asc'}}),
   this.db.tciFlightBlock.findMany({where:{companyId,contractId:{in:ids}},orderBy:{departureDate:'asc'}}),
   this.db.tciTransportCapacity.findMany({where:{companyId,contractId:{in:ids}},orderBy:{periodStart:'asc'}}),
   this.db.tciVisaQuota.findMany({where:{companyId,contractId:{in:ids}},orderBy:{effectiveFrom:'asc'}}),
   this.db.tciServiceInventory.findMany({where:{companyId,contractId:{in:ids}},orderBy:{serviceStart:'asc'}}),
  ]);
  const resources=new Map<string,TourismInventoryResourceOption[]>();
  const add=(value:TourismInventoryResourceOption)=>{const rows=resources.get(value.contractId)??[];rows.push(value);resources.set(value.contractId,rows)};
  for(const row of hotels)add({id:row.id,contractId:row.contractId,resourceType:'HOTEL',label:`${row.hotelId}${row.roomId?` / ${row.roomId}`:''}`,serviceDate:day(row.serviceDate),availableQuantity:row.availableQuantity.toString(),status:row.status});
  for(const row of flights)add({id:row.id,contractId:row.contractId,resourceType:'FLIGHT_BLOCK',label:`${row.flightNumber} ${row.origin} → ${row.destination}`,serviceDate:day(row.departureDate),availableQuantity:row.availableSeats.toString(),status:'ACTIVE'});
  for(const row of transport)add({id:row.id,contractId:row.contractId,resourceType:'TRANSPORT',label:row.vehicleId,serviceDate:day(row.periodStart),periodEnd:day(row.periodEnd),availableQuantity:row.capacityUnits.sub(row.consumedUnits).toString(),status:'ACTIVE'});
  for(const row of visas)add({id:row.id,contractId:row.contractId,resourceType:'VISA',label:`${row.visaType}${row.nationality?` — ${row.nationality}`:''}`,serviceDate:day(row.effectiveFrom),periodEnd:day(row.effectiveTo),availableQuantity:row.quotaRemaining.toString(),status:'ACTIVE'});
  for(const row of services)add({id:row.id,contractId:row.contractId,resourceType:'SERVICE',label:`${row.category} — ${row.name}`,serviceDate:day(row.serviceStart),periodEnd:day(row.serviceEnd),availableQuantity:row.availableQuantity.toString(),status:row.status});
  return contracts.map(row=>({id:row.id,type:row.type as ContractType,status:row.status as ContractStatus,...(row.supplierId?{supplierId:row.supplierId}:{}),effectiveFrom:day(row.effectiveFrom),effectiveTo:day(row.effectiveTo),resources:resources.get(row.id)??[]}));
 }
}
