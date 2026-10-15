import type { AgentCommissionAgreement, CommissionAgreementCommand } from '../domain/commission-agreement.js';
import type { CompanyId } from '@elhafez/contracts';
import type { Agent, AgentId, AgentReference } from '../domain/agent.js';
export interface AgentManagementRepository {
  listCommissionAgreements(companyId:CompanyId,id:AgentId):Promise<AgentCommissionAgreement[]>;
  saveCommissionAgreement(input:CommissionAgreementCommand):Promise<AgentCommissionAgreement>;
  setParent(companyId:CompanyId,id:AgentId,parent:AgentId|null,at:string):Promise<{agent:Agent;previousParentId:AgentId|null}>;
  nextNumber(companyId:CompanyId):Promise<number>;
  create(value:Agent):Promise<void>;
  update(value:Agent):Promise<void>;
  find(companyId:CompanyId,id:AgentId):Promise<Agent|undefined>;
  findByParty(companyId:CompanyId,partyId:string):Promise<Agent|undefined>;
  list(companyId:CompanyId,status?:Agent['status'],query?:string):Promise<Agent[]>;
  delete(companyId:CompanyId,id:AgentId):Promise<void>;
  addReference(value:AgentReference):Promise<void>;
  removeReference(companyId:CompanyId,id:AgentId,sourceType:string,sourceId:string):Promise<void>;
  referenceCount(companyId:CompanyId,id:AgentId):Promise<number>;
}
export const AGENT_MANAGEMENT_REPOSITORY=Symbol('AGENT_MANAGEMENT_REPOSITORY');
