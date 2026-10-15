import { Body, Controller, Get, Headers, Param, Post, UnauthorizedException } from '@nestjs/common';
import { executionContext } from '@elhafez/contracts';
import { PlatformCoreApplicationService } from '@elhafez/platform-core';
import { OfflineCoordinationApplicationService, WriteAuthorityApplicationService, type SubmitOfflineCommand, type OfflineOperation } from '@elhafez/offline-coordination';
@Controller('offline')
export class OfflineWorkflowController {
 static readonly runtimeDependencies=[OfflineCoordinationApplicationService,PlatformCoreApplicationService,WriteAuthorityApplicationService] as const;
 constructor(private readonly coordination:OfflineCoordinationApplicationService,private readonly platform:PlatformCoreApplicationService,private readonly authority:WriteAuthorityApplicationService){}
 private async context(auth:string|undefined,companyId:string|undefined,branchId:string|undefined){if(!auth?.startsWith('Bearer ')||!companyId||!branchId)throw new UnauthorizedException('authenticated company and branch required');const user=await this.platform.currentCompanyUser(auth.slice(7),companyId);return executionContext(companyId,branchId,user.id);}
 @Post('authority/enroll')
 async enroll(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined){const c=await this.context(auth,companyId,branchId);await this.platform.requireBranchAccess(c.actorId,c.companyId,c.branchId);await this.platform.authorize(c.actorId,c.companyId,'platform.configuration.manage');return this.authority.enroll(c.companyId,process.env.ELHAFEZ_WRITE_AUTHORITY_ID??'',c.actorId);}
 @Post('delegations')
 async delegate(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Body() input:{deviceId:string;operations:readonly OfflineOperation[];durationMinutes:number}){return this.coordination.delegate(await this.context(auth,companyId,branchId),input);}
 @Post('delegations/:id/revoke')
 async revoke(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Param('id') id:string){await this.coordination.revoke(await this.context(auth,companyId,branchId),id);return {revoked:true};}
 @Post('commands')
 async submit(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Body() input:SubmitOfflineCommand){return this.coordination.submit(await this.context(auth,companyId,branchId),input);}
 @Get('commands')
 async list(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined){return this.coordination.list(await this.context(auth,companyId,branchId));}
}
