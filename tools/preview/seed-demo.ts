import {PrismaClient} from '@prisma/client';
import {PlatformCoreApplicationService} from '../../modules/platform-core/src/application/platform-core.application-service.ts';
import {PrismaPlatformRepository} from '../../modules/platform-core/src/infrastructure/prisma-platform.repository.ts';

const COMPANY_CODE='ELH-DEMO-0001';
const COMPANY_NAME='شركة الحافظ التجريبية';
const USERNAME='admin';
const INTERNAL_PASSWORD='admin123-demo!';

const prisma=new PrismaClient();

async function main(){
 const platform=new PlatformCoreApplicationService(new PrismaPlatformRepository(prisma));
 const companies=await platform.listAllCompaniesForPlatformControl();
 let company=companies.find(value=>value.name===COMPANY_NAME)??null;
 if(!company){
  const created=await platform.provisionCompanyForPlatformControl({name:COMPANY_NAME,administratorUsername:USERNAME,temporaryPassword:INTERNAL_PASSWORD,administratorDisplayName:'مدير النسخة التجريبية'});
  company=created.company;
 }
 let session;
 try{session=await platform.loginCompany(company.id,USERNAME,INTERNAL_PASSWORD);}
 catch{
  const users=await platform.listCompanyUsers(company.id),actor=users.find(value=>value.username===USERNAME)??users[0];
  if(!actor)throw new Error('preview demo company has no administrator user');
  await platform.resetCompanyAdministratorCredentials(actor.id,company.id,{username:USERNAME,temporaryPassword:INTERNAL_PASSWORD});
  session=await platform.loginCompany(company.id,USERNAME,INTERNAL_PASSWORD);
 }
 if(session.mustChangePassword){
  await platform.completeInitialPasswordChange(session.token,company.id,INTERNAL_PASSWORD);
 }
 await platform.logout(session.token);
 const existingCode=await prisma.saasTenant.findUnique({where:{companyCode:COMPANY_CODE}});
 if(existingCode&&existingCode.companyId!==company.id)throw new Error('preview company code is already assigned to another company');
 await prisma.saasTenant.upsert({
  where:{companyId:company.id},
  update:{companyCode:COMPANY_CODE,mode:'INTERNAL',updatedAt:new Date()},
  create:{companyId:company.id,companyCode:COMPANY_CODE,mode:'INTERNAL',createdAt:new Date(),updatedAt:new Date()},
 });
 process.stdout.write(`Preview demo ready: ${COMPANY_CODE} / ${USERNAME}\n`);
}

main().finally(async()=>{await prisma.$disconnect();}).catch(error=>{console.error(error);process.exitCode=1;});
