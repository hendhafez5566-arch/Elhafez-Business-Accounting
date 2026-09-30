import { type ReactNode, useState } from 'react';
import { findRoute, foundationRoutes, type AppRoute } from './routes.js';
import {
  initialShellState,
  setAutoSidebarActive,
  setMobileDrawer,
} from './shell-state.js';
import {
  Drawer,
  PageHeader,
  type UiPreferences,
  UiPreferencesProvider,
  useUiPreferences,
  ScreenLayoutBoundary,
} from './ui.js';
import { NavigationMenu, Sidebar, Topbar } from './ui/navigation.js';

export interface AppShellProps {
  readonly routes?: readonly AppRoute[];
  readonly pathname?: string;
  readonly children?: ReactNode;
  readonly preferenceScope?: string;
  readonly initialPreferences?: Partial<UiPreferences>;
  readonly companyLabel?: string;
  readonly branchLabel?: string;
  readonly branches?: readonly {readonly id:string;readonly name:string}[];
  readonly branchId?: string;
  readonly onBranchChange?: (id:string)=>void;
  readonly onLogout?: ()=>void;
  readonly sessionKey?: string;
}

const groupDescriptions:Record<string,string>={
  'الإدارة والتحكم':'متابعة مؤشرات الأداء، الاستثناءات، الأولويات وسير العمل من مصادر النظام المعتمدة.',
  'إدارة النظام':'إدارة المستخدمين والصلاحيات والشركة والفروع والملفات وإعدادات تشغيل المنصة.',
  'المبيعات والعملاء CRM':'إدارة دورة العميل والمندوب والمتابعة والعروض والفرص التجارية من مكان واحد.',
  'المشتريات والموردون':'إدارة الموردين والتوريد وأوامر الشراء والتنفيذ والتقييم والمنازعات.',
  'السياحة والخدمات':'إدارة البرامج والحجوزات والخدمات والعقود والمخزون والمسارات السياحية.',
  'المحاسبة والمالية':'تشغيل القيود والفواتير والخزائن والبنوك والضرائب والتقارير من مصادر الحقيقة المالية.',
  'الحج والعمرة':'تشغيل المواسم والبرامج والحجوزات والتسكين والتأشيرات والنقل والتفويج والجاهزية.',
  'الإعدادات':'تهيئة تجربة الاستخدام وبيانات الحساب وتفضيلات النظام.',
};

const routeDescriptions:Record<string,string>={
  foundation:'ملخص تنفيذي لأهم مؤشرات التشغيل والمالية والبنود التي تحتاج متابعة الآن.',
  'crm-customers':'السجل المركزي للعملاء أفرادًا وشركات مع التواصل والموقف التجاري والمالي.',
  'tourism-bookings':'إدارة واعتماد حجوزات البرامج السياحية وربطها بالعميل والمسافرين والمخزون والتمويل.',
  'tourism-contract-inventory':'متابعة عقود الفنادق والنقل والطيران والتأشيرات والمخزون والتخصيصات المرتبطة بها.',
  'supplier-intelligence':'ملف المورد 360° للتقييم والأداء والمستحقات والمنازعات وحالات الإيقاف.',
  'accounting-workspace':'مساحة مالية موحدة تشمل الدليل المحاسبي والقيود والفواتير والتسويات والضرائب والتقارير.',
  'hajj-umrah-transport':'إدارة رحلات النقل والتفويج والمركبات والسائقين وكشوف المسافرين.',
  'hajj-umrah-trip-operations':'غرفة التشغيل الميداني للمهام والخدمات والحوادث ومتابعة التنفيذ.',
};

export function AppShell({
  routes = foundationRoutes,
  pathname = '/',
  children,
  preferenceScope = 'local-user',
  initialPreferences,
  companyLabel,
  branchLabel,
  branches,
  branchId,
  onBranchChange,
  onLogout,
  sessionKey,
}: AppShellProps) {
  return (
    <UiPreferencesProvider scope={preferenceScope} initialPreferences={initialPreferences}>
      <AppShellFrame routes={routes} pathname={pathname} companyLabel={companyLabel} branchLabel={branchLabel} branches={branches} branchId={branchId} onBranchChange={onBranchChange} onLogout={onLogout} sessionKey={sessionKey}>{children}</AppShellFrame>
    </UiPreferencesProvider>
  );
}

function AppShellFrame({
  routes,
  pathname,
  children,
  companyLabel,
  branchLabel,
  branches,
  branchId,
  onBranchChange,
  onLogout,
  sessionKey,
}: {
  readonly routes: readonly AppRoute[];
  readonly pathname: string;
  readonly children?: ReactNode;
  readonly companyLabel?: string;
  readonly branchLabel?: string;
  readonly branches?: readonly {readonly id:string;readonly name:string}[];
  readonly branchId?: string;
  readonly onBranchChange?: (id:string)=>void;
  readonly onLogout?: ()=>void;
  readonly sessionKey?: string;
}) {
  const [state, setState] = useState(initialShellState);
  const active = findRoute(pathname, routes);
  const { preferences, updatePreferences } = useUiPreferences();
  const sidebarExpanded =
    preferences.sidebarMode === 'fixed'
    || (preferences.sidebarMode === 'auto' && state.autoSidebarActive);
  const description=routeDescriptions[active.id]??groupDescriptions[active.group??''];

  function quickToggle() {
    updatePreferences({
      sidebarMode: preferences.sidebarMode === 'fixed' ? 'compact' : 'fixed',
    });
  }

  return (
    <div
      className="app-shell"
      dir="rtl"
      data-route-id={active.id}
      data-screen-blueprint={active.design.blueprint}
      data-screen-reference={active.design.reference}
      data-sidebar-mode={preferences.sidebarMode}
      data-sidebar-expanded={sidebarExpanded ? 'true' : 'false'}
    >
      <Sidebar
        routes={routes}
        activeId={active.id}
        mode={preferences.sidebarMode}
        autoActive={state.autoSidebarActive}
        onAutoActiveChange={(activeState) =>
          setState((current) => setAutoSidebarActive(current, activeState))
        }
        onQuickToggle={quickToggle}
      />

      <Drawer
        open={state.mobileDrawerOpen}
        title="التنقل"
        onClose={() => setState((current) => setMobileDrawer(current, false))}
      >
        <NavigationMenu
          routes={routes}
          activeId={active.id}
          labelsVisible
          onNavigate={() => setState((current) => setMobileDrawer(current, false))}
        />
      </Drawer>

      <Topbar routes={routes} onOpenMobile={() => setState((current) => setMobileDrawer(current, true))} companyLabel={companyLabel} branchLabel={branchLabel} branches={branches} branchId={branchId} onBranchChange={onBranchChange} onLogout={onLogout} />

      <main className="app-main">
        <div className="app-content" tabIndex={-1}>
          <PageHeader eyebrow={active.group} title={active.label} description={description} />
          <ScreenLayoutBoundary design={active.design} key={sessionKey}>{children ?? active.element}</ScreenLayoutBoundary>
        </div>
      </main>
    </div>
  );
}