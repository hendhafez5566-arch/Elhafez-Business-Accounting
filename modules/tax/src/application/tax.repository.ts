import type {CompanyId} from '@elhafez/contracts'; import type {TaxPolicy,TaxSnapshot} from '../domain/tax.js';
export const TAX_REPOSITORY=Symbol('TAX_REPOSITORY');
export interface TaxRepository { savePolicy(v:TaxPolicy):Promise<void>; policies(companyId:CompanyId,code:string):Promise<TaxPolicy[]>; saveSnapshot(v:TaxSnapshot):Promise<void>; snapshot(companyId:CompanyId,id:string):Promise<TaxSnapshot|undefined> }
