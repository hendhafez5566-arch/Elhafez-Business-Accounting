import type{Program,ProgramHistory,ProgramVersion}from'../domain/program.js';
export interface ProgramRepository{
 create(p:Program,v:ProgramVersion,h:ProgramHistory):Promise<Program>;
 save(p:Program,h:ProgramHistory,v?:ProgramVersion):Promise<Program>;
 closeReturnedGuarded(p:Program,h:ProgramHistory,expectedUpdatedAt:string):Promise<Program|null>;
 get(companyId:string,branchId:string,id:string):Promise<Program|null>;
 list(companyId:string,branchId:string):Promise<Program[]>;
 versions(companyId:string,branchId:string,id:string):Promise<ProgramVersion[]>;
}
export const PROGRAM_REPOSITORY=Symbol('PROGRAM_REPOSITORY');
