import{crmGet}from'./crm-core-client.js';

export interface PartyReference{readonly id:string;readonly displayName:string;readonly phone:string|null}
export interface CustomerReference{readonly customer:{readonly id:string;readonly number:string;readonly status:string};readonly party:PartyReference}
export interface AgentReference{readonly agent:{readonly id:string;readonly number:string;readonly status:string};readonly party:PartyReference}
export interface TravelerReference{readonly id:string;readonly fullName:string;readonly nationality:string|null;readonly customerId:string|null;readonly status:'ACTIVE'|'ARCHIVED'}

export interface OperationalReferenceData{
 readonly customers:readonly CustomerReference[];
 readonly agents:readonly AgentReference[];
 readonly travelers:readonly TravelerReference[];
}

export const emptyOperationalReferenceData:OperationalReferenceData={customers:[],agents:[],travelers:[]};

export async function loadOperationalReferenceData():Promise<OperationalReferenceData>{
 const[customers,agents,travelers]=await Promise.all([
  crmGet<CustomerReference[]>('/crm/customers?status=ACTIVE'),
  crmGet<AgentReference[]>('/crm/agents?status=ACTIVE'),
  crmGet<TravelerReference[]>('/crm/travelers?status=ACTIVE'),
 ]);
 return{customers,agents,travelers};
}

export const customerReferenceLabel=(value:CustomerReference)=>`${value.customer.number} — ${value.party.displayName}`;
export const agentReferenceLabel=(value:AgentReference)=>`${value.agent.number} — ${value.party.displayName}`;
export const travelerReferenceLabel=(value:TravelerReference)=>value.nationality?`${value.fullName} — ${value.nationality}`:value.fullName;
