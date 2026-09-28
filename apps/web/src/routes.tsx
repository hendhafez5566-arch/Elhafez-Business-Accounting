import type { ReactNode } from 'react';
import { AgentsPage, CustomersPage, FollowupsPage, LeadsPage } from './crm-core-pages.js';
import { Agent360Page, CrmSalesDashboardPage, Customer360Page, TravelersPage } from './crm-insights-pages.js';
import { QuotationsPage } from './quotation-pages.js';
import { SuppliersPage } from './supplier-pages.js';
import { ProcurementOperationsPage } from './procurement-pages.js';
import { ProcurementSourcingPage } from './procurement-sourcing-page.js';
import { SupplierIntelligencePage } from './supplier-intelligence-page.js';
import { ProgramWorkspacePage, ProgramsPage, SeasonsPage } from './hajj-umrah-pages.js';
import { BookingsPage, RoomingPage, VisasPage } from './hajj-umrah-operations-primary-pages.js';
import { TicketingPage, TransportPage, TripOperationsPage } from './hajj-umrah-operations-secondary-pages.js';
import { HajjUmrahReadinessPage } from './hajj-umrah-readiness-page.js';
import { SystemAdministrationPage } from './system-administration-page.js';
import { PlatformFoundationsPage } from './platform-foundations-page.js';
import { TourismServicesPage } from './tourism-services-page.js';
import { TourismOperationsPage } from './tourism-operations-page.js';
import { TourismContractInventoryPage } from './tourism-contract-inventory-page.js';
import { UmrahBarcodePage } from './hajj-umrah-barcode-page.js';
import { ExecutiveDashboardPage, ManagementWorkCenterPage } from './management-control-page.js';
import { AppearanceSettingsPage } from './ui/appearance-settings-page.js';
import { AccountingWorkspacePage } from './accounting-workspace-page.js';
import { AccountSettingsPage } from './account-settings-page.js';
import { NotificationCenterPage } from './notification-center-page.js';
import { ApprovalCenterPage } from './approval-center-page.js';
import { ReportingCenterPage } from './reporting-center-page.js';
import{CommercialReadinessPage,PeriodArchivePage}from'./legacy-readiness-page.js';
import type { IconName } from './ui/icons.js';

export interface AppRoute {
  readonly id: string;
  readonly path: string;
  readonly label: string;
  readonly group?: string;
  readonly icon?: IconName;
  readonly navigation?: boolean;
  readonly element: ReactNode;
}

export function defineRoutes(...routes: readonly AppRoute[]): readonly AppRoute[] {
  const ids = new Set<string>();
  const paths = new Set<string>();
  for (const route of routes) {
    if (ids.has(route.id)) throw new Error('Duplicate route id: ' + route.id);
    if (paths.has(route.path)) throw new Error('Duplicate route path: ' + route.path);
    ids.add(route.id);
    paths.add(route.path);
  }
  return Object.freeze([...routes]);
}

