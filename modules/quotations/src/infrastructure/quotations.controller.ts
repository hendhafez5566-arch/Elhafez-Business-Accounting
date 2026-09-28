import { Body, Controller, Get, Headers, Param, Patch, Post, Query, UnauthorizedException } from '@nestjs/common';
import { executionContext, type ExecutionContext } from '@elhafez/contracts';
import { PlatformCoreApplicationService } from '@elhafez/platform-core';
import { QuotationsApplicationService } from '../application/quotations.application-service.js';
import type { BillingConversionInput } from '../application/quotations-dependencies.port.js';
import type { CreateQuotationCommunicationInput, CreateQuotationInput, EditQuotationInput, LineInput } from '../domain/quotation.js';

@Controller('crm/quotations')
export class QuotationsController {
  static readonly runtimeDependencies = [QuotationsApplicationService, PlatformCoreApplicationService] as const;
  constructor(private readonly service: QuotationsApplicationService, private readonly platform: PlatformCoreApplicationService) {}

  @Get('templates') async templates(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') company:string|undefined,@Headers('x-branch-id') branch:string|undefined){return this.service.templates(await this.context(auth,company,branch));}
  @Post('templates') async template(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') company:string|undefined,@Headers('x-branch-id') branch:string|undefined,@Body() body:{id?:string;code:string;name:string;currency:string;defaultValidityDays:number;terms?:string|null;notes?:string|null;lines:readonly LineInput[];active?:boolean}){return this.service.saveTemplate(await this.context(auth,company,branch),body);}
  @Post('templates/:id/create') async fromTemplate(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') company:string|undefined,@Headers('x-branch-id') branch:string|undefined,@Param('id') id:string,@Body() body:{customerId?:string;sourceLeadId?:string;customerSnapshot?:{displayName?:string;contactName?:string|null;phone?:string|null;email?:string|null};validityDate?:string;notes?:string;terms?:string}){return this.service.createFromTemplate(await this.context(auth,company,branch),id,body);}
  @Post('expire-due') async expireDue(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') company:string|undefined,@Headers('x-branch-id') branch:string|undefined,@Body() body:{asOf?:string}){return this.service.expireDue(await this.context(auth,company,branch),body.asOf?new Date(body.asOf):undefined);}
  @Get() async list(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') company:string|undefined,@Headers('x-branch-id') branch:string|undefined,@Query('q') query?:string){return this.service.list(await this.context(auth,company,branch),query);}
  @Post() async create(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') company:string|undefined,@Headers('x-branch-id') branch:string|undefined,@Body() body:CreateQuotationInput){return this.service.create(await this.context(auth,company,branch),body);}
  @Get(':id') async get(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') company:string|undefined,@Headers('x-branch-id') branch:string|undefined,@Param('id') id:string){return this.service.get(await this.context(auth,company,branch),id);}
  @Patch(':id') async edit(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') company:string|undefined,@Headers('x-branch-id') branch:string|undefined,@Param('id') id:string,@Body() body:EditQuotationInput){return this.service.edit(await this.context(auth,company,branch),id,body);}
  @Post(':id/clone') async clone(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') company:string|undefined,@Headers('x-branch-id') branch:string|undefined,@Param('id') id:string){return this.service.clone(await this.context(auth,company,branch),id);}
  @Post(':id/send') async send(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') company:string|undefined,@Headers('x-branch-id') branch:string|undefined,@Param('id') id:string){return this.service.send(await this.context(auth,company,branch),id);}
  @Post(':id/approval') async approval(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') company:string|undefined,@Headers('x-branch-id') branch:string|undefined,@Param('id') id:string,@Body() body:{approved:boolean;reason:string}){return this.service.decideApproval(await this.context(auth,company,branch),id,body.approved,body.reason);}
  @Post(':id/accept') async accept(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') company:string|undefined,@Headers('x-branch-id') branch:string|undefined,@Param('id') id:string){return this.service.accept(await this.context(auth,company,branch),id);}
  @Post(':id/reject') async reject(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') company:string|undefined,@Headers('x-branch-id') branch:string|undefined,@Param('id') id:string,@Body() body:{reason:string}){return this.service.reject(await this.context(auth,company,branch),id,body.reason);}
  @Post(':id/expire') async expire(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') company:string|undefined,@Headers('x-branch-id') branch:string|undefined,@Param('id') id:string,@Body() body:{asOf?:string}){return this.service.expire(await this.context(auth,company,branch),id,body.asOf?new Date(body.asOf):undefined);}
  @Post(':id/convert') async convert(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') company:string|undefined,@Headers('x-branch-id') branch:string|undefined,@Param('id') id:string,@Body() body:BillingConversionInput){return this.service.convert(await this.context(auth,company,branch),id,body);}
  @Get(':id/communications') async communications(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') company:string|undefined,@Headers('x-branch-id') branch:string|undefined,@Param('id') id:string){return this.service.communications(await this.context(auth,company,branch),id);}
  @Post(':id/communications') async recordCommunication(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') company:string|undefined,@Headers('x-branch-id') branch:string|undefined,@Param('id') id:string,@Body() body:CreateQuotationCommunicationInput){return this.service.recordCommunication(await this.context(auth,company,branch),id,body);}

  private async context(auth:string|undefined,company:string|undefined,branch:string|undefined):Promise<ExecutionContext>{
    if(!auth?.startsWith('Bearer ')||!company||!branch) throw new UnauthorizedException('authenticated company and branch context required');
    const user=await this.platform.currentUser(auth.slice(7));
    return executionContext(company,branch,user.id);
  }
}
