import type {
  HistoricalEquivalence,
  HistoricalImportRecord,
} from "./historical-import.application-service.js";
export const HISTORICAL_IMPORT_REPOSITORY = Symbol(
  "HISTORICAL_IMPORT_REPOSITORY",
);
export interface HistoricalCanonicalRecord {
  readonly collection: string;
  readonly sourceId: string;
  readonly companyId: string;
  readonly branchId?: string;
  readonly payload: Readonly<Record<string, unknown>>;
}
export interface HistoricalImportRepository {
  find(
    runId: string,
    collection: string,
    sourceId: string,
  ): Promise<HistoricalImportRecord | undefined>;
  create(record: HistoricalImportRecord): Promise<void>;
  equivalence(runId: string, companyId: string): Promise<HistoricalEquivalence>;
  canonicalRecords(
    runId: string,
    companyId: string,
  ): Promise<readonly HistoricalCanonicalRecord[]>;
}
