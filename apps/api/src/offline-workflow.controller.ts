import { TreasurySettlementApplicationService } from '@elhafez/treasury-settlement';
import { Body, Controller, Get, Headers, Param, Post, UnauthorizedException } from '@nestjs/common';
import { executionContext } from '@elhafez/contracts';
import { PlatformCoreApplicationService } from '@elhafez/platform-core';
import { OfflineCoordinationApplicationService, WriteAuthorityApplicationService, type SubmitOfflineCommand, type OfflineCommand, type OfflineOperation } from '@elhafez/offline-coordination';
@Controller('offline')
export class OfflineWorkflowController {
 static readonly runtimeDependencies=[OfflineCoordinationApplicationService,PlatformCoreApplicationService,WriteAuthorityApplicationService,TreasurySettlementApplicationService] as const;
 constructor(private readonly coordination:OfflineCoordinationApplicationService,private readonly platform:PlatformCoreApplicationService,private readonly authority:WriteAuthorityApplicationService,private readonly treasury:TreasurySettlementApplicationService){}
 private async context(auth:string|undefined,companyId:string|undefined,branchId:string|undefined){if(!auth?.startsWith('Bearer ')||!companyId||!branchId)throw new UnauthorizedException('authenticated company and branch required');const user=await this.platform.currentCompanyUser(auth.slice(7),companyId);return executionContext(companyId,branchId,user.id);}
 @Get('cash-options')
 async cashOptions(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined){const c=await this.context(auth,companyId,branchId);await this.platform.requireBranchAccess(c.actorId,c.companyId,c.branchId);await this.platform.authorize(c.actorId,c.companyId,'accounting.finance.operate');return(await this.treasury.listTreasuries(c.companyId)).filter(x=>x.active).map(x=>({id:x.id,label:x.name+' — '+x.currency}));}
 @Post('authority/enroll')
 async enroll(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined){const c=await this.context(auth,companyId,branchId);await this.platform.requireBranchAccess(c.actorId,c.companyId,c.branchId);await this.platform.authorize(c.actorId,c.companyId,'platform.configuration.manage');return this.authority.enroll(c.companyId,process.env.ELHAFEZ_WRITE_AUTHORITY_ID??'',c.actorId);}
 @Post('delegations')
 async delegate(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Body() input:{deviceId:string;operations:readonly OfflineOperation[];durationMinutes:number}){return this.coordination.delegate(await this.context(auth,companyId,branchId),input);}
 @Post('delegations/:id/revoke')
 async revoke(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Param('id') id:string){await this.coordination.revoke(await this.context(auth,companyId,branchId),id);return {revoked:true};}
 @Post('commands')
 async submit(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Body() input:SubmitOfflineCommand){return this.coordination.submit(await this.context(auth,companyId,branchId),input);}
 @Post('reviews/intake')
 async intake(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Body() input:{actorId:string;command:SubmitOfflineCommand}){const c=await this.context(auth,companyId,branchId),value=await this.coordination.intakeCash(c,input.actorId,input.command);await this.platform.recordAuditOnce('offline-intake:'+value.id,{actorId:c.actorId,companyId:c.companyId,branchId:c.branchId,action:'offline.cash.intake',resource:'offline-command',entityId:value.id,metadata:{originalActorId:value.actorId,payloadHash:value.payloadHash,state:value.state}});return value;}
 @Get('reviews')
 async reviews(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined):Promise<Array<OfflineCommand & {actorDisplayName:string}>>{const c=await this.context(auth,companyId,branchId),commands=await this.coordination.reviewQueue(c),users=await Promise.all([...new Set(commands.map(x=>x.actorId))].map(id=>this.platform.getCompanyUser(c.companyId,id)));return commands.map(command=>({...command,actorDisplayName:users.find(x=>x.id===command.actorId)?.displayName??'الموظف الأصلي'}));}
 @Post('reviews/:id/resolve')
 async resolve(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Param('id') id:string,@Body() input:{reason:string}){return this.coordination.resolveReview(await this.context(auth,companyId,branchId),id,input.reason);}
 @Get('commands')
 async list(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined){return this.coordination.list(await this.context(auth,companyId,branchId));}
}
