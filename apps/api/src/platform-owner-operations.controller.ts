import{BadRequestException,Body,Controller,Get,Headers,Param,Post,UnauthorizedException}from'@nestjs/common';
import{PlatformOperationsApplicationService,PlatformOperationsError,type RestoreJob}from'@elhafez/platform-operations';
import{SaasControlPlaneApplicationService}from'@elhafez/saas-control-plane';

function bearer(value:string|undefined){if(!value?.startsWith('Bearer '))throw new UnauthorizedException('owner bearer session required');return value.slice(7);}
function mfa(value:string|undefined){if(!value)throw new UnauthorizedException('owner MFA code required');return value;}
function mapOperations(error:unknown):never{if(error instanceof PlatformOperationsError)throw new BadRequestException({code:'PLATFORM_OPERATIONS_ERROR',message:error.message});throw error;}
type OwnerRestoreResponse=RestoreJob|(RestoreJob&{ownerSessionsRevoked:number;maintenance:boolean});

@Controller('saas-owner/operations')
export class PlatformOwnerOperationsController{
 constructor(private readonly saas:SaasControlPlaneApplicationService,private readonly operations:PlatformOperationsApplicationService){}
 @Get('diagnostics')
 async diagnostics(@Headers('authorization')auth:string|undefined){await this.saas.requireOwner(bearer(auth));return this.operations.diagnostics();}
 @Get('maintenance')
 async maintenance(@Headers('authorization')auth:string|undefined){await this.saas.requireOwner(bearer(auth));return{active:await this.operations.maintenanceStatus()};}
 @Post('maintenance/enter')
 async enterMaintenance(@Headers('authorization')auth:string|undefined,@Headers('x-owner-totp')otp:string|undefined){await this.saas.requireSensitiveOwner(bearer(auth),mfa(otp));try{return await this.operations.enterMaintenance();}catch(error){mapOperations(error);}}
 @Post('maintenance/exit')
 async exitMaintenance(@Headers('authorization')auth:string|undefined,@Headers('x-owner-totp')otp:string|undefined){await this.saas.requireSensitiveOwner(bearer(auth),mfa(otp));try{return await this.operations.exitMaintenance();}catch(error){mapOperations(error);}}
 @Get('backups')
 async backups(@Headers('authorization')auth:string|undefined){await this.saas.requireOwner(bearer(auth));return this.operations.listBackups(null);}
 @Post('backups')
 async createBackup(@Headers('authorization')auth:string|undefined,@Headers('x-owner-totp')otp:string|undefined,@Body()body:{pin?:boolean}){
  const owner=await this.saas.requireSensitiveOwner(bearer(auth),mfa(otp));try{return await this.operations.createBackup({actorId:owner.id,pin:body.pin});}catch(error){mapOperations(error);}
 }
 @Post('backups/:id/verify')
 async verifyBackup(@Headers('authorization')auth:string|undefined,@Headers('x-owner-totp')otp:string|undefined,@Param('id')id:string){
  await this.saas.requireSensitiveOwner(bearer(auth),mfa(otp));try{return await this.operations.verifyBackup(null,id);}catch(error){mapOperations(error);}
 }
 @Post('backups/:id/pin')
 async pinBackup(@Headers('authorization')auth:string|undefined,@Headers('x-owner-totp')otp:string|undefined,@Param('id')id:string,@Body()body:{pinned:boolean}){
  await this.saas.requireSensitiveOwner(bearer(auth),mfa(otp));try{return await this.operations.setPinned(null,id,body.pinned);}catch(error){mapOperations(error);}
 }
 @Post('backups/:id/preflight')
 async preflight(@Headers('authorization')auth:string|undefined,@Headers('x-owner-totp')otp:string|undefined,@Param('id')id:string){
  await this.saas.requireSensitiveOwner(bearer(auth),mfa(otp));try{return await this.operations.preflight({backupId:id});}catch(error){mapOperations(error);}
 }
 @Post('backups/retention')
 async retention(@Headers('authorization')auth:string|undefined,@Headers('x-owner-totp')otp:string|undefined,@Body()body:{retain:number}){
  await this.saas.requireSensitiveOwner(bearer(auth),mfa(otp));try{return await this.operations.cleanup(null,body.retain);}catch(error){mapOperations(error);}
 }
 @Post('restores')
 async restore(@Headers('authorization')auth:string|undefined,@Headers('x-owner-totp')otp:string|undefined,@Body()body:{backupId:string}):Promise<OwnerRestoreResponse>{
  const owner=await this.saas.requireSensitiveOwner(bearer(auth),mfa(otp));try{const result=await this.operations.restore({backupId:body.backupId,actorId:owner.id});if(result.status!=='COMPLETED')return result;const ownerSessionsRevoked=await this.saas.revokeAllOwnerSessionsForRecovery();return{...result,ownerSessionsRevoked,maintenance:await this.operations.maintenanceStatus()};}catch(error){mapOperations(error);}
 }
 @Get('restores/:id')
 async restoreStatus(@Headers('authorization')auth:string|undefined,@Param('id')id:string){
  await this.saas.requireOwner(bearer(auth));try{return await this.operations.getRestore(null,id);}catch(error){mapOperations(error);}
 }
}
