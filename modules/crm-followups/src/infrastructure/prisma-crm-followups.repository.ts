import type { PrismaClient } from '@prisma/client';
import type { BranchId, CompanyId } from '@elhafez/contracts';
import { leadId } from '@elhafez/crm-leads';
import type { CrmFollowupsRepository } from '../application/crm-followups.repository.js';
import { followupId, type Followup, type FollowupHistory, type FollowupId } from '../domain/followup.js';

export class PrismaCrmFollowupsRepository implements CrmFollowupsRepository {
  constructor(private readonly db:PrismaClient){}
  async create(v:Followup,h:FollowupHistory){await this.db.$transaction(async tx=>{await tx.cfFollowup.create({data:data(v)});await tx.cfFollowupHistory.create({data:history(h)});});}
  async update(v:Followup,h:FollowupHistory){await this.db.$transaction(async tx=>{await tx.cfFollowup.update({where:{companyId_branchId_id:{companyId:v.companyId,branchId:v.branchId,id:v.id}},data:data(v)});await tx.cfFollowupHistory.create({data:history(h)});});}
  async completeWithOptionalNext(completed:Followup,completedHistory:FollowupHistory,next:Followup|null,nextHistory:FollowupHistory|null){
    if((next===null)!==(nextHistory===null))throw new Error('next follow-up and history must be supplied together');
    await this.db.$transaction(async tx=>{
      await tx.cfFollowup.update({where:{companyId_branchId_id:{companyId:completed.companyId,branchId:completed.branchId,id:completed.id}},data:data(completed)});
      await tx.cfFollowupHistory.create({data:history(completedHistory)});
      if(next&&nextHistory){
        await tx.cfFollowup.create({data:data(next)});
        await tx.cfFollowupHistory.create({data:history(nextHistory)});
      }
    });
  }
  async find(c:CompanyId,b:BranchId,i:FollowupId){const r=await this.db.cfFollowup.findUnique({where:{companyId_branchId_id:{companyId:c,branchId:b,id:i}}});return r?map(r):undefined;}
  async listForLead(c:CompanyId,b:BranchId,l:string){return(await this.db.cfFollowup.findMany({where:{companyId:c,branchId:b,leadId:l},orderBy:{scheduledAt:'desc'}})).map(map);}
  async scheduledThrough(c:CompanyId,b:BranchId,t:string,u?:string){return(await this.db.cfFollowup.findMany({where:{companyId:c,branchId:b,status:'SCHEDULED',scheduledAt:{lte:new Date(t)},...(u?{responsibleUserId:u}:{})},orderBy:{scheduledAt:'asc'}})).map(map);}
  async history(c:CompanyId,b:BranchId,i:FollowupId){return(await this.db.cfFollowupHistory.findMany({where:{companyId:c,branchId:b,followupId:i},orderBy:{occurredAt:'asc'}})).map(r=>({id:r.id,companyId:r.companyId as CompanyId,branchId:r.branchId as BranchId,followupId:followupId(r.followupId),leadId:leadId(r.leadId),kind:r.kind as FollowupHistory['kind'],detail:r.detail,previousScheduledAt:r.previousScheduledAt?.toISOString()??null,scheduledAt:r.scheduledAt?.toISOString()??null,actorId:r.actorId,occurredAt:r.occurredAt.toISOString()}));}
}
function data(v:Followup){return{id:v.id,companyId:v.companyId,branchId:v.branchId,leadId:v.leadId,responsibleUserId:v.responsibleUserId,interactionType:v.interactionType,scheduledAt:new Date(v.scheduledAt),status:v.status,outcome:v.outcome,nextAction:v.nextAction,previousFollowupId:v.previousFollowupId,completedAt:v.completedAt?new Date(v.completedAt):null,cancelledAt:v.cancelledAt?new Date(v.cancelledAt):null,completionVoidedAt:v.completionVoidedAt?new Date(v.completionVoidedAt):null,completionVoidReason:v.completionVoidReason,createdAt:new Date(v.createdAt),updatedAt:new Date(v.updatedAt)};}
function history(h:FollowupHistory){return{id:h.id,companyId:h.companyId,branchId:h.branchId,followupId:h.followupId,leadId:h.leadId,kind:h.kind,detail:h.detail,previousScheduledAt:h.previousScheduledAt?new Date(h.previousScheduledAt):null,scheduledAt:h.scheduledAt?new Date(h.scheduledAt):null,actorId:h.actorId,occurredAt:new Date(h.occurredAt)};}
function map(r:{id:string;companyId:string;branchId:string;leadId:string;responsibleUserId:string;interactionType:string;scheduledAt:Date;status:string;outcome:string|null;nextAction:string|null;previousFollowupId:string|null;completedAt:Date|null;cancelledAt:Date|null;completionVoidedAt:Date|null;completionVoidReason:string|null;createdAt:Date;updatedAt:Date}):Followup{return{id:followupId(r.id),companyId:r.companyId as CompanyId,branchId:r.branchId as BranchId,leadId:r.leadId,responsibleUserId:r.responsibleUserId,interactionType:r.interactionType as Followup['interactionType'],scheduledAt:r.scheduledAt.toISOString(),status:r.status as Followup['status'],outcome:r.outcome,nextAction:r.nextAction,previousFollowupId:r.previousFollowupId?followupId(r.previousFollowupId):null,completedAt:r.completedAt?.toISOString()??null,cancelledAt:r.cancelledAt?.toISOString()??null,completionVoidedAt:r.completionVoidedAt?.toISOString()??null,completionVoidReason:r.completionVoidReason,createdAt:r.createdAt.toISOString(),updatedAt:r.updatedAt.toISOString()};}
