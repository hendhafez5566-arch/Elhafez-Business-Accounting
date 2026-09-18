import type {CompanyId} from '@elhafez/contracts'; import type {PartyGroup,NettingDocument} from '../domain/party-accounting.js';
export const PARTY_ACCOUNTING_REPOSITORY=Symbol('PARTY_ACCOUNTING_REPOSITORY');
export interface PartyAccountingRepository {group(companyId:CompanyId,id:string):Promise<PartyGroup|undefined>;saveGroup(value:PartyGroup):Promise<void>;document(companyId:CompanyId,id:string):Promise<NettingDocument|undefined>;saveDocument(value:NettingDocument):Promise<void>}
