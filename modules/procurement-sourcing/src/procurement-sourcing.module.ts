import{Module}from'@nestjs/common';
import{PrismaClient}from'@prisma/client';
import{PlatformCoreApplicationService,PlatformCoreModule}from'@elhafez/platform-core';
import{SupplierManagementApplicationService}from'@elhafez/supplier-management';
import{SupplierManagementModule}from'@elhafez/supplier-management/nest';
import{ProcurementFinanceApplicationService}from'@elhafez/procurement-finance';
import{ProcurementFinanceModule}from'@elhafez/procurement-finance/nest';
import{PROCUREMENT_SOURCING_ACCESS,type ProcurementSourcingAccess}from'./application/procurement-sourcing.access.js';
import{SOURCING_PROCUREMENT_PORT,SOURCING_SUPPLIER_PORT,type SourcingProcurementPort,type SourcingSupplierPort}from'./application/procurement-sourcing.ports.js';
import{PROCUREMENT_SOURCING_REPOSITORY,type ProcurementSourcingRepository}from'./application/procurement-sourcing.repository.js';
import{ProcurementSourcingApplicationService}from'./application/procurement-sourcing.application-service.js';
import{PlatformProcurementSourcingAccess}from'./infrastructure/platform-procurement-sourcing.access.js';
import{PrismaProcurementSourcingRepository}from'./infrastructure/prisma-procurement-sourcing.repository.js';
import{ProcurementSourcingController}from'./infrastructure/procurement-sourcing.controller.js';

class SupplierAdapter implements SourcingSupplierPort{
 constructor(private readonly suppliers:SupplierManagementApplicationService){}
 async assertUsable(companyId:Parameters<SourcingSupplierPort['assertUsable']>[0],reference:string){const value=await this.suppliers.assertSupplierReferenceUsableForProcurementForIntegration(companyId,reference);return{partyId:value.partyId};}
}
class ProcurementAdapter implements SourcingProcurementPort{
 constructor(private readonly procurement:ProcurementFinanceApplicationService){}
 createPurchaseOrder(input:Parameters<SourcingProcurementPort['createPurchaseOrder']>[0]){return this.procurement.createPurchaseOrder(input);}
 getPurchaseOrder(companyId:Parameters<SourcingProcurementPort['getPurchaseOrder']>[0],branchId:string,id:string){return this.procurement.getPurchaseOrderForBranch(companyId,branchId,id);}
}
@Module({
 imports:[PlatformCoreModule,SupplierManagementModule,ProcurementFinanceModule],
 controllers:[ProcurementSourcingController],
 providers:[
  PrismaClient,
  {provide:PROCUREMENT_SOURCING_REPOSITORY,useFactory:(db:PrismaClient)=>new PrismaProcurementSourcingRepository(db),inject:[PrismaClient]},
  {provide:PROCUREMENT_SOURCING_ACCESS,useFactory:(platform:PlatformCoreApplicationService)=>new PlatformProcurementSourcingAccess(platform),inject:[PlatformCoreApplicationService]},
  {provide:SOURCING_SUPPLIER_PORT,useFactory:(suppliers:SupplierManagementApplicationService)=>new SupplierAdapter(suppliers),inject:[SupplierManagementApplicationService]},
  {provide:SOURCING_PROCUREMENT_PORT,useFactory:(procurement:ProcurementFinanceApplicationService)=>new ProcurementAdapter(procurement),inject:[ProcurementFinanceApplicationService]},
  {provide:ProcurementSourcingApplicationService,useFactory:(repo:ProcurementSourcingRepository,suppliers:SourcingSupplierPort,procurement:SourcingProcurementPort,access:ProcurementSourcingAccess)=>new ProcurementSourcingApplicationService(repo,suppliers,procurement,access),inject:[PROCUREMENT_SOURCING_REPOSITORY,SOURCING_SUPPLIER_PORT,SOURCING_PROCUREMENT_PORT,PROCUREMENT_SOURCING_ACCESS]},
 ],
 exports:[ProcurementSourcingApplicationService],
})
export class ProcurementSourcingModule{}
