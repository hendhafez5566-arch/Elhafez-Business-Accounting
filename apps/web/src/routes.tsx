import type { ReactNode } from 'react';
import { FollowupsPage, LeadsPage } from './crm-core-pages.js';
import { CustomersPage } from './crm-party-pages.js';
import { Customer360Page } from './crm-360-parity-pages.js';
import { AgentsPage, Agent360Page } from './crm-agent-parity-pages.js';
import { CrmSalesDashboardPage } from './crm-dashboard-parity-page.js';
import { CrmFinancialActionPage } from './crm-financial-action-page.js';
import { CrmCustomerDocumentsPage } from './crm-customer-documents-page.js';
import { CrmAgentDocumentsPage } from './crm-agent-documents-page.js';
import { CrmAwareTourismServicesPage } from './crm-tourism-service-entry-page.js';
import { TravelersPage } from './crm-insights-pages.js';
import { QuotationsPage } from './quotation-pages.js';
import { SuppliersPage } from './supplier-pages.js';
import { SupplierDocumentsPage } from './supplier-documents-page.js';
import { ProcurementOperationsPage } from './procurement-pages.js';
import { ProcurementReturnsPage } from './procurement-returns-page.js';
import { ProcurementSourcingPage } from './procurement-sourcing-page.js';
import { SupplierIntelligencePage } from './supplier-intelligence-page.js';
import { ProgramWorkspacePage, ProgramsPage, SeasonsPage } from './hajj-umrah-pages.js';
import { BookingsPage, RoomingPage, VisasPage } from './hajj-umrah-operations-primary-pages.js';
import { TicketingPage, TransportPage, TripOperationsPage } from './hajj-umrah-operations-secondary-pages.js';
import {
  HajjUmrahProgramsBoardPage,
  HajjUmrahRoomingMatrixPage,
  HajjUmrahTicketingCenterPage,
  HajjUmrahTransportFleetPage,
  HajjUmrahTripOperationsCommandPage,
} from './hajj-umrah-structural-pages.js';
import { HajjUmrahProgramCommandPage, HajjUmrahReadinessCommandPage } from './hajj-umrah-command-workspaces.js';
import { HajjUmrahReadinessPage } from './hajj-umrah-readiness-page.js';
import { SystemAdministrationPage } from './system-administration-page.js';
import { SystemAdministrationWorkspacePage } from './system-administration-structural-page.js';
import { PlatformFoundationsPage } from './platform-foundations-page.js';
import { TourismService360Page } from './tourism-service-360-page.js';
import { TourismServiceDocumentsPage } from './tourism-service-documents-page.js';
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
import { ReportingOutputCenterPage } from './reporting-output-center-page.js';
import type { IconName } from './ui/icons.js';
import { isScreenDesign, type ScreenDesign } from './ui/screen-layouts.js';

export interface AppRoute {
  readonly id: string;
  readonly path: string;
  readonly label: string;
  readonly group?: string;
  readonly icon?: IconName;
  readonly navigation?: boolean;
  readonly design: ScreenDesign;
  readonly element: ReactNode;
}

export function defineRoutes(...routes: readonly AppRoute[]): readonly AppRoute[] {
  const ids = new Set<string>();
  const paths = new Set<string>();
  for (const route of routes) {
    if (ids.has(route.id)) throw new Error('Duplicate route id: ' + route.id);
    if (paths.has(route.path)) throw new Error('Duplicate route path: ' + route.path);
    if (!isScreenDesign(route.design)) {
      throw new Error(`Route "${route.id}" (${route.path}) must declare a canonical ScreenDesign.`);
    }
    ids.add(route.id);
    paths.add(route.path);
  }
  return Object.freeze([...routes]);
}

