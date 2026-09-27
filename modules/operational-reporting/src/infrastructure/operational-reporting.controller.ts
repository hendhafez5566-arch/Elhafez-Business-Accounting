import{Body,Controller,Get,Headers,Inject,Param,Patch,Post,Query,UnauthorizedException}from'@nestjs/common';
import{PlatformCoreApplicationService}from'@elhafez/platform-core';
import{OperationalReportingApplicationService,type CreateReportScheduleInput,type CreateSavedReportInput,type OperationalReportingContext,type UpdateReportScheduleInput,type UpdateSavedReportInput}from'../application/operational-reporting.application-service.js';

@Controller('operational-reporting')
export class OperationalReportingController{
 constructor(@Inject(OperationalReportingApplicationService)private readonly service:OperationalReportingApplicationService,@Inject(PlatformCoreApplicationService)private readonly platform:PlatformCoreApplicationService){}
 @Get('saved-reports')async savedReports(@Headers('authorization')authorization?:string,@Headers('x-company-id')companyId?:string){return this.service.listSavedReports(await this.context(authorization,companyId));}
 @Post('saved-reports')async createSavedReport(@Headers('authorization')authorization:string|undefined,@Headers('x-company-id')companyId:string|undefined,@Body()input:CreateSavedReportInput){return this.service.createSavedReport(await this.context(authorization,companyId),input);}
 @Patch('saved-reports/:id')async updateSavedReport(@Headers('authorization')authorization:string|undefined,@Headers('x-company-id')companyId:string|undefined,@Param('id')id:string,@Body()input:UpdateSavedReportInput){return this.service.updateSavedReport(await this.context(authorization,companyId),id,input);}
 @Get('schedules')async schedules(@Headers('authorization')authorization:string|undefined,@Headers('x-company-id')companyId:string|undefined,@Query('savedReportId')savedReportId?:string){return this.service.listSchedules(await this.context(authorization,companyId),savedReportId);}
 @Post('schedules')async createSchedule(@Headers('authorization')authorization:string|undefined,@Headers('x-company-id')companyId:string|undefined,@Body()input:CreateReportScheduleInput){return this.service.createSchedule(await this.context(authorization,companyId),input);}
 @Patch('schedules/:id')async updateSchedule(@Headers('authorization')authorization:string|undefined,@Headers('x-company-id')companyId:string|undefined,@Param('id')id:string,@Body()input:UpdateReportScheduleInput){return this.service.updateSchedule(await this.context(authorization,companyId),id,input);}
 private async context(authorization:string|undefined,companyId:string|undefined):Promise<OperationalReportingContext>{if(!authorization?.startsWith('Bearer ')||!companyId)throw new UnauthorizedException('authenticated company context required');const user=await this.platform.currentUser(authorization.slice(7));return{companyId,actorId:user.id};}
}
