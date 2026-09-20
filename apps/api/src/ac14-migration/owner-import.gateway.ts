import type { MigrationConfig, MigrationIssueCode } from '@elhafez/platform-core';
export const AC14_OWNER_IMPORT_GATEWAY = Symbol('AC14_OWNER_IMPORT_GATEWAY');
export interface HistoricalImportUnit { runId:string; stage:string; owner:string; collection:string; sourceId:string; sourcePayloadHash:string; targetCompanyId:string; targetBranchId?:string; payload:Readonly<Record<string,unknown>> }
export type HistoricalImportOutcome={status:'IMPORTED'|'CONVERGED';targetKind:string;targetId:string}|{status:'REJECTED';code:MigrationIssueCode;detail:string};
export interface OwnerEquivalence { records:string; payloadDigest:string; debit:string; credit:string; amount:string }
export interface Ac14OwnerImportGateway { validateUnit(unit:HistoricalImportUnit):void; importUnit(unit:HistoricalImportUnit):Promise<HistoricalImportOutcome>; rebuildReporting(runId:string,config:MigrationConfig):Promise<{evidenceCount:string}>; ownerEquivalence(owner:string,runId:string,companyId:string):Promise<OwnerEquivalence>; ownerNames():readonly string[] }
