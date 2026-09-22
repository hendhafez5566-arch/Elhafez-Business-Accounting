import type{Program,ProgramHistory,ProgramVersion}from'../domain/program.js';
import type{ProgramRepository}from'../application/program.repository.js';
export class InMemoryProgramRepository implements ProgramRepository{
 readonly programs=new Map<string,Program>();readonly versionRows:ProgramVersion[]=[];readonly history:ProgramHistory[]=[];
 private key(c:string,b:string,id:string){return`${c}:${b}:${id}`}
 async create(p:Program,v:ProgramVersion,h:ProgramHistory){if([...this.programs.values()].some(x=>x.companyId===p.companyId&&x.branchId===p.branchId&&x.code===p.code))throw new Error('program code already exists');this.programs.set(this.key(p.companyId,p.branchId,p.id),p);this.versionRows.push(structuredClone(v));this.history.push(h);return p}
 async save(p:Program,h:ProgramHistory,v?:ProgramVersion){this.programs.set(this.key(p.companyId,p.branchId,p.id),p);if(v)this.versionRows.push(structuredClone(v));this.history.push(h);return p}
 async closeReturnedGuarded(p:Program,h:ProgramHistory,expectedUpdatedAt:string){const key=this.key(p.companyId,p.branchId,p.id),current=this.programs.get(key);if(!current||current.status!=='IN_TRIP'||current.updatedAt!==expectedUpdatedAt)return null;this.programs.set(key,p);this.history.push(h);return p}
 async get(c:string,b:string,id:string){return this.programs.get(this.key(c,b,id))??null}
 async list(c:string,b:string){return[...this.programs.values()].filter(x=>x.companyId===c&&x.branchId===b)}
 async versions(c:string,b:string,id:string){return this.versionRows.filter(x=>x.companyId===c&&x.branchId===b&&x.programId===id).map(x=>structuredClone(x))}
}
