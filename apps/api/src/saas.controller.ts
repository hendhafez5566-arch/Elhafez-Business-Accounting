import {BadRequestException,Body,ConflictException,Controller,ForbiddenException,Get,Header,Headers,Inject,InternalServerErrorException,NotFoundException,Param,Post,UnauthorizedException} from '@nestjs/common';
import {SaasControlPlaneApplicationService,SaasError} from '@elhafez/saas-control-plane';
import {PlatformCoreApplicationService,PlatformError} from '@elhafez/platform-core';
function mapError(error:unknown):never{if(error instanceof PlatformError){if(['UNAUTHENTICATED','INVALID_CREDENTIALS','INVALID_RECOVERY_TOKEN'].includes(error.code))throw new UnauthorizedException({code:error.code,message:error.message});if(error.code==='FORBIDDEN')throw new ForbiddenException({code:error.code,message:error.message});if(error.code==='NOT_FOUND')throw new NotFoundException({code:error.code,message:error.message});if(error.code==='CONFLICT')throw new ConflictException({code:error.code,message:error.message});throw new BadRequestException({code:error.code,message:error.message});}if(!(error instanceof SaasError))throw error;if(error.code==='SECURITY_CONFIGURATION')throw new InternalServerErrorException({code:'SECURITY_CONFIGURATION',message:'SaaS security configuration is unavailable'});if(['AUTH_REQUIRED','INVALID_OWNER_CREDENTIALS','OWNER_LOCKED'].includes(error.code))throw new UnauthorizedException({code:error.code,message:error.message});if(['SUBSCRIPTION_REQUIRED','SUBSCRIPTION_EXPIRED','SUBSCRIPTION_SUSPENDED','SUBSCRIPTION_CANCELLED','ENTITLEMENT_REQUIRED','MFA_REQUIRED'].includes(error.code))throw new ForbiddenException({code:error.code,message:error.message});if(['CONFLICT','IDEMPOTENCY_CONFLICT','PAYMENT_REFERENCE_REUSED','BOOTSTRAP_CLOSED'].includes(error.code))throw new ConflictException({code:error.code,message:error.message});if(error.code==='NOT_FOUND')throw new NotFoundException({code:error.code,message:error.message});throw new BadRequestException({code:error.code,message:error.message});}
const bearer=(value:string|undefined)=>{if(!value?.startsWith('Bearer '))throw new UnauthorizedException('owner bearer session required');return value.slice(7);};
const mfa=(value:string|undefined)=>{if(!value)throw new ForbiddenException('owner MFA code required');return value;};

@Controller('saas')
export class SaasTenantController{
 constructor(@Inject(SaasControlPlaneApplicationService) private readonly saas:SaasControlPlaneApplicationService,@Inject(PlatformCoreApplicationService) private readonly platform:PlatformCoreApplicationService){}
 @Post('login')@Header('Cache-Control','no-store')async login(@Body()body:{companyCode:string;email:string;password:string}){
  let session:{token:string;userId:string;expiresAt:Date}|null=null,companyName='';
  try{
   const resolved=await this.saas.resolveCompanyCode(body.companyCode);
   session=await this.platform.login(body.email,body.password);
   try{
    const company=await this.platform.getCompany(session.userId,resolved.companyId);
    if(!company.active)throw new PlatformError('FORBIDDEN','company is inactive');
    companyName=company.name;
   }catch(error){
    await this.platform.logout(session.token);
    session=null;
    void error;
    throw new UnauthorizedException({code:'INVALID_TENANT_CREDENTIALS',message:'invalid company or credentials'});
   }
   const branches=await this.platform.listAccessibleBranches(session.userId,resolved.companyId);
   if(!branches.length){await this.platform.logout(session.token);session=null;throw new UnauthorizedException({code:'INVALID_TENANT_CREDENTIALS',message:'invalid company or credentials'});}
   const subscription=await this.saas.subscriptionStatus(resolved.companyId);
   return{token:session.token,userId:session.userId,expiresAt:session.expiresAt,companyId:resolved.companyId,companyCode:resolved.companyCode,companyName,branches,defaultBranchId:branches[0]!.id,subscription};
  }catch(error){
   if(session){await this.platform.logout(session.token);session=null;}
   if(error instanceof UnauthorizedException)throw error;
   if(error instanceof PlatformError&&error.code==='INVALID_CREDENTIALS')throw new UnauthorizedException({code:'INVALID_TENANT_CREDENTIALS',message:'invalid company or credentials'});
   if(error instanceof SaasError&&error.code==='NOT_FOUND')throw new UnauthorizedException({code:'INVALID_TENANT_CREDENTIALS',message:'invalid company or credentials'});
   mapError(error);
  }
 }
 @Post('logout')@Header('Cache-Control','no-store')async logout(@Headers('authorization')auth:string|undefined){if(!auth?.startsWith('Bearer '))throw new UnauthorizedException('tenant bearer session required');try{await this.platform.logout(auth.slice(7));return{loggedOut:true};}catch(error){mapError(error);}}
 @Get('subscription-status')@Header('Cache-Control','no-store')async status(@Headers('authorization')auth:string|undefined,@Headers('x-company-id')companyId:string|undefined){if(!companyId)throw new BadRequestException('x-company-id is required');if(!auth?.startsWith('Bearer '))throw new UnauthorizedException('tenant bearer session required');try{const user=await this.platform.currentUser(auth.slice(7));await this.platform.requireUserCompanyAccess(user.id,companyId);return await this.saas.subscriptionStatus(companyId);}catch(error){mapError(error);}}
}

