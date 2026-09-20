import { Body, Controller, Get, Headers, Param, Patch, Post, Query, UnauthorizedException } from '@nestjs/common';
import { executionContext, type ExecutionContext } from '@elhafez/contracts';
import { PlatformCoreApplicationService } from '@elhafez/platform-core';
import { SupplierManagementApplicationService, type BankAccountInput, type CreateSupplierInput, type LegacySupplierInput, type UpdateSupplierInput } from '../application/supplier-management.application-service.js';
import { supplierBankAccountId, supplierId, type SupplierStatus } from '../domain/supplier.js';

@Controller('suppliers')
export class SupplierController {
  static readonly runtimeDependencies=[SupplierManagementApplicationService,PlatformCoreApplicationService] as const;
  constructor(private readonly service:SupplierManagementApplicationService,private readonly platform:PlatformCoreApplicationService) {}

  @Get() async list(@Headers('authorization')a:string|undefined,@Headers('x-company-id')c:string|undefined,@Headers('x-branch-id')b:string|undefined,@Query('status')status:SupplierStatus|undefined,@Query('q')query:string|undefined){return this.service.list(await this.context(a,c,b),status,query);}
  @Post() async create(@Headers('authorization')a:string|undefined,@Headers('x-company-id')c:string|undefined,@Headers('x-branch-id')b:string|undefined,@Body()input:CreateSupplierInput){return this.service.create(await this.context(a,c,b),input);}
  @Get(':id') async get(@Headers('authorization')a:string|undefined,@Headers('x-company-id')c:string|undefined,@Headers('x-branch-id')b:string|undefined,@Param('id')id:string){return this.service.get(await this.context(a,c,b),supplierId(id));}
  @Patch(':id') async update(@Headers('authorization')a:string|undefined,@Headers('x-company-id')c:string|undefined,@Headers('x-branch-id')b:string|undefined,@Param('id')id:string,@Body()input:UpdateSupplierInput){return this.service.update(await this.context(a,c,b),supplierId(id),input);}
  @Post(':id/approval') async approve(@Headers('authorization')a:string|undefined,@Headers('x-company-id')c:string|undefined,@Headers('x-branch-id')b:string|undefined,@Param('id')id:string,@Body()input:{decision:'APPROVED'|'REJECTED';reason?:string}){return this.service.decide(await this.context(a,c,b),supplierId(id),input.decision,input.reason);}
  @Post(':id/deactivate') async deactivate(@Headers('authorization')a:string|undefined,@Headers('x-company-id')c:string|undefined,@Headers('x-branch-id')b:string|undefined,@Param('id')id:string){return this.service.deactivate(await this.context(a,c,b),supplierId(id));}
  @Post(':id/reactivate') async reactivate(@Headers('authorization')a:string|undefined,@Headers('x-company-id')c:string|undefined,@Headers('x-branch-id')b:string|undefined,@Param('id')id:string){return this.service.reactivate(await this.context(a,c,b),supplierId(id));}
  @Post(':id/hold') async hold(@Headers('authorization')a:string|undefined,@Headers('x-company-id')c:string|undefined,@Headers('x-branch-id')b:string|undefined,@Param('id')id:string){return this.service.hold(await this.context(a,c,b),supplierId(id));}
  @Post(':id/release-hold') async releaseHold(@Headers('authorization')a:string|undefined,@Headers('x-company-id')c:string|undefined,@Headers('x-branch-id')b:string|undefined,@Param('id')id:string){return this.service.releaseHold(await this.context(a,c,b),supplierId(id));}
  @Get(':id/bank-accounts') async banks(@Headers('authorization')a:string|undefined,@Headers('x-company-id')c:string|undefined,@Headers('x-branch-id')b:string|undefined,@Param('id')id:string){return this.service.listBankAccounts(await this.context(a,c,b),supplierId(id));}
  @Post(':id/bank-accounts') async addBank(@Headers('authorization')a:string|undefined,@Headers('x-company-id')c:string|undefined,@Headers('x-branch-id')b:string|undefined,@Param('id')id:string,@Body()input:BankAccountInput){return this.service.addBankAccount(await this.context(a,c,b),supplierId(id),input);}
  @Patch(':id/bank-accounts/:bankId') async editBank(@Headers('authorization')a:string|undefined,@Headers('x-company-id')c:string|undefined,@Headers('x-branch-id')b:string|undefined,@Param('id')id:string,@Param('bankId')bankId:string,@Body()input:BankAccountInput){return this.service.updateBankAccount(await this.context(a,c,b),supplierId(id),supplierBankAccountId(bankId),input);}
  @Post(':id/bank-accounts/:bankId/default') async defaultBank(@Headers('authorization')a:string|undefined,@Headers('x-company-id')c:string|undefined,@Headers('x-branch-id')b:string|undefined,@Param('id')id:string,@Param('bankId')bankId:string){return this.service.setDefaultBankAccount(await this.context(a,c,b),supplierId(id),supplierBankAccountId(bankId));}
  @Post('legacy/import') async legacy(@Headers('authorization')a:string|undefined,@Headers('x-company-id')c:string|undefined,@Headers('x-branch-id')b:string|undefined,@Body()input:LegacySupplierInput){return this.service.importLegacySupplier(await this.context(a,c,b),input);}

  private async context(authorization:string|undefined,companyId:string|undefined,branchId:string|undefined):Promise<ExecutionContext>{
    if(!authorization?.startsWith('Bearer ')||!companyId||!branchId)throw new UnauthorizedException('authenticated company and branch context required');
    const user=await this.platform.currentUser(authorization.slice(7));
    return executionContext(companyId,branchId,user.id);
  }
}
