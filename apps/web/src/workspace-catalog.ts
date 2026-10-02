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
  { id: 'hajj-umrah', label: 'الحج والعمرة', description: 'المواسم والبرامج والحجوزات والتشغيل.', icon: 'calendar', landingPath: '/hajj-umrah/seasons', routeGroups: ['الحج والعمرة'] },
  { id: 'crm', label: 'المبيعات والعملاء', description: 'المبيعات والعملاء والمتابعة.', icon: 'customers', landingPath: '/crm/dashboard', routeGroups: ['المبيعات والعملاء'] },
  { id: 'tourism', label: 'الخدمات السياحية', description: 'الخدمات والبرامج والحجوزات السياحية.', icon: 'tourism', landingPath: '/tourism/services', routeGroups: ['الخدمات السياحية'] },
  { id: 'procurement', label: 'المشتريات والموردون', description: 'المشتريات والموردون والتوريد.', icon: 'purchase', landingPath: '/procurement/suppliers', routeGroups: ['المشتريات والموردون'] },
  { id: 'accounting', label: 'المحاسبة والمالية', description: 'المحاسبة والإدارة المالية.', icon: 'analytics', landingPath: '/accounting', routeGroups: ['المحاسبة والمالية'] },
  { id: 'reports', label: 'التقارير والرقابة', description: 'التقارير والرقابة والمتابعة.', icon: 'dashboard', landingPath: '/management/dashboard', routeGroups: ['التقارير والرقابة'] },
  { id: 'administration', label: 'الإدارة والإعدادات', description: 'إدارة النظام والإعدادات.', icon: 'settings', landingPath: '/system-administration', routeGroups: ['الإدارة والإعدادات'] },
]);

export function workspaceForGroup(group?: string): WorkspaceDefinition | undefined {
  if (!group) return undefined;
  return WORKSPACES.find(workspace => workspace.routeGroups.includes(group));
}
