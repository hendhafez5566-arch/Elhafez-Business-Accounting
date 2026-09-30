export { FinancialReportingModule } from '../financial-reporting.module.js';
export { FinancialReportingApplicationService, type StructuredReportExport } from '../application/financial-reporting.application-service.js';
export type { ReportingEvidence, ReportingEvidenceKind, AccountClass, PositionKind, ReportScope, ReportMetadata } from '../domain/reporting.js';
export { LEGACY_DOCUMENT_CATALOG, renderCanonicalDocument } from '../application/document-renderer.js';
export type { LegacyDocumentId, LegalPrintIdentity, DocumentCell, DocumentRow, RenderDocumentInput, RenderedDocument } from '../application/document-renderer.js';
