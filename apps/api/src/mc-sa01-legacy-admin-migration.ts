export const LEGACY_ADMIN_SOURCE={repository:'mhafez300300-byte/Elhafez-Tourism-Offline',commit:'e97fa6d9cb52acb22b676e1b975c1b2332bc9a13',version:'v32.5.66'} as const;
export type LegacyCoverageDisposition='IMPORTED'|'UNSUPPORTED'|'NON_APPLICABLE'|'NEEDS_EVIDENCE';
export const LEGACY_ADMIN_COVERAGE=Object.freeze([
 {source:'company identity/profile',owner:'platform-core',disposition:'IMPORTED'},
 {source:'users',owner:'platform-core',disposition:'IMPORTED',note:'password hashes are excluded; users enter secure recovery'},
 {source:'branches and user/branch assignments',owner:'platform-core',disposition:'IMPORTED'},
 {source:'audit/activity history',owner:'platform-core',disposition:'IMPORTED',note:'stored as historical evidence, never replayed'},
 {source:'attachments metadata',owner:'platform-core',disposition:'IMPORTED',note:'binaryVerified is false unless bytes and checksum accompany the record'},
 {source:'notification preferences',owner:'platform-core',disposition:'IMPORTED'},
 {source:'generic non-financial settings',owner:'platform-core',disposition:'IMPORTED'},
 {source:'dataImports',owner:'data-exchange',disposition:'IMPORTED'},
 {source:'accounting settings',owner:'accounting modules',disposition:'NON_APPLICABLE'},
 {source:'legacy recovery/password material',owner:'platform-core',disposition:'UNSUPPORTED'},
] satisfies ReadonlyArray<{source:string;owner:string;disposition:LegacyCoverageDisposition;note?:string}>);
export function assertLegacyAdminCoverage(discovered:readonly string[]){const known=new Set(LEGACY_ADMIN_COVERAGE.map(x=>x.source));const omitted=discovered.filter(x=>!known.has(x));if(omitted.length)throw new Error(`Unclassified legacy administration sources: ${omitted.join(', ')}`)}
