import type { MigrationConfig, MigrationIssueCode } from "@elhafez/platform-core";
import type { SourceProcessingStrategy } from "./source-registry.js";

export const AC14_OWNER_IMPORT_GATEWAY = Symbol("AC14_OWNER_IMPORT_GATEWAY");

export interface HistoricalImportUnit {
  runId: string;
  stage: string;
  owner: string;
  /** Exact original frozen v32.5.66 key. */
  sourceCollection: string;
  /** Narrow target-owner API vocabulary; never used as source provenance. */
  importKind: string;
  /** Semantic target kind written to the AC-14 crosswalk. */
  targetKind: string;
  processingStrategy: SourceProcessingStrategy;
  sourceId: string;
  sourcePayloadHash: string;
  targetCompanyId: string;
  targetBranchId?: string;
  payload: Readonly<Record<string, unknown>>;
}

export type HistoricalImportOutcome =
  | { status: "IMPORTED" | "CONVERGED"; targetKind: string; targetId: string }
  | { status: "REJECTED"; code: MigrationIssueCode; detail: string };

export interface OwnerEquivalence {
  records: string;
  payloadDigest: string;
  debit: string;
  credit: string;
  amount: string;
}
export type EquivalenceValues = Readonly<Record<string, string>>;

export interface Ac14OwnerImportGateway {
  validateUnit(unit: HistoricalImportUnit): void;
  importUnit(unit: HistoricalImportUnit): Promise<HistoricalImportOutcome>;
  rebuildReporting(
    runId: string,
    config: MigrationConfig,
  ): Promise<{ evidenceCount: string }>;
  ownerEquivalence(
    owner: string,
    runId: string,
    companyId: string,
  ): Promise<EquivalenceValues>;
  ownerNames(): readonly string[];
}
