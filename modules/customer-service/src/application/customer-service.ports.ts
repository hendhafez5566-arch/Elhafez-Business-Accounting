import type{ExecutionContext}from'@elhafez/contracts';
export const CUSTOMER_SERVICE_ACCESS=Symbol('CUSTOMER_SERVICE_ACCESS'),CUSTOMER_SERVICE_CUSTOMERS=Symbol('CUSTOMER_SERVICE_CUSTOMERS');
export interface CustomerServiceAccess{requireBranch(c:ExecutionContext):Promise<void>;requirePermission(c:ExecutionContext,permission:string):Promise<void>;audit(c:ExecutionContext,action:string,entityId:string,metadata?:Record<string,unknown>):Promise<void>}
export interface CustomerServiceCustomerPort{requireActive(c:ExecutionContext,customerId:string):Promise<void>}
