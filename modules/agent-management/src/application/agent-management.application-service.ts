import { randomUUID } from 'node:crypto';
import { ContractValidationError, type ExecutionContext } from '@elhafez/contracts';
import type { DuplicateCandidate, Party, PartyDraft } from '@elhafez/party-registry';
import type { AgentAccess } from './agent-access.js';
import type { AgentManagementRepository } from './agent-management.repository.js';
import type { AgentPartyRegistryPort } from './party-registry.port.js';
import { agentId, commissionTerms, type Agent, type AgentCommissionTerms, type AgentId, type AgentStatus } from '../domain/agent.js';

export const AGENT_PERMISSIONS=Object.freeze({read:'crm.agent.read',manage:'crm.agent.manage',lifecycle:'crm.agent.lifecycle',delete:'crm.agent.delete'});
export interface CreateAgentInput{readonly party:PartyDraft;readonly notes?:string;readonly commission:AgentCommissionTerms;}
export interface UpdateAgentInput{readonly party?:PartyDraft;readonly notes?:string|null;readonly commission?:AgentCommissionTerms;}
export interface AgentView{readonly agent:Agent;readonly party:Party;}
export type AgentCreateResult=
 | {readonly status:'CREATED'|'EXISTING';readonly value:AgentView}
 | {readonly status:'REVIEW_REQUIRED';readonly candidates:readonly DuplicateCandidate[]};

export class AgentManagementApplicationService{
 constructor(private readonly repository:AgentManagementRepository,private readonly parties:AgentPartyRegistryPort,private readonly access:AgentAccess,private readonly now:()=>Date=()=>new Date(),private readonly newId:()=>string=()=>randomUUID()){}
 private async branch(c:ExecutionContext){await this.access.requireBranch(c);}
 private async perm(c:ExecutionContext,p:string){await this.branch(c);await this.access.requirePermission(c,p);}
 async create(c:ExecutionContext,input:CreateAgentInput):Promise<AgentCreateResult>{await this.perm(c,AGENT_PERMISSIONS.manage);return this.resolveOrCreateForIntegration(c,input);}
 async resolveOrCreateForIntegration(c:ExecutionContext,input:CreateAgentInput):Promise<AgentCreateResult>{
  await this.branch(c);const resolved=await this.parties.resolveOrCreateForIntegration(c,input.party);if(resolved.status==='REVIEW_REQUIRED')return resolved;
  const existing=await this.repository.findByParty(c.companyId,resolved.party.id);if(existing)return{status:'EXISTING',value:{agent:existing,party:resolved.party}};
  const at=this.now().toISOString();const seq=await this.repository.nextNumber(c.companyId);const value:Agent={id:agentId(this.newId()),companyId:c.companyId,partyId:resolved.party.id,number:'AGT-'+String(seq).padStart(6,'0'),status:'ACTIVE',notes:input.notes?.trim()||null,commission:commissionTerms(input.commission),createdAt:at,updatedAt:at};
  try{await this.repository.create(value);}catch(error){const concurrent=await this.repository.findByParty(c.companyId,resolved.party.id);if(concurrent)return{status:'EXISTING',value:{agent:concurrent,party:resolved.party}};throw error;}
  await this.parties.ensureRoleForIntegration(c,resolved.party.id,'AGENT');await this.access.audit(c,'agent.created','agent',value.id,{number:value.number});return{status:'CREATED',value:{agent:value,party:resolved.party}};
 }
 async get(c:ExecutionContext,id:AgentId):Promise<AgentView>{await this.perm(c,AGENT_PERMISSIONS.read);const agent=await this.require(c,id,false);return{agent,party:await this.parties.getForIntegration(c,agent.partyId)};}
 async list(c:ExecutionContext,status?:AgentStatus,query?:string):Promise<AgentView[]>{await this.perm(c,AGENT_PERMISSIONS.read);const rows=await this.repository.list(c.companyId,status,query);return Promise.all(rows.map(async(agent)=>({agent,party:await this.parties.getForIntegration(c,agent.partyId)})));}
 async update(c:ExecutionContext,id:AgentId,input:UpdateAgentInput):Promise<AgentView>{await this.perm(c,AGENT_PERMISSIONS.manage);const current=await this.require(c,id,false);if(input.party)await this.parties.updateForIntegration(c,current.partyId,input.party);const updated:Agent={...current,notes:input.notes===undefined?current.notes:input.notes?.trim()||null,commission:input.commission?commissionTerms(input.commission):current.commission,updatedAt:this.now().toISOString()};await this.repository.update(updated);await this.access.audit(c,'agent.updated','agent',id,{});return{agent:updated,party:await this.parties.getForIntegration(c,current.partyId)};}
 async suspend(c:ExecutionContext,id:AgentId):Promise<Agent>{await this.perm(c,AGENT_PERMISSIONS.lifecycle);const value=await this.require(c,id,false);if(value.status==='SUSPENDED')return value;const updated={...value,status:'SUSPENDED' as const,updatedAt:this.now().toISOString()};await this.repository.update(updated);await this.access.audit(c,'agent.suspended','agent',id,{});return updated;}
 async reactivate(c:ExecutionContext,id:AgentId):Promise<Agent>{await this.perm(c,AGENT_PERMISSIONS.lifecycle);const value=await this.require(c,id,false);if(value.status==='ACTIVE')return value;const updated={...value,status:'ACTIVE' as const,updatedAt:this.now().toISOString()};await this.repository.update(updated);await this.access.audit(c,'agent.reactivated','agent',id,{});return updated;}
 async hardDelete(c:ExecutionContext,id:AgentId):Promise<void>{await this.perm(c,AGENT_PERMISSIONS.delete);const value=await this.require(c,id,false);if(value.status==='ACTIVE')throw new ContractValidationError('agent','active agent must be suspended before hard delete');if(await this.repository.referenceCount(c.companyId,id)>0)throw new ContractValidationError('agent','referenced agent cannot be hard deleted');try{await this.repository.delete(c.companyId,id);}catch{throw new ContractValidationError('agent','referenced agent cannot be hard deleted');}await this.parties.removeRoleForIntegration(c,value.partyId,'AGENT');await this.access.audit(c,'agent.deleted','agent',id,{});}
 async requireActiveForIntegration(c:ExecutionContext,id:AgentId):Promise<Agent>{await this.branch(c);return this.require(c,id,true);}
 async registerReferenceForIntegration(c:ExecutionContext,id:AgentId,sourceType:string,sourceId:string):Promise<void>{await this.branch(c);await this.require(c,id,true);await this.repository.addReference({companyId:c.companyId,agentId:id,sourceType:required(sourceType,'sourceType'),sourceId:required(sourceId,'sourceId'),createdAt:this.now().toISOString()});}
 async releaseReferenceForIntegration(c:ExecutionContext,id:AgentId,sourceType:string,sourceId:string):Promise<void>{await this.branch(c);await this.repository.removeReference(c.companyId,id,sourceType,sourceId);}
 private async require(c:ExecutionContext,id:AgentId,active:boolean):Promise<Agent>{const value=await this.repository.find(c.companyId,id);if(!value)throw new ContractValidationError('agentId','agent was not found in this company');if(active&&value.status!=='ACTIVE')throw new ContractValidationError('agentId','agent is suspended');return value;}
}
function required(value:string,field:string):string{const v=value.trim();if(!v)throw new ContractValidationError(field,'is required');return v;}
