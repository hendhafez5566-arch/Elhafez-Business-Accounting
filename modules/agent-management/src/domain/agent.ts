import { ContractValidationError, type CompanyId } from '@elhafez/contracts';
declare const agentIdBrand:unique symbol;
export type AgentId=string & {readonly [agentIdBrand]:'AgentId'};
export type AgentStatus='ACTIVE'|'SUSPENDED';
export type CommissionKind='FIXED'|'PERCENT';
export interface AgentCommissionTerms { readonly kind:CommissionKind; readonly value:string; readonly currency:string|null; }
export interface Agent { readonly id:AgentId; readonly companyId:CompanyId; readonly partyId:string; readonly parentAgentId?:AgentId|null; readonly number:string; readonly status:AgentStatus; readonly notes:string|null; readonly commission:AgentCommissionTerms; readonly createdAt:string; readonly updatedAt:string; }
export interface AgentReference { readonly companyId:CompanyId; readonly agentId:AgentId; readonly sourceType:string; readonly sourceId:string; readonly createdAt:string; }
export const agentId=(value:string):AgentId=>{const v=value.trim();if(!v)throw new ContractValidationError('agentId','is required');return v as AgentId;};
export function decimal(value:string):string{const v=value.trim();if(!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(v))throw new ContractValidationError('value','must be a non-negative decimal with up to 6 decimals');return v;}
export function commissionTerms(input:AgentCommissionTerms):AgentCommissionTerms{
  const value=decimal(input.value);
  if(input.kind==='FIXED'){const currency=input.currency?.trim().toUpperCase();if(!currency)throw new ContractValidationError('currency','is required for fixed commission');return {kind:'FIXED',value,currency};}
  if(input.kind==='PERCENT'){if(BigInt(value.replace('.','').padEnd(value.includes('.')?value.length-1:1,'0'))<0n)throw new ContractValidationError('value','is invalid');return {kind:'PERCENT',value,currency:null};}
  throw new ContractValidationError('kind','is invalid');
}

/** Validate the company-local graph; adapters call this within their atomic write boundary. */
export function assertAgentParent(rows:readonly Agent[],id:AgentId,parent:AgentId|null):Agent {
 const agents=new Map(rows.map(value=>[value.id,value])),current=agents.get(id);
 if(!current)throw new ContractValidationError('agentId','agent was not found in this company');
 if((current.parentAgentId??null)===parent)return current;
 if(parent===null)return current;
 if(parent===id)throw new ContractValidationError('parentAgentId','agent cannot be its own parent');
 const principal=agents.get(parent);
 if(!principal)throw new ContractValidationError('parentAgentId','parent agent was not found in this company');
 if(principal.status!=='ACTIVE')throw new ContractValidationError('parentAgentId','parent agent is suspended');
 const seen=new Set<AgentId>([id]);let cursor:AgentId|null=parent;
 while(cursor){if(seen.has(cursor))throw new ContractValidationError('parentAgentId','circular agent relationships are not allowed');seen.add(cursor);const value=agents.get(cursor);if(!value)throw new ContractValidationError('parentAgentId','parent chain is incomplete');cursor=value.parentAgentId??null;}
 return current;
}
