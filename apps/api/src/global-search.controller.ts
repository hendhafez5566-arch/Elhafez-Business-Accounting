import{Controller,Get,Headers,Inject,Query,UnauthorizedException}from'@nestjs/common';
import{executionContext,type ExecutionContext}from'@elhafez/contracts';
import{PlatformCoreApplicationService}from'@elhafez/platform-core';
import{CustomerManagementApplicationService}from'@elhafez/customer-management';
import{CrmLeadsApplicationService}from'@elhafez/crm-leads';
import{QuotationsApplicationService}from'@elhafez/quotations';
import{SupplierManagementApplicationService}from'@elhafez/supplier-management';
import{TravelerManagementApplicationService}from'@elhafez/traveler-management';
import{TourismProgramsApplicationService}from'@elhafez/tourism-programs';
import{HajjUmrahProgramsApplicationService}from'@elhafez/hajj-umrah-programs';

type SearchItem={kind:string;id:string;title:string;subtitle:string;route:string};
@Controller('search')
export class GlobalSearchController{
 constructor(
  @Inject(PlatformCoreApplicationService)private readonly platform:PlatformCoreApplicationService,
  @Inject(CustomerManagementApplicationService)private readonly customers:CustomerManagementApplicationService,
  @Inject(CrmLeadsApplicationService)private readonly leads:CrmLeadsApplicationService,
  @Inject(QuotationsApplicationService)private readonly quotations:QuotationsApplicationService,
  @Inject(SupplierManagementApplicationService)private readonly suppliers:SupplierManagementApplicationService,
  @Inject(TravelerManagementApplicationService)private readonly travelers:TravelerManagementApplicationService,
  @Inject(TourismProgramsApplicationService)private readonly tourism:TourismProgramsApplicationService,
  @Inject(HajjUmrahProgramsApplicationService)private readonly umrah:HajjUmrahProgramsApplicationService,
 ){}
 @Get()
 async search(@Headers('authorization')a?:string,@Headers('x-company-id')company?:string,@Headers('x-branch-id')branch?:string,@Query('q')q=''){
  const c=await this.ctx(a,company,branch),query=q.trim();if(query.length<2)return[];
  const groups=await Promise.all([
   this.safe(async()=> (await this.customers.list(c,undefined,query)).slice(0,8).map(x=>({kind:'CUSTOMER',id:x.customer.id,title:x.party.displayName,subtitle:x.customer.number,route:'/crm/customers'}))),
   this.safe(async()=> (await this.leads.list(c,{query})).slice(0,8).map(x=>({kind:'LEAD',id:x.id,title:x.displayName,subtitle:x.number+' · '+x.status,route:'/crm/leads'}))),
   this.safe(async()=> (await this.quotations.list(c,query)).slice(0,8).map(x=>({kind:'QUOTATION',id:x.id,title:x.customerSnapshot.displayName,subtitle:x.number+' · '+x.status,route:'/crm/quotations'}))),
   this.safe(async()=> (await this.suppliers.list(c,undefined,query)).slice(0,8).map(x=>({kind:'SUPPLIER',id:x.supplier.id,title:x.party.displayName,subtitle:x.supplier.supplierCode,route:'/suppliers'}))),
   this.safe(async()=> (await this.travelers.list(c,{query})).slice(0,8).map(x=>({kind:'TRAVELER',id:x.id,title:x.fullName,subtitle:x.nationality??'',route:'/crm/travelers'}))),
   this.safe(async()=> (await this.tourism.list(c)).filter(x=>(x.code+' '+x.nameAr+' '+(x.nameEn??'')).toLowerCase().includes(query.toLowerCase())).slice(0,8).map(x=>({kind:'TOURISM_PROGRAM',id:x.id,title:x.nameAr,subtitle:x.code+' · '+x.status,route:'/tourism/programs'}))),
   this.safe(async()=> (await this.umrah.list(c)).filter(x=>(x.code+' '+x.nameAr+' '+(x.nameEn??'')).toLowerCase().includes(query.toLowerCase())).slice(0,8).map(x=>({kind:'HAJJ_UMRAH_PROGRAM',id:x.id,title:x.nameAr,subtitle:x.code+' · '+x.status,route:'/hajj-umrah/programs'}))),
  ]);
  return groups.flat().slice(0,30) as SearchItem[];
 }
 @Get('quick-actions')
 async quickActions(@Headers('authorization')a?:string,@Headers('x-company-id')company?:string,@Headers('x-branch-id')branch?:string){
  const c=await this.ctx(a,company,branch);
  const candidates=[
   {permission:'crm.lead.manage',label:'عميل محتمل جديد',route:'/crm/leads',action:'create-lead'},
   {permission:'crm.quotation.manage',label:'عرض سعر جديد',route:'/crm/quotations',action:'create-quotation'},
   {permission:'procurement.sourcing.manage',label:'طلب شراء جديد',route:'/procurement/sourcing',action:'create-requisition'},
   {permission:'tourism.bookings.manage',label:'حجز سياحة جديد',route:'/tourism/bookings',action:'create-tourism-booking'},
   {permission:'hajj_umrah.bookings.manage',label:'حجز حج/عمرة جديد',route:'/hajj-umrah/bookings',action:'create-hajj-umrah-booking'},
   {permission:'collections.manage',label:'فتح متابعة تحصيل',route:'/accounting/collections',action:'open-collection'},
   {permission:'documents.manage',label:'إرفاق مستند',route:'/documents',action:'attach-document'},
  ];
  const out=[];for(const item of candidates)if(await this.allowed(c,item.permission))out.push(item);return out;
 }
 private async safe<T>(fn:()=>Promise<T[]>):Promise<T[]>{try{return await fn()}catch(error){if(this.platform.toError(error).status===403)return[];throw error}}
 private async allowed(c:ExecutionContext,p:string){try{await this.platform.authorize(c.actorId,c.companyId,p);return true}catch{return false}}
 private async ctx(a?:string,company?:string,branch?:string):Promise<ExecutionContext>{if(!a?.startsWith('Bearer ')||!company||!branch)throw new UnauthorizedException('authenticated company and branch required');const user=await this.platform.currentUser(a.slice(7));await this.platform.requireBranchAccess(user.id,company,branch);return executionContext(company,branch,user.id)}
}
