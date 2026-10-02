import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = (name: string) => readFileSync(new URL(name, import.meta.url), 'utf8');
const count = (text: string, token: string) => text.split(token).length - 1;

const reportsControl = [
  ['/workcenter', 'مركز العمل اليومي'],
  ['/owner', 'لوحة الإدارة'],
  ['/reports', 'التقارير'],
  ['/approvals', 'الاعتمادات'],
  ['/audit', 'الرقابة المالية'],
  ['/activity', 'سجل النشاط'],
] as const;

const administration = [
  ['/market-readiness', 'جاهزية البيع والتشغيل'],
  ['/backup-center', 'النسخ الاحتياطي والاستعادة'],
  ['/period-archiving', 'الأرشفة الذكية'],
  ['/quick-guide', 'دليل البدء السريع'],
  ['/users', 'المستخدمون والصلاحيات'],
  ['/branches', 'الفروع'],
  ['/documents', 'مركز المستندات'],
  ['/sessions', 'الجلسات والأجهزة'],
  ['/dataexchange', 'استيراد وتصدير'],
  ['/support', 'الدعم وحالة النظام'],
  ['/settings', 'الإعدادات'],
] as const;

test('Batch C restores all legacy-visible Reports/Control and Administration entry routes exactly once and in legacy order', () => {
  const registry = source('./phase2-batch-c-routes.tsx');
  const root = source('./routes.tsx');
  let previous = -1;
  for (const [path, label] of [...reportsControl, ...administration]) {
    assert.equal(count(registry, `path: '${path}'`), 1, path);
    assert.match(registry, new RegExp(label));
    const index = registry.indexOf(`path: '${path}'`);
    assert.ok(index > previous, `${path} must preserve legacy navigation order`);
    previous = index;
  }
  assert.equal(count(root, '...phase2BatchCLegacyRoutes'), 1);
  assert.doesNotMatch(registry, /\/manage(?:['"/])/);
});

test('Reports and Control entry screens consume canonical services and do not create reporting or approval truth', () => {
  const pages = source('./reports-control-legacy-pages.tsx');
  const registry = source('./phase2-batch-c-routes.tsx');
  assert.match(registry, /ManagementWorkCenterPage/);
  assert.match(registry, /ExecutiveDashboardPage/);
  assert.match(registry, /ApprovalCenterPage/);
  assert.match(pages, /HttpReportingCenterClient/);
  assert.match(pages, /HttpAdministrationClient/);
  assert.match(pages, /client\.list\('audit'/);
  assert.doesNotMatch(pages, /localStorage|sessionStorage|ts-ignore|\bany\b/);
  assert.doesNotMatch(pages, /crmPost|crmPatch|accountingApi\.post|approval.*create/i);
});

test('Legacy Work Center keeps target filtering and restores expandable grouped actions', () => {
  const workCenter = source('./management-control-page.tsx');
  assert.match(workCenter, /aria-label="مركز العمل اليومي"/);
  assert.match(workCenter, /<details[^>]*className="ui-disclosure-card"[^>]*open>/);
  assert.match(workCenter, /تحتاج متابعة/);
  assert.match(workCenter, /مالية واعتمادات/);
  assert.match(workCenter, /filters\.domain/);
  assert.match(workCenter, /filters\.severity/);
  assert.match(workCenter, /filters\.from/);
  assert.match(workCenter, /filters\.to/);
  assert.doesNotMatch(workCenter, /localStorage|sessionStorage|ts-ignore|\bany\b/);
});

test('Administration legacy routes reuse the canonical SystemAdministrationPage with explicit initial areas', () => {
  const registry = source('./phase2-batch-c-routes.tsx');
  const admin = source('./system-administration-page.tsx');
  for (const area of ['users', 'branches', 'files', 'sessions', 'imports', 'operations/diagnostics']) {
    assert.match(registry, new RegExp(`initialArea=\\"${area.replace('/', '\\/')}\\"`));
  }
  assert.match(admin, /initialArea='users'/);
  assert.match(admin, /setSelected\(initialArea\)/);
  assert.match(admin, /load\(initialArea\)/);
  assert.match(admin, /Platform Core RBAC/);
  assert.doesNotMatch(admin, /localStorage|sessionStorage|ts-ignore|\bany\b/);
});

test('Batch C keeps prior internal owners routable but out of duplicate sidebar navigation', () => {
  const root = source('./routes.tsx');
  for (const id of [
    'management-dashboard',
    'management-exceptions',
    'management-approvals',
    'management-reports',
    'management-outputs',
    'notification-center',
    'system-administration',
    'system-custom-fields',
    'system-document-numbering',
    'system-automation',
  ]) {
    const line = root.split('\n').find((row) => row.includes(`id: '${id}'`));
    assert.ok(line, id);
    assert.match(line, /navigation: false/, `${id} must not create duplicate navigation`);
  }
});

test('Administration supplementary legacy screens remain projections or links over target owners', () => {
  const pages = source('./administration-legacy-pages.tsx');
  assert.match(pages, /CompanyProfilePanel/);
  assert.match(pages, /client\.list\('operations\/diagnostics'/);
  assert.match(pages, /href="\/system-administration\/document-numbering"/);
  assert.match(pages, /href="\/accounting\/periods"/);
  assert.doesNotMatch(pages, /href="\/periods"/);
  assert.match(pages, /href="\/approvals"/);
  assert.match(pages, /href="\/accounting"/);
  assert.match(pages, /Owner \+ MFA/);
  assert.match(pages, /Target Contract/);
  assert.doesNotMatch(pages, /localStorage|sessionStorage|ts-ignore|\bany\b|fake|mock/i);
});
