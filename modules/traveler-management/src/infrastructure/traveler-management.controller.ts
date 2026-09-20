import { Body, Controller, Get, Headers, Param, Patch, Post, Query, UnauthorizedException } from '@nestjs/common';
import { executionContext, type ExecutionContext } from '@elhafez/contracts';
import { PlatformCoreApplicationService } from '@elhafez/platform-core';
import { TravelerManagementApplicationService } from '../application/traveler-management.application-service.js';
import type { LegacyPassportRecord } from '../domain/legacy-import.js';
import { travelerId, type CreateTravelDocumentInput, type CreateTravelerInput, type TravelerStatus, type UpdateTravelerInput } from '../domain/traveler.js';

@Controller('crm/travelers')
export class TravelerManagementController {
  static readonly runtimeDependencies = [TravelerManagementApplicationService, PlatformCoreApplicationService] as const;
  constructor(private readonly service: TravelerManagementApplicationService, private readonly platform: PlatformCoreApplicationService) {}

  @Get() async list(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') company:string|undefined,@Headers('x-branch-id') branch:string|undefined,@Query('customerId') customerId?:string,@Query('partyId') partyId?:string,@Query('q') query?:string,@Query('status') status?:TravelerStatus) {
    return this.service.list(await this.context(auth,company,branch), { ...(customerId?{customerId}:{}), ...(partyId?{partyId}:{}), ...(query?{query}:{}), ...(status?{status}:{}) });
  }
  @Post() async create(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') company:string|undefined,@Headers('x-branch-id') branch:string|undefined,@Body() body:CreateTravelerInput) { return this.service.createTraveler(await this.context(auth,company,branch),body); }
  @Get(':id') async get(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') company:string|undefined,@Headers('x-branch-id') branch:string|undefined,@Param('id') id:string) { return this.service.get(await this.context(auth,company,branch),travelerId(id)); }
  @Patch(':id') async update(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') company:string|undefined,@Headers('x-branch-id') branch:string|undefined,@Param('id') id:string,@Body() body:UpdateTravelerInput) { return this.service.update(await this.context(auth,company,branch),travelerId(id),body); }
  @Post(':id/archive') async archive(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') company:string|undefined,@Headers('x-branch-id') branch:string|undefined,@Param('id') id:string) { return this.service.archive(await this.context(auth,company,branch),travelerId(id)); }
  @Post(':id/reactivate') async reactivate(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') company:string|undefined,@Headers('x-branch-id') branch:string|undefined,@Param('id') id:string) { return this.service.reactivate(await this.context(auth,company,branch),travelerId(id)); }
  @Get(':id/documents') async documents(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') company:string|undefined,@Headers('x-branch-id') branch:string|undefined,@Param('id') id:string) { return this.service.listDocuments(await this.context(auth,company,branch),travelerId(id)); }
  @Post(':id/documents') async addDocument(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') company:string|undefined,@Headers('x-branch-id') branch:string|undefined,@Param('id') id:string,@Body() body:CreateTravelDocumentInput) { return this.service.addDocument(await this.context(auth,company,branch),travelerId(id),body); }
  @Post('legacy-imports') async legacy(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') company:string|undefined,@Headers('x-branch-id') branch:string|undefined,@Body() body:LegacyPassportRecord) { return this.service.importLegacyPassport(await this.context(auth,company,branch),body); }
  @Get('legacy-imports/history') async legacyHistory(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') company:string|undefined,@Headers('x-branch-id') branch:string|undefined) { return this.service.legacyImportHistory(await this.context(auth,company,branch)); }

  private async context(auth:string|undefined,company:string|undefined,branch:string|undefined):Promise<ExecutionContext>{
    if(!auth?.startsWith('Bearer ')||!company||!branch) throw new UnauthorizedException('authenticated company and branch context required');
    const user=await this.platform.currentUser(auth.slice(7));
    return executionContext(company,branch,user.id);
  }
}
