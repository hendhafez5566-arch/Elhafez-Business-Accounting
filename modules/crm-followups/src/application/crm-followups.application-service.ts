import{randomUUID}from'node:crypto';import{ContractValidationError,type ExecutionContext}from'@elhafez/contracts';import{leadId,type LeadId}from'@elhafez/crm-leads';import type{CrmFollowupsAccess}from'./crm-followups-access.js';import type{FollowupLeadPort}from'./crm-followups-dependencies.port.js';import type{CrmFollowupsRepository}from'./crm-followups.repository.js';import{followupId,interaction,required,when,type Followup,type FollowupHistory,type FollowupHistoryKind,type FollowupId,type InteractionType}from'../domain/followup.js';
export const CRM_FOLLOWUP_PERMISSIONS=Object.freeze({read:'crm.followup.read',manage:'crm.followup.manage',correct:'crm.followup.correct'});
export interface ScheduleFollowupInput{readonly leadId:string;readonly responsibleUserId:string;readonly interactionType:InteractionType;readonly scheduledAt:string;readonly nextAction?:string;}
export interface CompleteFollowupInput{readonly outcome:string;readonly nextAction?:string;readonly nextScheduledAt?:string;readonly nextInteractionType?:InteractionType;readonly nextResponsibleUserId?:string;}
export class CrmFollowupsApplicationService{constructor(private readonly repository:CrmFollowupsRepository,private readonly leads:FollowupLeadPort,private readonly access:CrmFollowupsAccess,private readonly now:()=>Date=()=>new Date(),private readonly newId:()=>string=()=>randomUUID()){}
 private async branch(c:ExecutionContext){await this.access.requireBranch(c);}private async perm(c:ExecutionContext,p:string){await this.branch(c);await this.access.requirePermission(c,p);}
 async schedule(c:ExecutionContext,input:ScheduleFollowupInput,previous:FollowupId|null=null):Promise<Followup>{await this.perm(c,CRM_FOLLOWUP_PERMISSIONS.manage);const lid=leadId(input.leadId),lead=await this.leads.getForIntegration(c,lid);if(lead.status==='WON'||lead.status==='LOST')throw new ContractValidationError('leadId','follow-up cannot be scheduled for a closed lead');const at=this.now().toISOString(),value:Followup={id:followupId(this.newId()),companyId:c.companyId,branchId:c.branchId,leadId:lid,responsibleUserId:required(input.responsibleUserId,'responsibleUserId'),interactionType:interaction(input.interactionType),scheduledAt:when(input.scheduledAt),status:'SCHEDULED',outcome:null,nextAction:input.nextAction?.trim()||null,previousFollowupId:previous,completedAt:null,cancelledAt:null,completionVoidedAt:null,completionVoidReason:null,createdAt:at,updatedAt:at};await this.repository.create(value,this.event(c,value,'SCHEDULED',null,value.scheduledAt,null));await this.access.audit(c,'followup.scheduled','followup',value.id,{leadId:lid});return value;}
 async get(c:ExecutionContext,id:FollowupId){await this.perm(c,CRM_FOLLOWUP_PERMISSIONS.read);return this.require(c,id);}
 async forLead(c:ExecutionContext,id:LeadId){await this.perm(c,CRM_FOLLOWUP_PERMISSIONS.read);await this.leads.getForIntegration(c,id);return this.repository.listForLead(c.companyId,c.branchId,id);}
 async due(c:ExecutionContext,through:string,responsibleUserId?:string){await this.perm(c,CRM_FOLLOWUP_PERMISSIONS.read);return this.repository.scheduledThrough(c.companyId,c.branchId,when(through,'through'),responsibleUserId?.trim());}
 async overdue(c:ExecutionContext,responsibleUserId?:string){await this.perm(c,CRM_FOLLOWUP_PERMISSIONS.read);return this.repository.scheduledThrough(c.companyId,c.branchId,this.now().toISOString(),responsibleUserId?.trim());}
 async reschedule(c:ExecutionContext,id:FollowupId,scheduledAt:string):Promise<Followup>{await this.perm(c,CRM_FOLLOWUP_PERMISSIONS.manage);const current=await this.require(c,id);if(current.status!=='SCHEDULED')throw new ContractValidationError('status','only scheduled follow-ups can be rescheduled');const next=when(scheduledAt),updated={...current,scheduledAt:next,updatedAt:this.now().toISOString()};await this.repository.update(updated,this.event(c,updated,'RESCHEDULED',current.scheduledAt,next,null));await this.access.audit(c,'followup.rescheduled','followup',id,{from:current.scheduledAt,to:next});return updated;}
 async complete(c:ExecutionContext,id:FollowupId,input:CompleteFollowupInput):Promise<{completed:Followup;next:Followup|null}>{
  await this.perm(c,CRM_FOLLOWUP_PERMISSIONS.manage);
  const current=await this.require(c,id);
  if(current.status!=='SCHEDULED')throw new ContractValidationError('status','only scheduled follow-ups can be completed');
  const outcome=required(input.outcome,'outcome');
  const at=this.now().toISOString();
  const completed:Followup={...current,status:'COMPLETED',outcome,nextAction:input.nextAction?.trim()||null,completedAt:at,updatedAt:at};
  const completedHistory=this.event(c,completed,'COMPLETED',current.scheduledAt,current.scheduledAt,outcome);
  let next:Followup|null=null;
  let nextHistory:FollowupHistory|null=null;
  if(input.nextScheduledAt){
    const lead=await this.leads.getForIntegration(c,leadId(current.leadId));
    if(lead.status==='WON'||lead.status==='LOST')throw new ContractValidationError('leadId','follow-up cannot be scheduled for a closed lead');
    const scheduledAt=when(input.nextScheduledAt,'nextScheduledAt');
    const responsibleUserId=required(input.nextResponsibleUserId?.trim()||current.responsibleUserId,'nextResponsibleUserId');
    const interactionType=interaction(input.nextInteractionType??current.interactionType);
    next={id:followupId(this.newId()),companyId:c.companyId,branchId:c.branchId,leadId:current.leadId,responsibleUserId,interactionType,scheduledAt,status:'SCHEDULED',outcome:null,nextAction:input.nextAction?.trim()||null,previousFollowupId:current.id,completedAt:null,cancelledAt:null,completionVoidedAt:null,completionVoidReason:null,createdAt:at,updatedAt:at};
    nextHistory=this.event(c,next,'SCHEDULED',null,scheduledAt,null);
  }
  await this.repository.completeWithOptionalNext(completed,completedHistory,next,nextHistory);
  await this.access.audit(c,'followup.completed','followup',id,{outcome});
  if(next)await this.access.audit(c,'followup.scheduled','followup',next.id,{leadId:next.leadId,previousFollowupId:current.id});
  return{completed,next};
 }
 async cancel(c:ExecutionContext,id:FollowupId,reason?:string):Promise<Followup>{await this.perm(c,CRM_FOLLOWUP_PERMISSIONS.manage);const current=await this.require(c,id);if(current.status!=='SCHEDULED')throw new ContractValidationError('status','only scheduled follow-ups can be cancelled');const at=this.now().toISOString(),updated={...current,status:'CANCELLED' as const,cancelledAt:at,updatedAt:at};await this.repository.update(updated,this.event(c,updated,'CANCELLED',current.scheduledAt,current.scheduledAt,reason?.trim()||null));await this.access.audit(c,'followup.cancelled','followup',id,{reason:reason?.trim()||null});return updated;}
 async voidCompletion(c:ExecutionContext,id:FollowupId,reason:string):Promise<Followup>{await this.perm(c,CRM_FOLLOWUP_PERMISSIONS.correct);const current=await this.require(c,id);if(current.status!=='COMPLETED')throw new ContractValidationError('status','only completed interactions can be voided as a correction');if(current.completionVoidedAt)return current;const why=required(reason,'reason'),updated={...current,completionVoidedAt:this.now().toISOString(),completionVoidReason:why,updatedAt:this.now().toISOString()};await this.repository.update(updated,this.event(c,updated,'COMPLETION_VOIDED',current.scheduledAt,current.scheduledAt,why));await this.access.audit(c,'followup.completion_voided','followup',id,{reason:why});return updated;}
 async history(c:ExecutionContext,id:FollowupId){await this.perm(c,CRM_FOLLOWUP_PERMISSIONS.read);await this.require(c,id);return this.repository.history(c.companyId,c.branchId,id);}
 private async require(c:ExecutionContext,id:FollowupId):Promise<Followup>{const v=await this.repository.find(c.companyId,c.branchId,id);if(!v)throw new ContractValidationError('followupId','follow-up was not found in this company/branch');return v;}
 private event(c:ExecutionContext,v:Followup,kind:FollowupHistoryKind,previousScheduledAt:string|null,scheduledAt:string|null,detail:string|null):FollowupHistory{return{id:this.newId(),companyId:c.companyId,branchId:c.branchId,followupId:v.id,leadId:v.leadId,kind,detail,previousScheduledAt,scheduledAt,actorId:c.actorId,occurredAt:this.now().toISOString()};}
}
