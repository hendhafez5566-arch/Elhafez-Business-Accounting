/** Supplier Intelligence — Public API barrel.
 *
 * This module owns:
 * - Manual supplier evaluations (append-only, versioned)
 * - Supplier disputes and dispute lifecycle
 * - Supplier 360 orchestration (read model only)
 *
 * This module does NOT own:
 * - Supplier profile/identity (owned by Supplier Management)
 * - Purchase Orders or commitments (owned by Procurement Finance)
 * - Fulfillment evidence (owned by Procurement Fulfillment)
 * - Supplier invoices or payables (owned by Billing Subledgers)
 */

// Domain types
export type {
  SupplierEvaluation,
  EvaluationScore,
  SupplierDispute,
  DisputeSeverity,
  DisputeStatus,
  DisputeResolution,
  DisputeHistoryEntry,
} from '../domain/supplier-intelligence.types.js';

// Application services
export {
  SupplierIntelligenceApplicationService,
  SUPPLIER_INTELLIGENCE_PERMISSIONS,
} from '../application/supplier-intelligence.application-service.js';

export type {
  CreateEvaluationInput,
  EvaluationView,
  CreateDisputeInput,
  ResolveDisputeInput,
  CancelDisputeInput,
  ReleaseHoldInput,
  Supplier360View,
  ProcurementMetrics,
} from '../application/supplier-intelligence.application-service.js';

// Repository port
export type {
  SupplierIntelligenceRepository,
  SupplierIntelligenceRepositoryToken,
} from '../application/supplier-intelligence.repository.js';
