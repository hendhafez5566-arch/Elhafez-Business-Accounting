import type { PrismaClient } from '@prisma/client';
import type { WriteAuthority, WriteAuthorityRepository } from '../application/write-authority.application-service.js';
export class PrismaWriteAuthorityRepository implements WriteAuthorityRepository {
 constructor(private readonly db:PrismaClient){}
 async get(companyId:string){const v=await this.db.ocWriteAuthority.findUnique({where:{companyId}});return v?{...v,enrolledAt:v.enrolledAt.toISOString()}:undefined;}
 async enroll(value:WriteAuthority){try{const v=await this.db.ocWriteAuthority.create({data:{companyId:value.companyId,authorityId:value.authorityId,enrolledBy:value.enrolledBy,enrolledAt:new Date(value.enrolledAt)}});return {...v,enrolledAt:v.enrolledAt.toISOString()};}catch(error){const prior=await this.get(value.companyId);if(prior)return prior;throw error;}}
}
