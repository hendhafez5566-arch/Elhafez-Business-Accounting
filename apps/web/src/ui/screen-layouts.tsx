import { type ReactNode } from 'react';

/**
 * SCREEN LAYOUT ARCHITECTURE
 * 
 * This module defines the canonical structural layout system for El-Hafez.
 * Every route MUST declare a ScreenDesign (blueprint + reference).
 * 
 * Theme = visual presentation only (colors, typography, shadows, density).
 * Screen Blueprint = structural composition (grid layout, split panes, kanban columns, trees, steppers, matrices).
 * 
 * Redesign rules:
 * - Theme changes alone (colors/buttons/cards) do NOT count as screen redesign.
 * - Completion requires internal layout to match its reference blueprint.
 * - Never wrap an obsolete layout with a new one. Replace it.
 * - No wrapper-on-wrapper; one canonical boundary per route.
 * - The 39 references are structural specifications, not merely color inspiration.
 */

// ==========================================
// STRUCTURAL BLUEPRINT FAMILIES
// ==========================================

export type ScreenBlueprint =
  | 'dashboard'
  | 'module'
  | 'directory'
  | 'master-detail'
  | 'entity-360'
  | 'workflow'
  | 'kanban'
  | 'split'
  | 'settings'
  | 'tree'
  | 'stepper'
  | 'transaction'
  | 'matrix'
  | 'documents'
  | 'reporting';

export const SCREEN_BLUEPRINTS = Object.freeze({
  dashboard: 'dashboard',
  module: 'module',
  directory: 'directory',
  masterDetail: 'master-detail',
  entity360: 'entity-360',
  workflow: 'workflow',
  kanban: 'kanban',
  split: 'split',
  settings: 'settings',
  tree: 'tree',
  stepper: 'stepper',
  transaction: 'transaction',
  matrix: 'matrix',
  documents: 'documents',
  reporting: 'reporting',
} as const);

// ==========================================
// SCREEN REFERENCE IDS (39 owner-defined)
// ==========================================

export type ScreenReferenceId =
  | 'fleet-transport'
  | 'team-task-workflow'
  | 'customer-management'
  | 'trip-operations'
  | 'tourism-bookings'
  | 'supplier-disputes'
  | 'tourism-contracts'
  | 'company-system-settings'
  | 'bank-reconciliation'
  | 'account-statement'
  | 'agents-commissions'
  | 'currency-fx'
  | 'cost-centers-budgets'
  | 'vat-tax-returns'
  | 'purchase-orders'
  | 'audit-trail'
  | 'chart-of-accounts'
  | 'billing-invoicing'
  | 'master-module'
  | 'hr-payroll'
  | 'voucher-ticketing'
  | 'assets-depreciation'
  | 'tourism-inventory-matrix'
  | 'crm-lead-pipeline'
  | 'rooming-allocation'
  | 'saas-control-plane'
  | 'treasury-settlement'
  | 'document-management'
  | 'system-administration'
  | 'tourism-itinerary-builder'
  | 'financial-reporting'
  | 'supplier-intelligence'
  | 'hajj-umrah-kanban'
  | 'main-dashboard'
  | 'journal-entry'
  | 'quotation-stepper'
  | 'app-layout'
  | 'data-table'
  | 'atoms';

export const SCREEN_REFERENCE_IDS = Object.freeze({
  'fleet-transport': 'fleet-transport',
  'team-task-workflow': 'team-task-workflow',
  'customer-management': 'customer-management',
  'trip-operations': 'trip-operations',
  'tourism-bookings': 'tourism-bookings',
  'supplier-disputes': 'supplier-disputes',
  'tourism-contracts': 'tourism-contracts',
  'company-system-settings': 'company-system-settings',
  'bank-reconciliation': 'bank-reconciliation',
  'account-statement': 'account-statement',
  'agents-commissions': 'agents-commissions',
  'currency-fx': 'currency-fx',
  'cost-centers-budgets': 'cost-centers-budgets',
  'vat-tax-returns': 'vat-tax-returns',
  'purchase-orders': 'purchase-orders',
  'audit-trail': 'audit-trail',
  'chart-of-accounts': 'chart-of-accounts',
  'billing-invoicing': 'billing-invoicing',
  'master-module': 'master-module',
  'hr-payroll': 'hr-payroll',
  'voucher-ticketing': 'voucher-ticketing',
  'assets-depreciation': 'assets-depreciation',
  'tourism-inventory-matrix': 'tourism-inventory-matrix',
  'crm-lead-pipeline': 'crm-lead-pipeline',
  'rooming-allocation': 'rooming-allocation',
  'saas-control-plane': 'saas-control-plane',
  'treasury-settlement': 'treasury-settlement',
  'document-management': 'document-management',
  'system-administration': 'system-administration',
  'tourism-itinerary-builder': 'tourism-itinerary-builder',
  'financial-reporting': 'financial-reporting',
  'supplier-intelligence': 'supplier-intelligence',
  'hajj-umrah-kanban': 'hajj-umrah-kanban',
  'main-dashboard': 'main-dashboard',
  'journal-entry': 'journal-entry',
  'quotation-stepper': 'quotation-stepper',
  'app-layout': 'app-layout',
  'data-table': 'data-table',
  'atoms': 'atoms',
} as const);

