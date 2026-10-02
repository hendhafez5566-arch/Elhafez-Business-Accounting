import type { ReactNode } from 'react';
import { ExecutiveDashboardPage, ManagementWorkCenterPage } from './management-control-page.js';
import { ApprovalCenterPage } from './approval-center-page.js';
import { SystemAdministrationPage } from './system-administration-page.js';
import {
  ActivityLogPage,
  FinancialControlAuditPage,
  ReportsCatalogPage,
} from './reports-control-legacy-pages.js';
import {
  AdministrationSettingsPage,
  BackupCenterPage,
  MarketReadinessPage,
  PeriodArchivingPage,
  QuickGuidePage,
} from './administration-legacy-pages.js';
import type { IconName } from './ui/icons.js';
import type { ScreenDesign } from './ui/screen-layouts.js';

interface Phase2BatchCEntryRoute {
  readonly id: string;
  readonly path: string;
  readonly label: string;
  readonly group: string;
  readonly icon: IconName;
  readonly design: ScreenDesign;
  readonly element: ReactNode;
}

export const reportsControlLegacyRoutes: readonly Phase2BatchCEntryRoute[] = [
  { id: 'legacy-workcenter', path: '/workcenter', label: 'مركز العمل اليومي', group: 'التقارير والرقابة', icon: 'tasks', design: { blueprint: 'command-center', reference: 'team-task-workflow' }, element: <ManagementWorkCenterPage /> },
  { id: 'legacy-owner', path: '/owner', label: 'لوحة الإدارة', group: 'التقارير والرقابة', icon: 'dashboard', design: { blueprint: 'dashboard', reference: 'main-dashboard' }, element: <ExecutiveDashboardPage /> },
  { id: 'legacy-reports', path: '/reports', label: 'التقارير', group: 'التقارير والرقابة', icon: 'analytics', design: { blueprint: 'dashboard', reference: 'financial-reporting-center' }, element: <ReportsCatalogPage /> },
  { id: 'legacy-approvals', path: '/approvals', label: 'الاعتمادات', group: 'التقارير والرقابة', icon: 'tasks', design: { blueprint: 'command-center', reference: 'team-task-workflow' }, element: <ApprovalCenterPage /> },
  { id: 'legacy-audit', path: '/audit', label: 'الرقابة المالية', group: 'التقارير والرقابة', icon: 'analytics', design: { blueprint: 'data-table', reference: 'financial-reporting-center' }, element: <FinancialControlAuditPage /> },
  { id: 'legacy-activity', path: '/activity', label: 'سجل النشاط', group: 'التقارير والرقابة', icon: 'analytics', design: { blueprint: 'timeline', reference: 'audit-trail' }, element: <ActivityLogPage /> },
] as const;

export const administrationLegacyRoutes: readonly Phase2BatchCEntryRoute[] = [
  { id: 'legacy-market-readiness', path: '/market-readiness', label: 'جاهزية البيع والتشغيل', group: 'الإدارة والإعدادات', icon: 'readiness', design: { blueprint: 'command-center', reference: 'team-task-workflow' }, element: <MarketReadinessPage /> },
  { id: 'legacy-backup-center', path: '/backup-center', label: 'النسخ الاحتياطي والاستعادة', group: 'الإدارة والإعدادات', icon: 'settings', design: { blueprint: 'settings', reference: 'system-administration' }, element: <BackupCenterPage /> },
  { id: 'legacy-period-archiving', path: '/period-archiving', label: 'الأرشفة الذكية', group: 'الإدارة والإعدادات', icon: 'calendar', design: { blueprint: 'command-center', reference: 'team-task-workflow' }, element: <PeriodArchivingPage /> },
  { id: 'legacy-quick-guide', path: '/quick-guide', label: 'دليل البدء السريع', group: 'الإدارة والإعدادات', icon: 'workspace', design: { blueprint: 'module', reference: 'master-module-template' }, element: <QuickGuidePage /> },
  { id: 'legacy-users', path: '/users', label: 'المستخدمون والصلاحيات', group: 'الإدارة والإعدادات', icon: 'profile', design: { blueprint: 'settings', reference: 'system-administration' }, element: <SystemAdministrationPage initialArea="users" /> },
  { id: 'legacy-branches', path: '/branches', label: 'الفروع', group: 'الإدارة والإعدادات', icon: 'workspace', design: { blueprint: 'settings', reference: 'system-administration' }, element: <SystemAdministrationPage initialArea="branches" /> },
  { id: 'legacy-documents', path: '/documents', label: 'مركز المستندات', group: 'الإدارة والإعدادات', icon: 'profile', design: { blueprint: 'documents', reference: 'document-management' }, element: <SystemAdministrationPage initialArea="files" /> },
  { id: 'legacy-sessions', path: '/sessions', label: 'الجلسات والأجهزة', group: 'الإدارة والإعدادات', icon: 'settings', design: { blueprint: 'data-table', reference: 'system-administration' }, element: <SystemAdministrationPage initialArea="sessions" /> },
  { id: 'legacy-dataexchange', path: '/dataexchange', label: 'استيراد وتصدير', group: 'الإدارة والإعدادات', icon: 'analytics', design: { blueprint: 'settings', reference: 'system-administration' }, element: <SystemAdministrationPage initialArea="imports" /> },
  { id: 'legacy-support', path: '/support', label: 'الدعم وحالة النظام', group: 'الإدارة والإعدادات', icon: 'settings', design: { blueprint: 'dashboard', reference: 'system-administration' }, element: <SystemAdministrationPage initialArea="operations/diagnostics" /> },
  { id: 'legacy-settings', path: '/settings', label: 'الإعدادات', group: 'الإدارة والإعدادات', icon: 'settings', design: { blueprint: 'settings', reference: 'company-system-settings' }, element: <AdministrationSettingsPage /> },
] as const;

export const phase2BatchCLegacyRoutes = Object.freeze([
  ...reportsControlLegacyRoutes,
  ...administrationLegacyRoutes,
]);
