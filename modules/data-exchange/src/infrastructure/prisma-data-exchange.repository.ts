import type {PrismaClient} from '@prisma/client';
import type {DataExchangeRepository,ExchangeJob,ExchangeRow,ExchangeStatus} from '../application/data-exchange.application-service.js';

type StoredJob={id:string;companyId:string;branchId:string|null;dataset:string|null;direction:string;status:string;fileName:string;format:string;mapping:unknown;idempotencyKey:string;resultKey:string|null;createdAt:Date;updatedAt:Date;rows:Array<{rowNumber:number;source:unknown;outcome:string;error:string|null}>};
const hydrate=(value:StoredJob):ExchangeJob=>({
 id:value.id,companyId:value.companyId,branchId:value.branchId,dataset:value.dataset,direction:value.direction as ExchangeJob['direction'],status:value.status as ExchangeStatus,
 fileName:value.fileName,format:value.format as ExchangeJob['format'],mapping:value.mapping as Record<string,string>,idempotencyKey:value.idempotencyKey,
 resultKey:value.resultKey??undefined,createdAt:value.createdAt,updatedAt:value.updatedAt,
 rows:value.rows.map(row=>({rowNumber:row.rowNumber,source:row.source as Record<string,string>,outcome:row.outcome as ExchangeRow['outcome'],error:row.error??undefined}))
});

export class PrismaDataExchangeRepository implements DataExchangeRepository{
 constructor(private readonly prisma:PrismaClient){}
 async save(job:ExchangeJob){
  await this.prisma.$transaction(async tx=>{
   await tx.dexJob.upsert({
    where:{id:job.id},
    create:{id:job.id,companyId:job.companyId,branchId:job.branchId,dataset:job.dataset,direction:job.direction,status:job.status,fileName:job.fileName,format:job.format,mapping:job.mapping as never,idempotencyKey:job.idempotencyKey,resultKey:job.resultKey,createdAt:job.createdAt,updatedAt:job.updatedAt},
    update:{status:job.status,resultKey:job.resultKey,mapping:job.mapping as never,updatedAt:job.updatedAt}
   });
   for(const row of job.rows)await tx.dexRow.upsert({
    where:{jobId_rowNumber:{jobId:job.id,rowNumber:row.rowNumber}},
    create:{jobId:job.id,rowNumber:row.rowNumber,source:row.source as never,outcome:row.outcome,error:row.error},
    update:{source:row.source as never,outcome:row.outcome,error:row.error}
   });
  });
 }
 async find(companyId:string,id:string){const value=await this.prisma.dexJob.findFirst({where:{id,companyId},include:{rows:{orderBy:{rowNumber:'asc'}}}});return value?hydrate(value):undefined;}
 async findByKey(companyId:string,key:string){const value=await this.prisma.dexJob.findUnique({where:{companyId_idempotencyKey:{companyId,idempotencyKey:key}},include:{rows:{orderBy:{rowNumber:'asc'}}}});return value?hydrate(value):undefined;}
 async list(companyId:string){return (await this.prisma.dexJob.findMany({where:{companyId},include:{rows:{orderBy:{rowNumber:'asc'}}},orderBy:{createdAt:'desc'}})).map(hydrate);}
}
