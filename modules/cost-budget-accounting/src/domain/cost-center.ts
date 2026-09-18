import { ContractValidationError, type CompanyId, type SourceReference } from '@elhafez/contracts';
declare const costCenterIdBrand: unique symbol; export type CostCenterId=string&{readonly[costCenterIdBrand]:'CostCenterId'};
export interface CostCenter { readonly id:CostCenterId; readonly companyId:CompanyId; readonly code:string; readonly name:string; readonly status:'ACTIVE'|'INACTIVE'; readonly parentId?:CostCenterId }
export interface ProgramCostCenterAssociation { readonly companyId:CompanyId; readonly program:SourceReference; readonly costCenterId:CostCenterId }
export function costCenterId(value:string):CostCenterId {if(!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,126}[A-Za-z0-9]$|^[A-Za-z0-9]$/.test(value))throw new ContractValidationError('costCenterId','invalid stable identifier');return value as CostCenterId;}
export function createCostCenter(input:CostCenter):Readonly<CostCenter>{if(!/^[A-Z0-9][A-Z0-9_-]{0,31}$/.test(input.code))throw new ContractValidationError('code','must be uppercase and stable');if(!input.name.trim())throw new ContractValidationError('name','is required');return Object.freeze({...input,id:costCenterId(input.id),code:input.code});}
