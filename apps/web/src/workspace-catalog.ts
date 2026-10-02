import type { IconName } from './ui/icons.js';

export type WorkspaceId = 'hajj-umrah' | 'crm' | 'tourism' | 'procurement' | 'accounting' | 'reports' | 'administration';

export interface WorkspaceDefinition {
  readonly id: WorkspaceId;
  readonly label: string;
  readonly description: string;
  readonly icon: IconName;
  readonly landingPath: string;
  readonly routeGroups: readonly string[];
}

export const WORKSPACES: readonly WorkspaceDefinition[] = Object.freeze([
  {
    id: 'hajj-umrah',
    label: 'الحج والعمرة',
    description: 'المواسم والبرامج والحجوزات والتسكين والتأشيرات والنقل والتشغيل.',
    icon: 'calendar',
    landingPath: '/hajj-umrah/seasons',
    routeGroups: ['الحج والعمرة'],
  },
  {
    id: 'crm',
    label: 'المبيعات والعملاء',
    description: 'العملاء والمندوبون والمتابعات والفرص وعروض الأسعار.',
    icon: 'customers',
    landingPath: '/crm/dashboard',
    routeGroups: ['المبيعات والعملاء CRM'],
  },
  {
    id: 'tourism',
    label: 'الخدمات السياحية',
    description: 'الخدمات والبرامج والحجوزات والتعاقدات والمخزون السياحي.',
    icon: 'tourism',
    landingPath: '/tourism/services',
    routeGroups: ['السياحة والخدمات'],
  },
  {
    id: 'procurement',
    label: 'المشتريات والموردون',
    description: 'الموردون والتوريد وأوامر الشراء والمرتجعات والمتابعة.',
    icon: 'purchase',
    landingPath: '/procurement/suppliers',
    routeGroups: ['المشتريات والموردون'],
  },
  {
    id: 'accounting',
    label: 'المحاسبة والمالية',
    description: 'المحاسبة والخزائن والبنوك والفواتير والتسويات والضرائب.',
    icon: 'analytics',
    landingPath: '/accounting',
    routeGroups: ['المحاسبة والمالية'],
  },
  {
    id: 'reports',
    label: 'التقارير والرقابة',
    description: 'التقارير والمخرجات والاستثناءات والموافقات والرقابة التشغيلية.',
    icon: 'dashboard',
    landingPath: '/management/dashboard',
    routeGroups: ['الإدارة والتحكم'],
  },
  {
    id: 'administration',
    label: 'الإدارة والإعدادات',
    description: 'إدارة النظام والمستخدمين والإعدادات وتهيئة تجربة الاستخدام.',
    icon: 'settings',
    landingPath: '/system-administration',
    routeGroups: ['إدارة النظام', 'الإعدادات'],
  },
]);

export function workspaceForGroup(group?: string): WorkspaceDefinition | undefined {
  if (!group) return undefined;
  return WORKSPACES.find(workspace => workspace.routeGroups.includes(group));
}