export const foundationRoutes = defineRoutes(
  { id: 'foundation', path: '/', label: 'الرئيسية', group: 'الإدارة والتحكم', icon: 'home', design: { blueprint: 'dashboard', reference: 'main-dashboard' }, element: <ExecutiveDashboardPage /> },
  { id: 'management-exceptions', path: '/management/exceptions', label: 'مركز العمل والاستثناءات', group: 'الإدارة والتحكم', icon: 'tasks', design: { blueprint: 'command-center', reference: 'team-task-workflow' }, element: <ManagementWorkCenterPage /> },
  { id: 'management-approvals', path: '/management/approvals', label: 'مركز الموافقات', group: 'الإدارة والتحكم', icon: 'tasks', design: { blueprint: 'command-center', reference: 'team-task-workflow' }, element: <ApprovalCenterPage /> },
  { id: 'management-reports', path: '/management/reports', label: 'مركز التقارير', group: 'الإدارة والتحكم', icon: 'analytics', design: { blueprint: 'dashboard', reference: 'financial-reporting-center' }, element: <ReportingCenterPage /> },
  { id: 'management-outputs', path: '/management/outputs', label: 'مركز المخرجات والاستحقاقات', group: 'الإدارة والتحكم', icon: 'analytics', design: { blueprint: 'data-table', reference: 'data-table' }, element: <ReportingOutputCenterPage /> },
  { id: 'notification-center', path: '/notifications', label: 'الإشعارات', group: 'الإدارة والتحكم', icon: 'bell', design: { blueprint: 'timeline', reference: 'audit-trail' }, element: <NotificationCenterPage /> },
  { id: 'system-administration', path: '/system-administration', label: 'إدارة النظام', group: 'إدارة النظام', icon: 'settings', design: { blueprint: 'settings', reference: 'system-administration' }, element: <SystemAdministrationWorkspacePage /> },
  { id: 'system-administration-manage', path: '/system-administration/manage', label: 'أدوات إدارة النظام', group: 'إدارة النظام', icon: 'settings', navigation: false, design: { blueprint: 'settings', reference: 'system-administration' }, element: <SystemAdministrationPage /> },
  { id: 'system-custom-fields', path: '/system-administration/custom-fields', label: 'الحقول المخصصة', group: 'إدارة النظام', icon: 'settings', design: { blueprint: 'settings', reference: 'company-system-settings' }, element: <PlatformFoundationsPage initialTab="custom-fields" /> },
  { id: 'system-document-numbering', path: '/system-administration/document-numbering', label: 'ترقيم المستندات', group: 'إدارة النظام', icon: 'settings', design: { blueprint: 'settings', reference: 'company-system-settings' }, element: <PlatformFoundationsPage initialTab="numbering" /> },
  { id: 'system-automation', path: '/system-administration/automation', label: 'الأتمتة وسير العمل', group: 'إدارة النظام', icon: 'tasks', design: { blueprint: 'command-center', reference: 'team-task-workflow' }, element: <PlatformFoundationsPage initialTab="automation" /> },

  { id: 'crm-dashboard', path: '/crm/dashboard', label: 'لوحة المبيعات والعملاء', group: 'المبيعات والعملاء CRM', icon: 'dashboard', design: { blueprint: 'dashboard', reference: 'main-dashboard' }, element: <CrmSalesDashboardPage /> },
  { id: 'crm-leads', path: '/crm/leads', label: 'العملاء المحتملون والمتابعة', group: 'المبيعات والعملاء CRM', icon: 'leads', design: { blueprint: 'kanban', reference: 'crm-lead-pipeline' }, element: <LeadsPage /> },
  { id: 'crm-followups', path: '/crm/followups', label: 'المتابعات', group: 'المبيعات والعملاء CRM', icon: 'followup', design: { blueprint: 'timeline', reference: 'team-task-workflow' }, element: <FollowupsPage /> },
  { id: 'crm-customers', path: '/crm/customers', label: 'العملاء', group: 'المبيعات والعملاء CRM', icon: 'customers', design: { blueprint: 'data-table', reference: 'customer-management' }, element: <CustomersPage /> },
  { id: 'crm-customer-360', path: '/crm/customer-360', label: 'ملف العميل 360°', group: 'المبيعات والعملاء CRM', icon: 'profile', navigation: false, design: { blueprint: 'profile', reference: 'customer-management' }, element: <Customer360Page /> },
  { id: 'crm-customer-documents', path: '/crm/customer-documents', label: 'مستندات العميل', group: 'المبيعات والعملاء CRM', icon: 'profile', navigation: false, design: { blueprint: 'documents', reference: 'document-management' }, element: <CrmCustomerDocumentsPage /> },
  { id: 'crm-financial-action', path: '/crm/financial-action', label: 'إجراء مالي للطرف', group: 'المبيعات والعملاء CRM', icon: 'analytics', navigation: false, design: { blueprint: 'master-detail', reference: 'account-statement' }, element: <CrmFinancialActionPage /> },
  { id: 'crm-agents', path: '/crm/agents', label: 'المندوبون', group: 'المبيعات والعملاء CRM', icon: 'agents', design: { blueprint: 'data-table', reference: 'agents-commissions' }, element: <AgentsPage /> },
  { id: 'crm-agent-360', path: '/crm/agent-360', label: 'ملف المندوب 360°', group: 'المبيعات والعملاء CRM', icon: 'profile', navigation: false, design: { blueprint: 'profile', reference: 'agents-commissions' }, element: <Agent360Page /> },
  { id: 'crm-agent-documents', path: '/crm/agent-documents', label: 'مستندات المندوب', group: 'المبيعات والعملاء CRM', icon: 'profile', navigation: false, design: { blueprint: 'documents', reference: 'document-management' }, element: <CrmAgentDocumentsPage /> },
  { id: 'crm-quotations', path: '/crm/quotations', label: 'عروض الأسعار', group: 'المبيعات والعملاء CRM', icon: 'quote', design: { blueprint: 'stepper', reference: 'quotation-stepper' }, element: <QuotationsPage /> },
  { id: 'crm-travelers', path: '/crm/travelers', label: 'المسافرون', group: 'المبيعات والعملاء CRM', icon: 'traveler', design: { blueprint: 'data-table', reference: 'data-table' }, element: <TravelersPage /> },

  { id: 'supplier-management', path: '/procurement/suppliers', label: 'الموردون', group: 'المشتريات والموردون', icon: 'supplier', design: { blueprint: 'data-table', reference: 'supplier-intelligence' }, element: <SuppliersPage /> },
  { id: 'supplier-documents', path: '/procurement/supplier-documents', label: 'مستندات المورد', group: 'المشتريات والموردون', icon: 'profile', navigation: false, design: { blueprint: 'documents', reference: 'document-management' }, element: <SupplierDocumentsPage /> },
  { id: 'supplier-intelligence', path: '/procurement/supplier-intelligence', label: 'تقييم ومتابعة الموردين', group: 'المشتريات والموردون', icon: 'analytics', design: { blueprint: 'profile', reference: 'supplier-intelligence' }, element: <SupplierIntelligencePage /> },
  { id: 'procurement-sourcing', path: '/procurement/sourcing', label: 'طلبات الشراء والتوريد', group: 'المشتريات والموردون', icon: 'purchase', design: { blueprint: 'command-center', reference: 'purchase-orders' }, element: <ProcurementSourcingPage /> },
  { id: 'procurement-operations', path: '/procurement/purchase-orders', label: 'أوامر الشراء', group: 'المشتريات والموردون', icon: 'purchase', design: { blueprint: 'data-table', reference: 'purchase-orders' }, element: <ProcurementOperationsPage /> },
  { id: 'procurement-returns', path: '/procurement/returns', label: 'مرتجعات المشتريات', group: 'المشتريات والموردون', icon: 'purchase', design: { blueprint: 'data-table', reference: 'purchase-orders' }, element: <ProcurementReturnsPage /> },

  { id: 'tourism-services', path: '/tourism/services', label: 'السياحة والخدمات', group: 'السياحة والخدمات', icon: 'tourism', design: { blueprint: 'module', reference: 'master-module-template' }, element: <CrmAwareTourismServicesPage /> },
  { id: 'tourism-service-360', path: '/tourism/service-360', label: 'ملف الخدمة 360°', group: 'السياحة والخدمات', icon: 'analytics', navigation: false, design: { blueprint: 'profile', reference: 'master-module-template' }, element: <TourismService360Page /> },
  { id: 'tourism-service-documents', path: '/tourism/service-documents', label: 'مستندات الخدمة', group: 'السياحة والخدمات', icon: 'profile', navigation: false, design: { blueprint: 'documents', reference: 'document-management' }, element: <TourismServiceDocumentsPage /> },
  { id: 'tourism-programs', path: '/tourism/programs', label: 'البرامج السياحية', group: 'السياحة والخدمات', icon: 'program', design: { blueprint: 'module', reference: 'master-module-template' }, element: <TourismOperationsPage initialTab="programs" /> },
  { id: 'tourism-bookings', path: '/tourism/bookings', label: 'الحجوزات السياحية', group: 'السياحة والخدمات', icon: 'booking', design: { blueprint: 'data-table', reference: 'tourism-bookings' }, element: <TourismOperationsPage initialTab="bookings" /> },
  { id: 'tourism-itinerary', path: '/tourism/itinerary', label: 'البرنامج اليومي', group: 'السياحة والخدمات', icon: 'calendar', design: { blueprint: 'operations', reference: 'tourism-itinerary-builder' }, element: <TourismOperationsPage initialTab="itinerary" /> },
  { id: 'tourism-contract-inventory', path: '/tourism/contracts-inventory', label: 'التعاقدات والمخزون', group: 'السياحة والخدمات', icon: 'workspace', design: { blueprint: 'matrix', reference: 'tourism-inventory-matrix' }, element: <TourismContractInventoryPage /> },

  { id: 'accounting-workspace', path: '/accounting', label: 'المحاسبة والمالية', group: 'المحاسبة والمالية', icon: 'analytics', design: { blueprint: 'dashboard', reference: 'financial-reporting-center' }, element: <AccountingWorkspacePage /> },

  { id: 'hajj-umrah-seasons', path: '/hajj-umrah/seasons', label: 'المواسم', group: 'الحج والعمرة', icon: 'calendar', design: { blueprint: 'module', reference: 'master-module-template' }, element: <SeasonsPage /> },
  { id: 'hajj-umrah-contract-inventory', path: '/hajj-umrah/contracts-inventory', label: 'التعاقدات والمخزون', group: 'الحج والعمرة', icon: 'workspace', design: { blueprint: 'matrix', reference: 'tourism-inventory-matrix' }, element: <TourismContractInventoryPage /> },
  { id: 'hajj-umrah-programs', path: '/hajj-umrah/programs', label: 'برامج الحج والعمرة', group: 'الحج والعمرة', icon: 'program', design: { blueprint: 'kanban', reference: 'hajj-umrah-kanban' }, element: <HajjUmrahProgramsBoardPage /> },
  { id: 'hajj-umrah-programs-manage', path: '/hajj-umrah/programs/manage', label: 'إدارة تعريف البرامج', group: 'الحج والعمرة', icon: 'program', navigation: false, design: { blueprint: 'module', reference: 'master-module-template' }, element: <ProgramsPage /> },
  { id: 'hajj-umrah-program-workspace', path: '/hajj-umrah/program-workspace', label: 'مساحة عمل البرنامج', group: 'الحج والعمرة', icon: 'workspace', navigation: false, design: { blueprint: 'command-center', reference: 'hajj-umrah-kanban' }, element: <HajjUmrahProgramCommandPage /> },
  { id: 'hajj-umrah-program-workspace-manage', path: '/hajj-umrah/program-workspace/manage', label: 'إدارة دورة البرنامج', group: 'الحج والعمرة', icon: 'workspace', navigation: false, design: { blueprint: 'command-center', reference: 'hajj-umrah-kanban' }, element: <ProgramWorkspacePage /> },
  { id: 'hajj-umrah-bookings', path: '/hajj-umrah/bookings', label: 'الحجوزات', group: 'الحج والعمرة', icon: 'booking', design: { blueprint: 'data-table', reference: 'hajj-umrah-kanban' }, element: <BookingsPage /> },
  { id: 'hajj-umrah-rooming', path: '/hajj-umrah/rooming', label: 'تسكين الغرف', group: 'الحج والعمرة', icon: 'room', design: { blueprint: 'matrix', reference: 'rooming-allocation' }, element: <HajjUmrahRoomingMatrixPage /> },
  { id: 'hajj-umrah-rooming-manage', path: '/hajj-umrah/rooming/manage', label: 'إدارة التسكين', group: 'الحج والعمرة', icon: 'room', navigation: false, design: { blueprint: 'module', reference: 'rooming-allocation' }, element: <RoomingPage /> },
  { id: 'hajj-umrah-visas', path: '/hajj-umrah/visas', label: 'التأشيرات', group: 'الحج والعمرة', icon: 'visa', design: { blueprint: 'data-table', reference: 'data-table' }, element: <VisasPage /> },
  { id: 'hajj-umrah-ticketing', path: '/hajj-umrah/ticketing', label: 'التذاكر والطيران', group: 'الحج والعمرة', icon: 'ticket', design: { blueprint: 'data-table', reference: 'voucher-ticketing-center' }, element: <HajjUmrahTicketingCenterPage /> },
  { id: 'hajj-umrah-ticketing-manage', path: '/hajj-umrah/ticketing/manage', label: 'إدارة التذاكر والطيران', group: 'الحج والعمرة', icon: 'ticket', navigation: false, design: { blueprint: 'module', reference: 'voucher-ticketing-center' }, element: <TicketingPage /> },
  { id: 'hajj-umrah-transport', path: '/hajj-umrah/transport', label: 'النقل والتفويج', group: 'الحج والعمرة', icon: 'transport', design: { blueprint: 'operations', reference: 'fleet-transport' }, element: <HajjUmrahTransportFleetPage /> },
  { id: 'hajj-umrah-transport-manage', path: '/hajj-umrah/transport/manage', label: 'إدارة النقل والتفويج', group: 'الحج والعمرة', icon: 'transport', navigation: false, design: { blueprint: 'operations', reference: 'fleet-transport' }, element: <TransportPage /> },
  { id: 'hajj-umrah-trip-operations', path: '/hajj-umrah/trip-operations', label: 'تشغيل الرحلة', group: 'الحج والعمرة', icon: 'operations', design: { blueprint: 'operations', reference: 'trip-operations' }, element: <HajjUmrahTripOperationsCommandPage /> },
  { id: 'hajj-umrah-trip-operations-manage', path: '/hajj-umrah/trip-operations/manage', label: 'إدارة تشغيل الرحلة', group: 'الحج والعمرة', icon: 'operations', navigation: false, design: { blueprint: 'operations', reference: 'trip-operations' }, element: <TripOperationsPage /> },
  { id: 'hajj-umrah-readiness', path: '/hajj-umrah/readiness', label: 'مركز الجاهزية والتشغيل', group: 'الحج والعمرة', icon: 'readiness', design: { blueprint: 'command-center', reference: 'hajj-umrah-kanban' }, element: <HajjUmrahReadinessCommandPage /> },
  { id: 'hajj-umrah-readiness-manage', path: '/hajj-umrah/readiness/manage', label: 'أدوات الجاهزية والإغلاق', group: 'الحج والعمرة', icon: 'readiness', navigation: false, design: { blueprint: 'command-center', reference: 'hajj-umrah-kanban' }, element: <HajjUmrahReadinessPage /> },
  { id: 'hajj-umrah-barcode', path: '/hajj-umrah/barcode', label: 'باركود العمرة', group: 'الحج والعمرة', icon: 'barcode', design: { blueprint: 'form', reference: 'voucher-ticketing-center' }, element: <UmrahBarcodePage /> },

  { id: 'appearance-settings', path: '/settings/appearance', label: 'المظهر والتنقل', group: 'الإعدادات', icon: 'appearance', navigation: false, design: { blueprint: 'settings', reference: 'atoms' }, element: <AppearanceSettingsPage /> },
  { id: 'account-settings', path: '/settings/account', label: 'بيانات الدخول', group: 'الإعدادات', icon: 'profile', navigation: false, design: { blueprint: 'settings', reference: 'company-system-settings' }, element: <AccountSettingsPage /> },
);

export function findRoute(pathname: string, routes: readonly AppRoute[] = foundationRoutes): AppRoute {
  return routes.find((route) => route.path === pathname) ?? routes[0]!;
}