@Controller('saas-owner')
export class SaasOwnerController{
 constructor(@Inject(SaasControlPlaneApplicationService) private readonly saas:SaasControlPlaneApplicationService,@Inject(PlatformCoreApplicationService) private readonly platform:PlatformCoreApplicationService){}
 @Post('bootstrap')@Header('Cache-Control','no-store')async bootstrap(@Headers('x-saas-bootstrap-token')token:string|undefined,@Body()body:{email:string;password:string}){try{return await this.saas.bootstrapOwner({...body,bootstrapToken:token??''});}catch(error){mapError(error);}}
 @Post('login')@Header('Cache-Control','no-store')async login(@Body()body:{email:string;password:string;mfaCode:string}){try{return await this.saas.loginOwner(body);}catch(error){mapError(error);}}
 @Post('logout')async logout(@Headers('authorization')auth:string|undefined){try{await this.saas.logoutOwner(bearer(auth));return{loggedOut:true};}catch(error){mapError(error);}}
 @Post('companies')async createCompany(@Headers('authorization')auth:string|undefined,@Headers('x-owner-totp')otp:string|undefined,@Body()body:{name:string;administratorEmail:string;administratorDisplayName:string}){const token=bearer(auth),code=mfa(otp);try{await this.saas.beginCompanyProvisioning(token,code,{name:body.name,administratorEmail:body.administratorEmail});return await this.platform.provisionCompanyForPlatformControl(body);}catch(error){mapError(error);}}
 @Get('companies')@Header('Cache-Control','no-store')async companies(@Headers('authorization')auth:string|undefined){const token=bearer(auth);try{await this.saas.requireOwner(token);const[companies,tenants]=await Promise.all([this.platform.listAllCompaniesForPlatformControl(),this.saas.listTenantsForOwner(token)]),byId=new Map(tenants.map(v=>[v.companyId,v] as const));return companies.map(company=>({company,...(byId.get(company.id)??{companyId:company.id,companyCode:null,mode:null,status:'SUBSCRIPTION_REQUIRED',allowed:false,planId:null,currentPeriodEnd:null,gracePeriodEnd:null,entitlements:[],reason:'SUBSCRIPTION_REQUIRED',subscriptionId:null,subscriptionVersion:null})}));}catch(error){mapError(error);}}
 @Get('plans')@Header('Cache-Control','no-store')async plans(@Headers('authorization')auth:string|undefined){try{return await this.saas.listPlansForOwner(bearer(auth));}catch(error){mapError(error);}}
 @Post('plans')async createPlan(@Headers('authorization')auth:string|undefined,@Headers('x-owner-totp')otp:string|undefined,@Body()body:{code:string;name:string;intervalMonths:number;priceMinor:number;currency:string;entitlements:string[]}){try{return await this.saas.createPlan(bearer(auth),mfa(otp),body);}catch(error){mapError(error);}}
 @Post('companies/:companyId/activate')async activate(@Headers('authorization')auth:string|undefined,@Headers('x-owner-totp')otp:string|undefined,@Param('companyId')companyId:string,@Body()body:{planId:string;months:number;paymentReference:string;amountMinor:number;currency:string;idempotencyKey:string}){try{const companies=await this.platform.listAllCompaniesForPlatformControl();if(!companies.some(company=>company.id===companyId))throw new SaasError('NOT_FOUND','company was not found');return await this.saas.activateSubscription(bearer(auth),mfa(otp),{companyId,...body});}catch(error){mapError(error);}}
 @Post('companies/:companyId/renew')async renew(@Headers('authorization')auth:string|undefined,@Headers('x-owner-totp')otp:string|undefined,@Param('companyId')companyId:string,@Body()body:{months:number;paymentReference:string;amountMinor:number;currency:string;idempotencyKey:string}){try{return await this.saas.renewSubscription(bearer(auth),mfa(otp),{companyId,...body});}catch(error){mapError(error);}}
 @Post('companies/:companyId/suspend')async suspend(@Headers('authorization')auth:string|undefined,@Headers('x-owner-totp')otp:string|undefined,@Param('companyId')companyId:string){try{return await this.saas.suspendSubscription(bearer(auth),mfa(otp),companyId);}catch(error){mapError(error);}}
 @Post('companies/:companyId/resume')async resume(@Headers('authorization')auth:string|undefined,@Headers('x-owner-totp')otp:string|undefined,@Param('companyId')companyId:string){try{return await this.saas.resumeSubscription(bearer(auth),mfa(otp),companyId);}catch(error){mapError(error);}}
 @Post('companies/:companyId/cancel')async cancel(@Headers('authorization')auth:string|undefined,@Headers('x-owner-totp')otp:string|undefined,@Param('companyId')companyId:string){try{return await this.saas.cancelSubscription(bearer(auth),mfa(otp),companyId);}catch(error){mapError(error);}}
 @Post('companies/:companyId/platform-suspend')async platformSuspend(@Headers('authorization')auth:string|undefined,@Headers('x-owner-totp')otp:string|undefined,@Param('companyId')companyId:string){try{const owner=await this.saas.requireSensitiveOwner(bearer(auth),mfa(otp));return await this.platform.updateCompany(owner.id,companyId,{active:false});}catch(error){mapError(error);}}
 @Post('companies/:companyId/platform-resume')async platformResume(@Headers('authorization')auth:string|undefined,@Headers('x-owner-totp')otp:string|undefined,@Param('companyId')companyId:string){try{const owner=await this.saas.requireSensitiveOwner(bearer(auth),mfa(otp));return await this.platform.updateCompany(owner.id,companyId,{active:true});}catch(error){mapError(error);}}
}
