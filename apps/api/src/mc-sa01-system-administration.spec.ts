import {readFileSync} from 'node:fs';
import test from 'node:test';import assert from 'node:assert/strict';import {LEGACY_ADMIN_COVERAGE,LEGACY_NON_APPLICABLE_SOURCES,PLATFORM_SETTINGS_EXCLUSIONS,assertLegacyAdminCoverage,migrateLegacyAdministration} from './mc-sa01-legacy-admin-migration.js';
test('legacy administration registry prevents silent omissions',()=>{assert.doesNotThrow(()=>assertLegacyAdminCoverage(LEGACY_ADMIN_COVERAGE.map(x=>x.sourceCollection)));assert.throws(()=>assertLegacyAdminCoverage(['unknown source']))});
test('frozen-source shapes, settings ownership and attachment evidence are preserved',async()=>{const writes:Array<{kind:string;record:Readonly<Record<string,unknown>>}>=[];await migrateLegacyAdministration({company:{id:'c'},settings:{locale:'ar',baseCurrency:'EGP',preventNegativeTreasury:true,fiscalYearStartMonth:1,approvalPayments:true,allowSelfApproval:false,expenseCategories:['x'],prefixes:{invoice:'INV'}},branches:[],notificationPrefs:{email:true},attachments:[{id:'f',name:'proof.pdf',content:'unavailable',storageKey:'invented'}],users:[{id:'u',passwordHash:'legacy'}],auditLog:[{id:'a'}],dataImports:[]},{write:async(_owner,kind,record)=>{writes.push({kind,record})}});const settings=writes.find(x=>x.kind==='configuration')?.record??{};for(const key of PLATFORM_SETTINGS_EXCLUSIONS)assert.equal(key in settings,false);assert.equal(settings.locale,'ar');const attachment=writes.find(x=>x.kind==='file-metadata')?.record;assert.equal(attachment?.metadataMigrated,true);assert.equal(attachment?.binaryVerified,false);assert.equal(attachment?.storageKey,undefined);assert.equal(writes.find(x=>x.kind==='user')?.record.passwordHash,undefined);assert.equal(writes.find(x=>x.kind==='user')?.record.credentialResetRequired,true);assert.equal(writes.find(x=>x.kind==='historical-audit-evidence')?.record.historical,true)});
test('a full frozen-root-shaped fixture classifies unrelated sources but rejects a genuinely unknown key',async()=>{const fullRoot:Record<string,unknown>=Object.fromEntries(LEGACY_NON_APPLICABLE_SOURCES.map(key=>[key,[]]));Object.assign(fullRoot,{company:{id:'c'},settings:{theme:'light'},branches:[],notificationPrefs:{},attachments:[],users:[],auditLog:[],dataImports:[]});assert.doesNotThrow(()=>assertLegacyAdminCoverage(Object.keys(fullRoot)));const result=await migrateLegacyAdministration(fullRoot,{write:async()=>{}});assert.equal(result.processed,3);await assert.rejects(migrateLegacyAdministration({...fullRoot,newMysteryCollection:[]},{write:async()=>{}}),/Unclassified/)});

test('system administration production composition has no optional data-exchange fallback',()=>{
 const controller=readFileSync(new URL('./system-administration.controller.ts',import.meta.url),'utf8');
 const appModule=readFileSync(new URL('./app.module.ts',import.meta.url),'utf8');
 assert.doesNotMatch(controller,/SYSTEM_ADMIN_(EXCHANGE_TARGET|EXPORT_SOURCE|EXPORT_STORAGE)|@Optional/);
 assert.match(controller,/SystemAdministrationDataExchangeBoundary/);
 assert.match(controller,/exchange\.ingest/);
 assert.match(controller,/dataBoundary\.importTarget/);
 assert.match(controller,/dataBoundary\.exportSource/);
 assert.match(controller,/dataBoundary\.exportStorage/);
 assert.match(appModule,/provide:\s*SystemAdministrationDataExchangeBoundary/);
});