// ==========================================
// SCREEN DESIGN (BLUEPRINT + REFERENCE)
// ==========================================

export interface ScreenDesign {
  readonly blueprint: ScreenBlueprint;
  readonly reference: ScreenReferenceId;
}

/**
 * Runtime guard to validate ScreenDesign.
 * Ensures both blueprint and reference are canonical.
 */
export function isScreenDesign(value: unknown): value is ScreenDesign {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  
  const blueprintValues = Object.values(SCREEN_BLUEPRINTS);
  const referenceValues = Object.values(SCREEN_REFERENCE_IDS);
  
  return (
    typeof obj.blueprint === 'string' &&
    typeof obj.reference === 'string' &&
    blueprintValues.includes(obj.blueprint as ScreenBlueprint) &&
    referenceValues.includes(obj.reference as ScreenReferenceId)
  );
}

// ==========================================
// SCREEN LAYOUT BOUNDARY
// ==========================================

export interface ScreenLayoutBoundaryProps {
  readonly design: ScreenDesign;
  readonly children?: ReactNode;
}

/**
 * ScreenLayoutBoundary is the CANONICAL structural boundary for routes.
 * It REPLACES the existing ui-page-stack wrapper, not adds above/below it.
 * 
 * Renders ONE boundary carrying:
 * - ui-page-stack: the existing structural container
 * - ui-screen-layout: the layout architecture marker
 * - ui-screen-layout--{blueprint}: the blueprint family class
 * - data-screen-blueprint: observable/testable attribute
 * - data-screen-reference: observable/testable attribute
 * 
 * Zero extra nesting. Content flows directly into ui-page-stack.
 */
export function ScreenLayoutBoundary({ design, children }: ScreenLayoutBoundaryProps) {
  return (
    <div
      className={`ui-page-stack ui-screen-layout ui-screen-layout--${design.blueprint}`}
      data-screen-blueprint={design.blueprint}
      data-screen-reference={design.reference}
    >
      {children}
    </div>
  );
}

// ==========================================
// REUSABLE STRUCTURAL PATTERNS
// ==========================================

/**
 * SplitWorkspace: two-column layout with optional resize handle.
 * Structure only. No business state, APIs, or theme colors.
 * No inline styles.
 */
export interface SplitWorkspaceProps {
  readonly left: ReactNode;
  readonly right: ReactNode;
  readonly className?: string;
}

export function SplitWorkspace({ left, right, className }: SplitWorkspaceProps) {
  return (
    <div className={`ui-workspace-split ${className ?? ''}`}>
      <div className="ui-workspace-pane ui-workspace-pane--primary">{left}</div>
      <div className="ui-workspace-pane ui-workspace-pane--secondary">{right}</div>
    </div>
  );
}

/**
 * MasterDetailWorkspace: list (master) + detail drawer/pane on right.
 * Structure only. No business state, APIs, or theme colors.
 * No inline styles.
 */
export interface MasterDetailWorkspaceProps {
  readonly master: ReactNode;
  readonly detail?: ReactNode;
  readonly className?: string;
}

export function MasterDetailWorkspace({ master, detail, className }: MasterDetailWorkspaceProps) {
  return (
    <div className={`ui-workspace-master-detail ${className ?? ''}`}>
      <div className="ui-workspace-pane ui-workspace-pane--master">{master}</div>
      {detail && <div className="ui-workspace-pane ui-workspace-pane--detail">{detail}</div>}
    </div>
  );
}

/**
 * SettingsWorkspace: settings rail (navigation) + content area.
 * Structure only. No business state, APIs, or theme colors.
 * No inline styles.
 */
export interface SettingsWorkspaceProps {
  readonly navigation: ReactNode;
  readonly content: ReactNode;
  readonly className?: string;
}

export function SettingsWorkspace({ navigation, content, className }: SettingsWorkspaceProps) {
  return (
    <div className={`ui-workspace-settings ${className ?? ''}`}>
      <nav className="ui-workspace-pane ui-workspace-pane--nav">{navigation}</nav>
      <div className="ui-workspace-pane ui-workspace-pane--content">{content}</div>
    </div>
  );
}

/**
 * WorkspacePane: a single structural pane within a workspace layout.
 * Can be used independently when workspace helpers don't fit.
 * Structure only. No business state, APIs, or theme colors.
 * No inline styles.
 */
export interface WorkspacePaneProps {
  readonly variant?: 'primary' | 'secondary' | 'master' | 'detail' | 'nav' | 'content';
  readonly children: ReactNode;
  readonly className?: string;
}

export function WorkspacePane({ variant, children, className }: WorkspacePaneProps) {
  const variantClass = variant ? `ui-workspace-pane--${variant}` : '';
  return (
    <div className={`ui-workspace-pane ${variantClass} ${className ?? ''}`}>
      {children}
    </div>
  );
}

