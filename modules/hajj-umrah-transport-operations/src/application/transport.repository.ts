import type { ManifestAssignment, TransportHistory, TransportRun } from '../domain/transport.js';

export interface TransportRepository {
  createRun(value:TransportRun,history:TransportHistory):Promise<TransportRun>;
  saveRun(value:TransportRun,history:TransportHistory):Promise<TransportRun>;
  getRun(companyId:string,branchId:string,id:string):Promise<TransportRun|null>;
  listRuns(companyId:string,branchId:string,programId?:string):Promise<TransportRun[]>;
  assignGuarded(value:ManifestAssignment,history:TransportHistory,run:TransportRun,capacity:number):Promise<ManifestAssignment>;
  saveAssignment(value:ManifestAssignment,history:TransportHistory):Promise<ManifestAssignment>;
  manifest(companyId:string,branchId:string,runId:string):Promise<ManifestAssignment[]>;
  activeManifestCount(companyId:string,branchId:string,runId:string):Promise<number>;
  history(companyId:string,branchId:string,type:'RUN'|'MANIFEST',id:string):Promise<TransportHistory[]>;
}
export const TRANSPORT_REPOSITORY=Symbol('TRANSPORT_REPOSITORY');
