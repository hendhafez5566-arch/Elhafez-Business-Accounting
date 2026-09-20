import{Body,Inject,Controller,Delete,Get,Headers,Param,Patch,Post,Query,UnauthorizedException}from'@nestjs/common';import{executionContext,type ExecutionContext}from'@elhafez/contracts';import{PlatformCoreApplicationService}from'@elhafez/platform-core';import{CustomerManagementApplicationService,type CreateCustomerInput,type UpdateCustomerInput}from'../application/customer-management.application-service.js';import{customerId,type CustomerStatus}from'../domain/customer.js';export class CustomerController{constructor(private readonly s:CustomerManagementApplicationService,private readonly p:PlatformCoreApplicationService){}async list(a:string|undefined,c:string|undefined,b:string|undefined,st:CustomerStatus|undefined,q:string|undefined){return this.s.list(await this.ctx(a,c,b),st,q);}async create(a:string|undefined,c:string|undefined,b:string|undefined,x:CreateCustomerInput){return this.s.create(await this.ctx(a,c,b),x);}async update(a:string|undefined,c:string|undefined,b:string|undefined,id:string,x:UpdateCustomerInput){return this.s.update(await this.ctx(a,c,b),customerId(id),x);}async suspend(a:string|undefined,c:string|undefined,b:string|undefined,id:string){return this.s.suspend(await this.ctx(a,c,b),customerId(id));}async reactivate(a:string|undefined,c:string|undefined,b:string|undefined,id:string){return this.s.reactivate(await this.ctx(a,c,b),customerId(id));}async remove(a:string|undefined,c:string|undefined,b:string|undefined,id:string){await this.s.hardDelete(await this.ctx(a,c,b),customerId(id));return{deleted:true};}private async ctx(a:string|undefined,c:string|undefined,b:string|undefined):Promise<ExecutionContext>{if(!a?.startsWith('Bearer ')||!c||!b)throw new UnauthorizedException('authenticated company and branch context required');const u=await this.p.currentUser(a.slice(7));return executionContext(c,b,u.id);}}
Controller('crm/customers')(CustomerController);
Get()(CustomerController.prototype,'list',Object.getOwnPropertyDescriptor(CustomerController.prototype,'list')!);
Post()(CustomerController.prototype,'create',Object.getOwnPropertyDescriptor(CustomerController.prototype,'create')!);
Patch(':id')(CustomerController.prototype,'update',Object.getOwnPropertyDescriptor(CustomerController.prototype,'update')!);
Post(':id/suspend')(CustomerController.prototype,'suspend',Object.getOwnPropertyDescriptor(CustomerController.prototype,'suspend')!);
Post(':id/reactivate')(CustomerController.prototype,'reactivate',Object.getOwnPropertyDescriptor(CustomerController.prototype,'reactivate')!);
Delete(':id')(CustomerController.prototype,'remove',Object.getOwnPropertyDescriptor(CustomerController.prototype,'remove')!);



Headers('authorization')(CustomerController.prototype,'list',0);
Headers('x-company-id')(CustomerController.prototype,'list',1);
Headers('x-branch-id')(CustomerController.prototype,'list',2);
Query('status')(CustomerController.prototype,'list',3);
Query('q')(CustomerController.prototype,'list',4);
Headers('authorization')(CustomerController.prototype,'create',0);
Headers('x-company-id')(CustomerController.prototype,'create',1);
Headers('x-branch-id')(CustomerController.prototype,'create',2);
Body()(CustomerController.prototype,'create',3);
Headers('authorization')(CustomerController.prototype,'update',0);
Headers('x-company-id')(CustomerController.prototype,'update',1);
Headers('x-branch-id')(CustomerController.prototype,'update',2);
Param('id')(CustomerController.prototype,'update',3);
Body()(CustomerController.prototype,'update',4);
Headers('authorization')(CustomerController.prototype,'suspend',0);
Headers('x-company-id')(CustomerController.prototype,'suspend',1);
Headers('x-branch-id')(CustomerController.prototype,'suspend',2);
Param('id')(CustomerController.prototype,'suspend',3);
Headers('authorization')(CustomerController.prototype,'reactivate',0);
Headers('x-company-id')(CustomerController.prototype,'reactivate',1);
Headers('x-branch-id')(CustomerController.prototype,'reactivate',2);
Param('id')(CustomerController.prototype,'reactivate',3);
Headers('authorization')(CustomerController.prototype,'remove',0);
Headers('x-company-id')(CustomerController.prototype,'remove',1);
Headers('x-branch-id')(CustomerController.prototype,'remove',2);
Param('id')(CustomerController.prototype,'remove',3);
Inject(CustomerManagementApplicationService)(CustomerController,undefined,0);
Inject(PlatformCoreApplicationService)(CustomerController,undefined,1);
