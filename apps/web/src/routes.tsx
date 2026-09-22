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

export interface AppRoute { readonly id:string; readonly path:string; readonly label:string; readonly group?:string; readonly element:ReactNode; }
export function defineRoutes(...routes: readonly AppRoute[]): readonly AppRoute[] { const ids=new Set<string>(),paths=new Set<string>();for(const route of routes){if(ids.has(route.id))throw new Error(`Duplicate route id: ${route.id}`);if(paths.has(route.path))throw new Error(`Duplicate route path: ${route.path}`);ids.add(route.id);paths.add(route.path);}return Object.freeze([...routes]); }
export const foundationRoutes=defineRoutes(
  {id:'foundation',path:'/',label:'الرئيسية',element:'مساحة العمل جاهزة للوحدات.'},
  {id:'crm-dashboard',path:'/crm/dashboard',label:'لوحة العملاء والمبيعات',group:'العملاء والمبيعات',element:<CrmSalesDashboardPage/>},
  {id:'crm-customers',path:'/crm/customers',label:'العملاء',group:'العملاء والمبيعات',element:<CustomersPage/>},
  {id:'crm-customer-360',path:'/crm/customer-360',label:'Customer 360',group:'العملاء والمبيعات',element:<Customer360Page/>},
  {id:'crm-agents',path:'/crm/agents',label:'الوكلاء',group:'العملاء والمبيعات',element:<AgentsPage/>},
  {id:'crm-agent-360',path:'/crm/agent-360',label:'Agent 360',group:'العملاء والمبيعات',element:<Agent360Page/>},
  {id:'crm-leads',path:'/crm/leads',label:'العملاء المحتملون',group:'العملاء والمبيعات',element:<LeadsPage/>},
  {id:'crm-quotations',path:'/crm/quotations',label:'عروض الأسعار',group:'العملاء والمبيعات',element:<QuotationsPage/>},
  {id:'crm-followups',path:'/crm/followups',label:'المتابعات',group:'العملاء والمبيعات',element:<FollowupsPage/>},
  {id:'crm-travelers',path:'/crm/travelers',label:'المسافرون',group:'العملاء والمبيعات',element:<TravelersPage/>},
  {id:'supplier-management',path:'/procurement/suppliers',label:'الموردون',group:'المشتريات والموردون',element:<SuppliersPage/>},
  {id:'supplier-intelligence',path:'/procurement/supplier-intelligence',label:'تقييم ومتابعة الموردين',group:'المشتريات والموردون',element:<SupplierIntelligencePage/>},
  {id:'procurement-operations',path:'/procurement/purchase-orders',label:'أوامر الشراء',group:'المشتريات والموردون',element:<ProcurementOperationsPage/>},
  {id:'hajj-umrah-seasons',path:'/hajj-umrah/seasons',label:'المواسم',group:'الحج والعمرة',element:<SeasonsPage/>},
  {id:'hajj-umrah-programs',path:'/hajj-umrah/programs',label:'برامج الحج والعمرة',group:'الحج والعمرة',element:<ProgramsPage/>},
  {id:'hajj-umrah-program-workspace',path:'/hajj-umrah/program-workspace',label:'مساحة عمل البرنامج',group:'الحج والعمرة',element:<ProgramWorkspacePage/>},
  {id:'hajj-umrah-bookings',path:'/hajj-umrah/bookings',label:'الحجوزات',group:'الحج والعمرة',element:<BookingsPage/>},
  {id:'hajj-umrah-rooming',path:'/hajj-umrah/rooming',label:'تسكين الغرف',group:'الحج والعمرة',element:<RoomingPage/>},
  {id:'hajj-umrah-visas',path:'/hajj-umrah/visas',label:'التأشيرات',group:'الحج والعمرة',element:<VisasPage/>},
  {id:'hajj-umrah-ticketing',path:'/hajj-umrah/ticketing',label:'التذاكر والطيران',group:'الحج والعمرة',element:<TicketingPage/>},
  {id:'hajj-umrah-transport',path:'/hajj-umrah/transport',label:'النقل والتفويج',group:'الحج والعمرة',element:<TransportPage/>},
  {id:'hajj-umrah-trip-operations',path:'/hajj-umrah/trip-operations',label:'تشغيل الرحلة',group:'الحج والعمرة',element:<TripOperationsPage/>},
);
export function findRoute(pathname:string,routes:readonly AppRoute[]=foundationRoutes):AppRoute{return routes.find(route=>route.path===pathname)??routes[0]!;}
