import type { PrismaClient } from '@prisma/client';
import type { CompanyId } from '@elhafez/contracts';
import type { SourceReference } from '@elhafez/contracts';

export interface TourismContractReference {
  readonly id:string;
  readonly type:string;
  readonly status:string;
  readonly supplierId:string|null;
  readonly effectiveFrom:string;
  readonly effectiveTo:string;
}
export interface TourismAllocationReference {
  readonly id:string;
  readonly contractId:string;
  readonly resourceType:string;
  readonly resourceId:string;
  readonly programSourceType:string;
  readonly programSourceId:string;
  readonly serviceDate:string;
  readonly periodEnd:string|null;
  readonly quantity:string;
  readonly status:string;
}

export class TourismInventoryReferenceQuery {
  constructor(private readonly db:PrismaClient){}
  async contracts(companyId:CompanyId):Promise<TourismContractReference[]>{
    const rows=await this.db.tciContract.findMany({where:{companyId},orderBy:[{effectiveFrom:'desc'},{createdAt:'desc'}]});
    return rows.map(row=>({id:row.id,type:row.type,status:row.status,supplierId:row.supplierId??null,effectiveFrom:row.effectiveFrom.toISOString().slice(0,10),effectiveTo:row.effectiveTo.toISOString().slice(0,10)}));
  }
  async allocations(companyId:CompanyId):Promise<TourismAllocationReference[]>{
    const rows=await this.db.tciAllocation.findMany({where:{companyId},orderBy:{createdAt:'desc'}});
    return rows.map(row=>{const program=row.program as unknown as SourceReference;return{id:row.id,contractId:row.contractId,resourceType:row.resourceType,resourceId:row.resourceId,programSourceType:program.sourceType,programSourceId:program.sourceId,serviceDate:row.serviceDate.toISOString().slice(0,10),periodEnd:row.periodEnd?.toISOString().slice(0,10)??null,quantity:String(row.quantity),status:row.status};});
  }
}
