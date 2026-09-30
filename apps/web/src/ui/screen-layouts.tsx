import type { ReactNode } from 'react';
import { Button } from './primitives.js';

/**
 * Structural screen blueprints are intentionally separate from visual themes.
 * A theme may change tokens/presentation; a blueprint defines page composition.
 */
export const SCREEN_BLUEPRINTS = {
  dashboard: 'dashboard',
  module: 'module',
  dataTable: 'data-table',
  masterDetail: 'master-detail',
  split: 'split',
  settings: 'settings',
  kanban: 'kanban',
  matrix: 'matrix',
  form: 'form',
  stepper: 'stepper',
  timeline: 'timeline',
  documents: 'documents',
  commandCenter: 'command-center',
  operations: 'operations',
  profile: 'profile',
} as const;

export type ScreenBlueprint = typeof SCREEN_BLUEPRINTS[keyof typeof SCREEN_BLUEPRINTS];

/** The 39 owner-supplied UI references. These are structural specifications, not theme names. */
export const SCREEN_REFERENCE_IDS = {
  fleetTransport: 'fleet-transport',
  teamTaskWorkflow: 'team-task-workflow',
  customerManagement: 'customer-management',
  tripOperations: 'trip-operations',
  tourismBookings: 'tourism-bookings',
  supplierDisputes: 'supplier-disputes',
  tourismContracts: 'tourism-contracts',
  companySystemSettings: 'company-system-settings',
  bankReconciliation: 'bank-reconciliation',
  accountStatement: 'account-statement',
  agentsCommissions: 'agents-commissions',
  currencyFx: 'currency-fx',
  costCentersBudgets: 'cost-centers-budgets',
  vatTaxReturns: 'vat-tax-returns',
  purchaseOrders: 'purchase-orders',
  auditTrail: 'audit-trail',
  chartOfAccounts: 'chart-of-accounts',
  billingInvoicing: 'billing-invoicing',
  masterModuleTemplate: 'master-module-template',
  hrPayroll: 'hr-payroll',
  voucherTicketingCenter: 'voucher-ticketing-center',
  assetsDepreciation: 'assets-depreciation',
  tourismInventoryMatrix: 'tourism-inventory-matrix',
  crmLeadPipeline: 'crm-lead-pipeline',
  roomingAllocation: 'rooming-allocation',
  saasControlPlane: 'saas-control-plane',
  treasurySettlement: 'treasury-settlement',
  documentManagement: 'document-management',
  systemAdministration: 'system-administration',
  tourismItineraryBuilder: 'tourism-itinerary-builder',
  financialReportingCenter: 'financial-reporting-center',
  supplierIntelligence: 'supplier-intelligence',
  hajjUmrahKanban: 'hajj-umrah-kanban',
  mainDashboard: 'main-dashboard',
  journalEntryForm: 'journal-entry-form',
  quotationStepper: 'quotation-stepper',
  appLayout: 'app-layout',
  dataTable: 'data-table',
  atoms: 'atoms',
} as const;

export type ScreenReferenceId = typeof SCREEN_REFERENCE_IDS[keyof typeof SCREEN_REFERENCE_IDS];

export interface ScreenDesign {
  readonly blueprint: ScreenBlueprint;
  readonly reference: ScreenReferenceId;
}

export interface WorkspaceNavigationItem {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
}

const blueprintValues = new Set<string>(Object.values(SCREEN_BLUEPRINTS));
const referenceValues = new Set<string>(Object.values(SCREEN_REFERENCE_IDS));

export function isScreenDesign(value: unknown): value is ScreenDesign {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { blueprint?: unknown; reference?: unknown };
  return typeof candidate.blueprint === 'string'
    && typeof candidate.reference === 'string'
    && blueprintValues.has(candidate.blueprint)
    && referenceValues.has(candidate.reference);
}

/**
 * Canonical route content boundary. This replaces the old ui-page-stack wrapper;
 * it does not wrap that wrapper or create a theme-specific page hierarchy.
 */
export function ScreenLayoutBoundary({
  design,
  children,
}: {
  readonly design: ScreenDesign;
  readonly children: ReactNode;
}) {
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

export function WorkspacePane({
  variant,
  className = '',
  surface = true,
  children,
}: {
  readonly variant?: 'primary' | 'secondary' | 'master' | 'detail' | 'nav' | 'content';
  readonly className?: string;
  readonly surface?: boolean;
  readonly children: ReactNode;
}) {
  const classes = [
    surface ? 'ui-card' : '',
    'ui-workspace-pane',
    variant ? `ui-workspace-pane--${variant}` : '',
    className,
  ].filter(Boolean).join(' ');
  return <section className={classes}>{children}</section>;
}

export function WorkspaceNavigation({
  items,
  active,
  onChange,
  ariaLabel = 'التنقل داخل مساحة العمل',
}: {
  readonly items: readonly WorkspaceNavigationItem[];
  readonly active: string;
  readonly onChange: (id: string) => void;
  readonly ariaLabel?: string;
}) {
  return (
    <nav className="ui-grid-sm" aria-label={ariaLabel}>
      {items.map((item) => (
        <Button
          key={item.id}
          type="button"
          variant={active === item.id ? 'primary' : 'secondary'}
          aria-current={active === item.id ? 'page' : undefined}
          title={item.description}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </Button>
      ))}
    </nav>
  );
}

export function SplitWorkspace({
  left,
  right,
  className = '',
}: {
  readonly left: ReactNode;
  readonly right: ReactNode;
  readonly className?: string;
}) {
  return (
    <div className={['ui-dashboard-grid', 'ui-workspace-split', className].filter(Boolean).join(' ')}>
      <WorkspacePane variant="primary">{left}</WorkspacePane>
      <WorkspacePane variant="secondary">{right}</WorkspacePane>
    </div>
  );
}

export function MasterDetailWorkspace({
  master,
  detail,
  className = '',
}: {
  readonly master: ReactNode;
  readonly detail?: ReactNode;
  readonly className?: string;
}) {
  return (
    <div className={['ui-dashboard-grid', 'ui-workspace-master-detail', className].filter(Boolean).join(' ')}>
      <WorkspacePane variant="master">{master}</WorkspacePane>
      {detail !== undefined ? <WorkspacePane variant="detail">{detail}</WorkspacePane> : null}
    </div>
  );
}

export function SettingsWorkspace({
  navigation,
  content,
  className = '',
}: {
  readonly navigation: ReactNode;
  readonly content: ReactNode;
  readonly className?: string;
}) {
  return (
    <div className={['ui-settings-grid', 'ui-workspace-settings', className].filter(Boolean).join(' ')}>
      <WorkspacePane variant="nav">{navigation}</WorkspacePane>
      <WorkspacePane variant="content" surface={false}>{content}</WorkspacePane>
    </div>
  );
}
