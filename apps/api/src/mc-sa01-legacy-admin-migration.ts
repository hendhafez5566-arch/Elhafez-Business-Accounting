export const LEGACY_ADMIN_SOURCE={repository:'mhafez300300-byte/Elhafez-Tourism-Offline',commit:'e97fa6d9cb52acb22b676e1b975c1b2332bc9a13',version:'v32.5.66'} as const;
export type LegacyCoverageDisposition='PROCESS'|'UNSUPPORTED'|'NON_APPLICABLE'|'AMBIGUOUS'|'NEEDS_EVIDENCE';
export const LEGACY_ADMIN_COVERAGE=Object.freeze([
 {sourceCollection:'company',shape:'object',owner:'platform-core',targetKind:'company',strategy:'map-profile',disposition:'PROCESS'},
 {sourceCollection:'users',shape:'array',owner:'platform-core',targetKind:'user',strategy:'create-disabled-and-recover',disposition:'PROCESS'},
 {sourceCollection:'branches',shape:'array',owner:'platform-core',targetKind:'branch',strategy:'map-company-branch',disposition:'PROCESS'},
 {sourceCollection:'auditLog',shape:'array',owner:'platform-core',targetKind:'historical-audit-evidence',strategy:'preserve-history',disposition:'PROCESS'},
 {sourceCollection:'attachments',shape:'array',owner:'platform-core',targetKind:'file-metadata',strategy:'metadata-only-unless-checksum-proven',disposition:'NEEDS_EVIDENCE'},
 {sourceCollection:'notificationPrefs',shape:'array',owner:'platform-core',targetKind:'notification-preference',strategy:'map-preference',disposition:'PROCESS'},
 {sourceCollection:'settings',shape:'object',owner:'platform-core',targetKind:'configuration',strategy:'allowlisted-non-financial',disposition:'PROCESS'},
 {sourceCollection:'dataImports',shape:'array',owner:'data-exchange',targetKind:'historical-import-evidence',strategy:'preserve-history',disposition:'PROCESS'},
] satisfies ReadonlyArray<{sourceCollection:string;shape:'object'|'array';owner:string;targetKind:string;strategy:string;disposition:LegacyCoverageDisposition}>);
export function assertLegacyAdminCoverage(discovered:readonly string[]){const known=new Set(LEGACY_ADMIN_COVERAGE.map(x=>x.sourceCollection));const omitted=discovered.filter(x=>!known.has(x));if(omitted.length)throw new Error(`Unclassified legacy administration sources: ${omitted.join(', ')}`)}
export interface LegacyAdminSink{write(owner:string,kind:string,record:Readonly<Record<string,unknown>>):Promise<void>}
/** Executes deterministic mapping only; credentials and attachment bytes are deliberately excluded. */
export async function migrateLegacyAdministration(source:Readonly<Record<string,unknown>>,sink:LegacyAdminSink){assertLegacyAdminCoverage(Object.keys(source));let processed=0;for(const rule of LEGACY_ADMIN_COVERAGE){const value=source[rule.sourceCollection];if(value===undefined||rule.disposition!=='PROCESS')continue;const records:unknown[]=rule.shape==='array'?(Array.isArray(value)?value:[]):[value];for(const raw of records){if(!raw||typeof raw!=='object')throw new Error(`Invalid ${rule.sourceCollection} record`);const record={...(raw as Record<string,unknown>)};delete record.password;delete record.passwordHash;delete record.token;await sink.write(rule.owner,rule.targetKind,{...record,legacySource:rule.sourceCollection,credentialResetRequired:rule.sourceCollection==='users'||undefined,historical:rule.sourceCollection==='auditLog'||rule.sourceCollection==='dataImports'||undefined});processed++}}return{processed,source:LEGACY_ADMIN_SOURCE}}
