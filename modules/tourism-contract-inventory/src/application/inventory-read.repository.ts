import type{CompanyId}from'@elhafez/contracts';import type{ContractStatus,ContractType}from'../domain/inventory.js';
export interface TourismInventoryResourceOption{readonly id:string;readonly contractId:string;readonly resourceType:ContractType;readonly label:string;readonly serviceDate:string;readonly periodEnd?:string;readonly availableQuantity:string;readonly status:string}
export interface TourismInventoryContractOption{readonly id:string;readonly type:ContractType;readonly status:ContractStatus;readonly supplierId?:string;readonly effectiveFrom:string;readonly effectiveTo:string;readonly resources:readonly TourismInventoryResourceOption[]}
export interface TourismInventoryReadRepository{listAvailable(companyId:CompanyId):Promise<readonly TourismInventoryContractOption[]>}
export const TOURISM_INVENTORY_READ_REPOSITORY=Symbol('TOURISM_INVENTORY_READ_REPOSITORY');
