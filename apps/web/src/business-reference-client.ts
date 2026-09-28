import {accountingApi,type AccountRow} from './accounting-client.js';
import {crmGet} from './crm-core-client.js';
import {hajjUmrahApi,type Program} from './hajj-umrah-client.js';

export interface CustomerReference{customer:{id:string;number:string;status:string};party:{displayName:string}}
export interface AgentReference{agent:{id:string;number:string;status:string};party:{displayName:string}}
export interface TravelerReference{id:string;fullName:string;nationality:string|null;status:string;customerId:string|null}
export interface UserReference{id:string;displayName?:string;name?:string;username?:string;active?:boolean}
export interface CostCenterReference{id:string;code:string;name:string;status:'ACTIVE'|'INACTIVE';parentId?:string}

export const businessReferenceApi={
 programs:()=>hajjUmrahApi.listPrograms(),
 customers:()=>crmGet<CustomerReference[]>('/crm/customers?status=ACTIVE'),
 agents:()=>crmGet<AgentReference[]>('/crm/agents?status=ACTIVE'),
 travelers:()=>crmGet<TravelerReference[]>('/crm/travelers?status=ACTIVE'),
 users:()=>crmGet<UserReference[]>('/system-administration/users'),
 accounts:()=>accountingApi.overview().then(value=>value.accounts),
 costCenters:()=>crmGet<CostCenterReference[]>('/business-references/cost-centers'),
};

export function programOption(program:Program){return{id:program.id,code:program.code,label:program.arabicName,description:program.status};}
export function customerOption(value:CustomerReference){return{id:value.customer.id,code:value.customer.number,label:value.party.displayName};}
export function agentOption(value:AgentReference){return{id:value.agent.id,code:value.agent.number,label:value.party.displayName};}
export function travelerOption(value:TravelerReference){return{id:value.id,label:value.fullName,description:value.nationality??undefined};}
export function userOption(value:UserReference){return{id:value.id,code:value.username,label:value.displayName||value.name||value.username||'مستخدم'};}
export function accountOption(value:AccountRow){return{id:value.id,code:value.code,label:value.name,description:value.classification};}
