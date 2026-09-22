import {Controller,Get,Headers,Inject,Param} from '@nestjs/common';import {PlatformCoreApplicationService} from '@elhafez/platform-core';import {DataExchangeApplicationService} from '@elhafez/data-exchange';
@Controller('system-administration') export class SystemAdministrationController{constructor(@Inject(PlatformCoreApplicationService) private readonly platform:PlatformCoreApplicationService,@Inject(DataExchangeApplicationService) private readonly exchange:DataExchangeApplicationService){}
@Get('audit') async audit(@Headers('x-company-id') companyId:string){if(!companyId)throw new Error('company context required');return (await this.platform.listAudit()).filter(x=>x.companyId===companyId)}
@Get('imports') imports(@Headers('x-company-id') companyId:string){if(!companyId)throw new Error('company context required');return this.exchange.list(companyId)}
@Get('sessions/:userId') sessions(@Param('userId') userId:string){return this.platform.listSessions(userId)} }