export const foundationRoutes = defineRoutes(
  { id: 'foundation', path: '/', label: 'الرئيسية', group: 'الإدارة والتحكم', icon: 'home', element: <ExecutiveDashboardPage /> },
  { id: 'management-exceptions', path: '/management/exceptions', label: 'مركز العمل والاستثناءات', group: 'الإدارة والتحكم', icon: 'tasks', element: <ManagementWorkCenterPage /> },
  { id: 'management-approvals', path: '/management/approvals', label: 'مركز الموافقات', group: 'الإدارة والتحكم', icon: 'tasks', element: <ApprovalCenterPage /> },
  { id: 'management-reports', path: '/management/reports', label: 'مركز التقارير', group: 'الإدارة والتحكم', icon: 'analytics', element: <ReportingCenterPage /> },
  { id: 'notification-center', path: '/notifications', label: 'الإشعارات', group: 'الإدارة والتحكم', icon: 'bell', element: <NotificationCenterPage /> },
  { id: 'system-administration', path: '/system-administration', label: 'إدارة النظام', group: 'إدارة النظام', icon: 'settings', element: <SystemAdministrationPage /> },
  { id: 'system-custom-fields', path: '/system-administration/custom-fields', label: 'الحقول المخصصة', group: 'إدارة النظام', icon: 'settings', element: <PlatformFoundationsPage initialTab="custom-fields" /> },
  { id: 'system-document-numbering', path: '/system-administration/document-numbering', label: 'ترقيم المستندات', group: 'إدارة النظام', icon: 'settings', element: <PlatformFoundationsPage initialTab="numbering" /> },
  { id: 'system-automation', path: '/system-administration/automation', label: 'الأتمتة وسير العمل', group: 'إدارة النظام', icon: 'tasks', element: <PlatformFoundationsPage initialTab="automation" /> },
  { id: 'system-users', path: '/system-administration/users', label: 'المستخدمون والصلاحيات', group: 'إدارة النظام', icon: 'customers', element: <SystemAdministrationPage initialTab="users" /> },
  { id: 'system-branches', path: '/system-administration/branches', label: 'الفروع والوصول', group: 'إدارة النظام', icon: 'workspace', element: <SystemAdministrationPage initialTab="branches" /> },
  { id: 'system-documents', path: '/system-administration/documents', label: 'مركز المستندات', group: 'إدارة النظام', icon: 'program', element: <SystemAdministrationPage initialTab="files" /> },
  { id: 'system-sessions', path: '/system-administration/sessions', label: 'الجلسات والأجهزة', group: 'إدارة النظام', icon: 'profile', element: <SystemAdministrationPage initialTab="sessions" /> },
  { id: 'system-data-exchange', path: '/system-administration/data-exchange', label: 'استيراد وتصدير البيانات', group: 'إدارة النظام', icon: 'program', element: <SystemAdministrationPage initialTab="imports" /> },
  { id: 'system-audit', path: '/system-administration/audit', label: 'سجل النشاط', group: 'إدارة النظام', icon: 'operations', element: <SystemAdministrationPage initialTab="audit" /> },
  { id: 'system-diagnostics', path: '/system-administration/diagnostics', label: 'الدعم وحالة النظام', group: 'إدارة النظام', icon: 'readiness', element: <SystemAdministrationPage initialTab="operations/diagnostics" /> },
  { id: 'system-company-settings', path: '/system-administration/company-settings', label: 'إعدادات الشركة', group: 'إدارة النظام', icon: 'settings', element: <SystemAdministrationPage initialTab="configuration/locale" /> },
  { id: 'system-readiness', path: '/system/readiness', label: 'جاهزية البيع والتشغيل', group: 'إدارة النظام', icon: 'readiness', element: <CommercialReadinessPage /> },
  { id: 'system-quick-start', path: '/system/quick-start', label: 'دليل البدء السريع', group: 'إدارة النظام', icon: 'tasks', element: <CommercialReadinessPage mode="guide" /> },
  { id: 'system-period-archive', path: '/system/period-archive', label: 'الأرشفة المالية', group: 'إدارة النظام', icon: 'calendar', element: <PeriodArchivePage /> },

  { id: 'crm-dashboard', path: '/crm/dashboard', label: 'لوحة العملاء والمبيعات', group: 'العملاء والمبيعات', icon: 'dashboard', element: <CrmSalesDashboardPage /> },
  { id: 'crm-customers', path: '/crm/customers', label: 'العملاء', group: 'العملاء والمبيعات', icon: 'customers', element: <CustomersPage /> },
  { id: 'crm-customer-360', path: '/crm/customer-360', label: 'ملف العميل 360°', group: 'العملاء والمبيعات', icon: 'profile', navigation: false, element: <Customer360Page /> },
  { id: 'crm-agents', path: '/crm/agents', label: 'الوكلاء', group: 'العملاء والمبيعات', icon: 'agents', element: <AgentsPage /> },
  { id: 'crm-agent-360', path: '/crm/agent-360', label: 'ملف الوكيل 360°', group: 'العملاء والمبيعات', icon: 'profile', navigation: false, element: <Agent360Page /> },
  { id: 'crm-leads', path: '/crm/leads', label: 'العملاء المحتملون', group: 'العملاء والمبيعات', icon: 'leads', element: <LeadsPage /> },
  { id: 'crm-quotations', path: '/crm/quotations', label: 'عروض الأسعار', group: 'العملاء والمبيعات', icon: 'quote', element: <QuotationsPage /> },
  { id: 'crm-followups', path: '/crm/followups', label: 'المتابعات', group: 'العملاء والمبيعات', icon: 'followup', element: <FollowupsPage /> },
  { id: 'crm-travelers', path: '/crm/travelers', label: 'المسافرون', group: 'العملاء والمبيعات', icon: 'traveler', element: <TravelersPage /> },

  { id: 'supplier-management', path: '/procurement/suppliers', label: 'الموردون', group: 'المشتريات والموردون', icon: 'supplier', element: <SuppliersPage /> },
  { id: 'supplier-intelligence', path: '/procurement/supplier-intelligence', label: 'تقييم ومتابعة الموردين', group: 'المشتريات والموردون', icon: 'analytics', element: <SupplierIntelligencePage /> },
  { id: 'procurement-sourcing', path: '/procurement/sourcing', label: 'طلبات الشراء والتوريد', group: 'المشتريات والموردون', icon: 'purchase', element: <ProcurementSourcingPage /> },
  { id: 'procurement-operations', path: '/procurement/purchase-orders', label: 'أوامر الشراء', group: 'المشتريات والموردون', icon: 'purchase', element: <ProcurementOperationsPage /> },

  { id: 'tourism-services', path: '/tourism/services', label: 'السياحة والخدمات', group: 'السياحة والخدمات', icon: 'tourism', element: <TourismServicesPage /> },
  { id: 'tourism-programs', path: '/tourism/programs', label: 'البرامج السياحية', group: 'السياحة والخدمات', icon: 'program', element: <TourismOperationsPage initialTab="programs" /> },
  { id: 'tourism-bookings', path: '/tourism/bookings', label: 'الحجوزات السياحية', group: 'السياحة والخدمات', icon: 'booking', element: <TourismOperationsPage initialTab="bookings" /> },
  { id: 'tourism-itinerary', path: '/tourism/itinerary', label: 'البرنامج اليومي', group: 'السياحة والخدمات', icon: 'calendar', element: <TourismOperationsPage initialTab="itinerary" /> },
  { id: 'tourism-contract-inventory', path: '/tourism/contracts-inventory', label: 'التعاقدات والمخزون', group: 'السياحة والخدمات', icon: 'workspace', element: <TourismContractInventoryPage /> },

  { id: 'accounting-workspace', path: '/accounting', label: 'المحاسبة والمالية', group: 'المحاسبة والمالية', icon: 'analytics', element: <AccountingWorkspacePage /> },
  { id: 'accounting-invoices', path: '/accounting/invoices', label: 'الفواتير والذمم', group: 'المحاسبة والمالية', icon: 'quote', element: <AccountingWorkspacePage initialTab="billing" /> },
  { id: 'accounting-receipts-payments', path: '/accounting/receipts-payments', label: 'سندات القبض والصرف', group: 'المحاسبة والمالية', icon: 'purchase', element: <AccountingWorkspacePage initialTab="treasury" /> },
  { id: 'accounting-expenses', path: '/accounting/expenses', label: 'المصروفات والعمولات', group: 'المحاسبة والمالية', icon: 'purchase', element: <AccountingWorkspacePage initialTab="expense-commission" /> },
  { id: 'accounting-settlements', path: '/accounting/settlements', label: 'التسويات والمقاصة', group: 'المحاسبة والمالية', icon: 'workspace', element: <AccountingWorkspacePage initialTab="party-accounting" /> },
  { id: 'accounting-accruals', path: '/accounting/accruals', label: 'الاستحقاقات والإيراد المؤجل', group: 'المحاسبة والمالية', icon: 'calendar', element: <AccountingWorkspacePage initialTab="recognition-accrual" /> },
  { id: 'accounting-assets-financing', path: '/accounting/assets-financing', label: 'الأصول والقروض والتمويل', group: 'المحاسبة والمالية', icon: 'analytics', element: <AccountingWorkspacePage initialTab="assets-financing" /> },
  { id: 'accounting-budgets', path: '/accounting/budgets', label: 'الموازنات ومراكز التكلفة', group: 'المحاسبة والمالية', icon: 'analytics', element: <AccountingWorkspacePage initialTab="cost-budget" /> },
  { id: 'accounting-cheques-treasury', path: '/accounting/treasury', label: 'الخزن والبنوك والشيكات', group: 'المحاسبة والمالية', icon: 'purchase', element: <AccountingWorkspacePage initialTab="treasury" /> },
  { id: 'accounting-journals', path: '/accounting/journals', label: 'القيود اليومية', group: 'المحاسبة والمالية', icon: 'program', element: <AccountingWorkspacePage initialTab="journals" /> },
  { id: 'accounting-chart', path: '/accounting/chart', label: 'دليل الحسابات', group: 'المحاسبة والمالية', icon: 'program', element: <AccountingWorkspacePage initialTab="accounts" /> },
  { id: 'accounting-trial-reports', path: '/accounting/trial-reports', label: 'ميزان المراجعة والتقارير', group: 'المحاسبة والمالية', icon: 'analytics', element: <AccountingWorkspacePage initialTab="reports" /> },
  { id: 'accounting-currency', path: '/accounting/currency', label: 'العملات وأسعار الصرف', group: 'المحاسبة والمالية', icon: 'analytics', element: <AccountingWorkspacePage initialTab="currency-fx" /> },
  { id: 'accounting-tax', path: '/accounting/tax', label: 'الضرائب', group: 'المحاسبة والمالية', icon: 'analytics', element: <AccountingWorkspacePage initialTab="tax" /> },
  { id: 'accounting-periods', path: '/accounting/periods', label: 'الفترات المالية', group: 'المحاسبة والمالية', icon: 'calendar', element: <AccountingWorkspacePage initialTab="periods" /> },
  { id: 'accounting-controls', path: '/accounting/controls', label: 'الرقابة المالية', group: 'المحاسبة والمالية', icon: 'readiness', element: <AccountingWorkspacePage initialTab="controls" /> },

  { id: 'hajj-umrah-seasons', path: '/hajj-umrah/seasons', label: 'المواسم', group: 'الحج والعمرة', icon: 'calendar', element: <SeasonsPage /> },
  { id: 'hajj-umrah-contract-inventory', path: '/hajj-umrah/contracts-inventory', label: 'التعاقدات والمخزون', group: 'الحج والعمرة', icon: 'workspace', element: <TourismContractInventoryPage /> },
  { id: 'hajj-umrah-programs', path: '/hajj-umrah/programs', label: 'برامج الحج والعمرة', group: 'الحج والعمرة', icon: 'program', element: <ProgramsPage /> },
  { id: 'hajj-umrah-program-workspace', path: '/hajj-umrah/program-workspace', label: 'مساحة عمل البرنامج', group: 'الحج والعمرة', icon: 'workspace', navigation: false, element: <ProgramWorkspacePage /> },
  { id: 'hajj-umrah-bookings', path: '/hajj-umrah/bookings', label: 'الحجوزات', group: 'الحج والعمرة', icon: 'booking', element: <BookingsPage /> },
  { id: 'hajj-umrah-rooming', path: '/hajj-umrah/rooming', label: 'تسكين الغرف', group: 'الحج والعمرة', icon: 'room', element: <RoomingPage /> },
  { id: 'hajj-umrah-visas', path: '/hajj-umrah/visas', label: 'التأشيرات', group: 'الحج والعمرة', icon: 'visa', element: <VisasPage /> },
  { id: 'hajj-umrah-ticketing', path: '/hajj-umrah/ticketing', label: 'التذاكر والطيران', group: 'الحج والعمرة', icon: 'ticket', element: <TicketingPage /> },
  { id: 'hajj-umrah-transport', path: '/hajj-umrah/transport', label: 'النقل والتفويج', group: 'الحج والعمرة', icon: 'transport', element: <TransportPage /> },
  { id: 'hajj-umrah-trip-operations', path: '/hajj-umrah/trip-operations', label: 'تشغيل الرحلة', group: 'الحج والعمرة', icon: 'operations', element: <TripOperationsPage /> },
  { id: 'hajj-umrah-readiness', path: '/hajj-umrah/readiness', label: 'مركز الجاهزية والتشغيل', group: 'الحج والعمرة', icon: 'readiness', element: <HajjUmrahReadinessPage /> },
  { id: 'hajj-umrah-barcode', path: '/hajj-umrah/barcode', label: 'باركود العمرة', group: 'الحج والعمرة', icon: 'barcode', element: <UmrahBarcodePage /> },

  { id: 'appearance-settings', path: '/settings/appearance', label: 'المظهر والتنقل', group: 'الإعدادات', icon: 'appearance', navigation: false, element: <AppearanceSettingsPage /> },
  { id: 'account-settings', path: '/settings/account', label: 'بيانات الدخول', group: 'الإعدادات', icon: 'profile', navigation: false, element: <AccountSettingsPage /> },
);

export function findRoute(pathname: string, routes: readonly AppRoute[] = foundationRoutes): AppRoute {
  return routes.find((route) => route.path === pathname) ?? routes[0]!;
}
