import { ContractValidationError, type CompanyId } from '@elhafez/contracts';
import type { Agent, AgentId } from './agent.js';
export interface AgentCommissionAgreement {
 readonly id:string;readonly companyId:CompanyId;readonly agentId:AgentId;readonly parentAgentId:AgentId;
 readonly version:number;readonly requestId:string;readonly principalPercent:string;readonly subordinatePercent:string;
 readonly reason:string;readonly actorId:string;readonly createdAt:string;
}
export interface CommissionAgreementCommand extends Omit<AgentCommissionAgreement,'version'> {readonly expectedVersion:number;}
export function commissionShares(value:unknown):{principalPercent:string;subordinatePercent:string}{
 if(typeof value!=='string'||value.trim().length>10||!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(value.trim()))throw new ContractValidationError('principalPercent','use a non-negative percentage with up to six decimal places');
 const [whole,fraction='']=value.trim().split('.'),units=BigInt(whole!)*1000000n+BigInt(fraction.padEnd(6,'0'));
 if(units>100000000n)throw new ContractValidationError('principalPercent','percentage must not exceed 100');
 const format=(n:bigint)=>{const f=(n%1000000n).toString().padStart(6,'0').replace(/0+$/,'');return(n/1000000n).toString()+(f?'.'+f:'');};
 return{principalPercent:format(units),subordinatePercent:format(100000000n-units)};
}
export function replayCommissionAgreement(prior:AgentCommissionAgreement,input:CommissionAgreementCommand):AgentCommissionAgreement {
 if(prior.companyId!==input.companyId||prior.agentId!==input.agentId||prior.parentAgentId!==input.parentAgentId||prior.principalPercent!==input.principalPercent||prior.subordinatePercent!==input.subordinatePercent||prior.reason!==input.reason||prior.actorId!==input.actorId||prior.version-1!==input.expectedVersion)throw new ContractValidationError('requestId','request identity was already used with different agreement data');
 return prior;
}
export function assertCommissionAgreement(agent:Agent|undefined,parent:Agent|undefined,input:CommissionAgreementCommand,latestVersion:number):void {
 if(!agent||!parent||agent.companyId!==input.companyId||parent.companyId!==input.companyId)throw new ContractValidationError('agentId','agents were not found in this company');
 if(agent.parentAgentId!==input.parentAgentId)throw new ContractValidationError('parentAgentId','relationship changed; reload before agreeing');
 if(agent.status!=='ACTIVE'||parent.status!=='ACTIVE')throw new ContractValidationError('agentId','both agents must be active');
 if(latestVersion!==input.expectedVersion)throw new ContractValidationError('expectedVersion','agreement changed; reload before saving');
}
