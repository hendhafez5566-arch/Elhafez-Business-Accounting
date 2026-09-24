import type { ReactNode } from 'react';
import { AgentsPage, CustomersPage, FollowupsPage, LeadsPage } from './crm-core-pages.js';
import { Agent360Page, CrmSalesDashboardPage, Customer360Page, TravelersPage } from './crm-insights-pages.js';
import { QuotationsPage } from './quotation-pages.js';
import { SuppliersPage } from './supplier-pages.js';
import { ProcurementOperationsPage } from './procurement-pages.js';
import { SupplierIntelligencePage } from './supplier-intelligence-page.js';
import { ProgramWorkspacePage, ProgramsPage, SeasonsPage } from './hajj-umrah-pages.js';
import { BookingsPage, RoomingPage, VisasPage } from './hajj-umrah-operations-primary-pages.js';
import { TicketingPage, TransportPage, TripOperationsPage } from './hajj-umrah-operations-secondary-pages.js';
import { HajjUmrahReadinessPage } from './hajj-umrah-readiness-page.js';
import { SystemAdministrationPage } from './system-administration-page.js';
import { TourismServicesPage } from './tourism-services-page.js';
import { UmrahBarcodePage } from './hajj-umrah-barcode-page.js';
import { ExecutiveDashboardPage, ManagementWorkCenterPage } from './management-control-page.js';
import { AppearanceSettingsPage } from './ui/appearance-settings-page.js';
import type { IconName } from './ui/icons.js';

export interface AppRoute {
  readonly id: string;
  readonly path: string;
  readonly label: string;
  readonly group?: string;
  readonly icon?: IconName;
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
  { id: 'system-administration', path: '/system-administration', label: 'إدارة النظام', group: 'إدارة النظام', icon: 'settings', element: <SystemAdministrationPage /> },

  { id: 'crm-dashboard', path: '/crm/dashboard', label: 'لوحة العملاء والمبيعات', group: 'العملاء والمبيعات', icon: 'dashboard', element: <CrmSalesDashboardPage /> },
  { id: 'crm-customers', path: '/crm/customers', label: 'العملاء', group: 'العملاء والمبيعات', icon: 'customers', element: <CustomersPage /> },
  { id: 'crm-customer-360', path: '/crm/customer-360', label: 'Customer 360', group: 'العملاء والمبيعات', icon: 'profile', element: <Customer360Page /> },
  { id: 'crm-agents', path: '/crm/agents', label: 'الوكلاء', group: 'العملاء والمبيعات', icon: 'agents', element: <AgentsPage /> },
  { id: 'crm-agent-360', path: '/crm/agent-360', label: 'Agent 360', group: 'العملاء والمبيعات', icon: 'profile', element: <Agent360Page /> },
  { id: 'crm-leads', path: '/crm/leads', label: 'العملاء المحتملون', group: 'العملاء والمبيعات', icon: 'leads', element: <LeadsPage /> },
  { id: 'crm-quotations', path: '/crm/quotations', label: 'عروض الأسعار', group: 'العملاء والمبيعات', icon: 'quote', element: <QuotationsPage /> },
  { id: 'crm-followups', path: '/crm/followups', label: 'المتابعات', group: 'العملاء والمبيعات', icon: 'followup', element: <FollowupsPage /> },
  { id: 'crm-travelers', path: '/crm/travelers', label: 'المسافرون', group: 'العملاء والمبيعات', icon: 'traveler', element: <TravelersPage /> },

  { id: 'supplier-management', path: '/procurement/suppliers', label: 'الموردون', group: 'المشتريات والموردون', icon: 'supplier', element: <SuppliersPage /> },
  { id: 'supplier-intelligence', path: '/procurement/supplier-intelligence', label: 'تقييم ومتابعة الموردين', group: 'المشتريات والموردون', icon: 'analytics', element: <SupplierIntelligencePage /> },
  { id: 'procurement-operations', path: '/procurement/purchase-orders', label: 'أوامر الشراء', group: 'المشتريات والموردون', icon: 'purchase', element: <ProcurementOperationsPage /> },

  { id: 'tourism-services', path: '/tourism/services', label: 'السياحة والخدمات', group: 'السياحة والخدمات', icon: 'tourism', element: <TourismServicesPage /> },

  { id: 'hajj-umrah-seasons', path: '/hajj-umrah/seasons', label: 'المواسم', group: 'الحج والعمرة', icon: 'calendar', element: <SeasonsPage /> },
  { id: 'hajj-umrah-programs', path: '/hajj-umrah/programs', label: 'برامج الحج والعمرة', group: 'الحج والعمرة', icon: 'program', element: <ProgramsPage /> },
  { id: 'hajj-umrah-program-workspace', path: '/hajj-umrah/program-workspace', label: 'مساحة عمل البرنامج', group: 'الحج والعمرة', icon: 'workspace', element: <ProgramWorkspacePage /> },
  { id: 'hajj-umrah-bookings', path: '/hajj-umrah/bookings', label: 'الحجوزات', group: 'الحج والعمرة', icon: 'booking', element: <BookingsPage /> },
  { id: 'hajj-umrah-rooming', path: '/hajj-umrah/rooming', label: 'تسكين الغرف', group: 'الحج والعمرة', icon: 'room', element: <RoomingPage /> },
  { id: 'hajj-umrah-visas', path: '/hajj-umrah/visas', label: 'التأشيرات', group: 'الحج والعمرة', icon: 'visa', element: <VisasPage /> },
  { id: 'hajj-umrah-ticketing', path: '/hajj-umrah/ticketing', label: 'التذاكر والطيران', group: 'الحج والعمرة', icon: 'ticket', element: <TicketingPage /> },
  { id: 'hajj-umrah-transport', path: '/hajj-umrah/transport', label: 'النقل والتفويج', group: 'الحج والعمرة', icon: 'transport', element: <TransportPage /> },
  { id: 'hajj-umrah-trip-operations', path: '/hajj-umrah/trip-operations', label: 'تشغيل الرحلة', group: 'الحج والعمرة', icon: 'operations', element: <TripOperationsPage /> },
  { id: 'hajj-umrah-readiness', path: '/hajj-umrah/readiness', label: 'مركز الجاهزية والتشغيل', group: 'الحج والعمرة', icon: 'readiness', element: <HajjUmrahReadinessPage /> },
  { id: 'hajj-umrah-barcode', path: '/hajj-umrah/barcode', label: 'باركود العمرة', group: 'الحج والعمرة', icon: 'barcode', element: <UmrahBarcodePage /> },

  { id: 'appearance-settings', path: '/settings/appearance', label: 'المظهر والتنقل', group: 'الإعدادات', icon: 'appearance', element: <AppearanceSettingsPage /> },
);

export function findRoute(pathname: string, routes: readonly AppRoute[] = foundationRoutes): AppRoute {
  return routes.find((route) => route.path === pathname) ?? routes[0]!;
}
