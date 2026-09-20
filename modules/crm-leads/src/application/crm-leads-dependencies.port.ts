import type { ExecutionContext } from '@elhafez/contracts';
import type { Agent, AgentId } from '@elhafez/agent-management';
import type { CreateCustomerInput, Customer, CustomerResolveResult, CustomerId } from '@elhafez/customer-management';

export interface LeadCustomerPort {
 resolveOrCreateForLead(context:ExecutionContext,input:CreateCustomerInput):Promise<CustomerResolveResult>;
 registerReferenceForIntegration(context:ExecutionContext,id:CustomerId,sourceType:string,sourceId:string):Promise<void>;
 requireActiveForIntegration(context:ExecutionContext,id:CustomerId):Promise<Customer>;
}
export interface LeadAgentPort {
 requireActiveForIntegration(context:ExecutionContext,id:AgentId):Promise<Agent>;
 registerReferenceForIntegration(context:ExecutionContext,id:AgentId,sourceType:string,sourceId:string):Promise<void>;
 releaseReferenceForIntegration(context:ExecutionContext,id:AgentId,sourceType:string,sourceId:string):Promise<void>;
}
