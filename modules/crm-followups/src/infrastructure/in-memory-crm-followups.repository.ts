import type { ScheduleRequest, ScheduledRequestResult } from '../application/schedule-request.js';
import type { BranchId, CompanyId } from '@elhafez/contracts';
import type { CrmFollowupsRepository } from '../application/crm-followups.repository.js';
import type { Followup, FollowupHistory, FollowupId } from '../domain/followup.js';

export type AtomicFollowupStage='before-next-create';

export class InMemoryCrmFollowupsRepository implements CrmFollowupsRepository {
  private readonly requests=new Map<string,{id:FollowupId;fingerprint:string}>();
  private readonly rows=new Map<string,Followup>();
  private readonly histories:FollowupHistory[]=[];
  constructor(private readonly atomicHook?:(stage:AtomicFollowupStage)=>void){}
  private k(c:CompanyId,b:BranchId,i:FollowupId){return c+'|'+b+'|'+i;}
  private requestKey(c:CompanyId,b:BranchId,r:ScheduleRequest){return JSON.stringify([c,b,r.actorId,r.id]);}
  async findScheduleRequest(c:CompanyId,b:BranchId,r:ScheduleRequest):Promise<ScheduledRequestResult|undefined>{
    const receipt=this.requests.get(this.requestKey(c,b,r));
    if(!receipt)return undefined;
    const followup=this.rows.get(this.k(c,b,receipt.id));
    if(!followup)throw new Error('accepted follow-up missing');
    return {followup,fingerprint:receipt.fingerprint,created:false};
  }
  async createScheduledRequest(v:Followup,h:FollowupHistory,r:ScheduleRequest):Promise<ScheduledRequestResult>{
    const key=this.requestKey(v.companyId,v.branchId,r),receipt=this.requests.get(key);
    if(receipt){const followup=this.rows.get(this.k(v.companyId,v.branchId,receipt.id));if(!followup)throw new Error('accepted follow-up missing');return {followup,fingerprint:receipt.fingerprint,created:false};}
    const rowKey=this.k(v.companyId,v.branchId,v.id);
    if(this.rows.has(rowKey))throw new Error('duplicate follow-up');
    this.rows.set(rowKey,v);this.histories.push(h);this.requests.set(key,{id:v.id,fingerprint:r.fingerprint});
    return {followup:v,fingerprint:r.fingerprint,created:true};
  }
  async create(v:Followup,h:FollowupHistory){
    const key=this.k(v.companyId,v.branchId,v.id);
    if(this.rows.has(key))throw new Error('duplicate follow-up');
    this.rows.set(key,v);this.histories.push(h);
  }
  async update(v:Followup,h:FollowupHistory){this.rows.set(this.k(v.companyId,v.branchId,v.id),v);this.histories.push(h);}
  async completeWithOptionalNext(completed:Followup,completedHistory:FollowupHistory,next:Followup|null,nextHistory:FollowupHistory|null){
    if((next===null)!==(nextHistory===null))throw new Error('next follow-up and history must be supplied together');
    const currentKey=this.k(completed.companyId,completed.branchId,completed.id);
    const before=this.rows.get(currentKey);
    if(!before)throw new Error('follow-up missing');
    const historyLength=this.histories.length;
    const nextKey=next?this.k(next.companyId,next.branchId,next.id):null;
    if(nextKey&&this.rows.has(nextKey))throw new Error('duplicate successor follow-up');
    try{
      this.rows.set(currentKey,completed);
      this.histories.push(completedHistory);
      if(next&&nextHistory&&nextKey){
        this.atomicHook?.('before-next-create');
        this.rows.set(nextKey,next);
        this.histories.push(nextHistory);
      }
    }catch(error){
      this.rows.set(currentKey,before);
      if(nextKey)this.rows.delete(nextKey);
      this.histories.splice(historyLength);
      throw error;
    }
  }
  async find(c:CompanyId,b:BranchId,i:FollowupId){return this.rows.get(this.k(c,b,i));}
  async listForLead(c:CompanyId,b:BranchId,l:string){return [...this.rows.values()].filter(x=>x.companyId===c&&x.branchId===b&&x.leadId===l);}
  async scheduledThrough(c:CompanyId,b:BranchId,t:string,u?:string){return [...this.rows.values()].filter(x=>x.companyId===c&&x.branchId===b&&x.status==='SCHEDULED'&&x.scheduledAt<=t&&(!u||x.responsibleUserId===u)).sort((a,z)=>a.scheduledAt.localeCompare(z.scheduledAt));}
  async history(c:CompanyId,b:BranchId,i:FollowupId){return this.histories.filter(x=>x.companyId===c&&x.branchId===b&&x.followupId===i);}
}
