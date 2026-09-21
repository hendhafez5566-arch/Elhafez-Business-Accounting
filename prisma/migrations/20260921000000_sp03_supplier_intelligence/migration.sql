-- SP-03 Supplier Intelligence — supplier evaluations, disputes, and dispute history.

-- Create si_supplier_evaluations table
CREATE TABLE si_supplier_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    branch_id UUID NOT NULL,
    supplier_party_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    quality_score INTEGER NOT NULL CHECK (quality_score >= 1 AND quality_score <= 5),
    service_score INTEGER NOT NULL CHECK (service_score >= 1 AND service_score <= 5),
    notes TEXT,
    evaluated_by TEXT NOT NULL,
    evaluated_at TEXT NOT NULL,
    request_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX si_supplier_evaluations_company_supplier_version_idx 
    ON si_supplier_evaluations(company_id, supplier_party_id, version);

CREATE INDEX si_supplier_evaluations_company_branch_supplier_version_idx 
    ON si_supplier_evaluations(company_id, branch_id, supplier_party_id, version);

-- Create si_supplier_disputes table
CREATE TABLE si_supplier_disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    branch_id UUID NOT NULL,
    supplier_party_id TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    attachment_ids JSONB,
    opened_by TEXT NOT NULL,
    opened_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'RESOLVED', 'CANCELLED')),
    request_hash TEXT NOT NULL,
    resolved_by TEXT,
    resolved_at TEXT,
    resolution TEXT,
    cancelled_by TEXT,
    cancelled_at TEXT,
    cancellation_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX si_supplier_disputes_company_branch_supplier_opened_idx 
    ON si_supplier_disputes(company_id, branch_id, supplier_party_id, opened_at);

CREATE INDEX si_supplier_disputes_company_status_opened_idx 
    ON si_supplier_disputes(company_id, status, opened_at);

-- Create si_supplier_dispute_history table
CREATE TABLE si_supplier_dispute_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    dispute_id UUID NOT NULL REFERENCES si_supplier_disputes(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    acted_at TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX si_supplier_dispute_history_company_dispute_acted_idx 
    ON si_supplier_dispute_history(company_id, dispute_id, acted_at);

-- Create sm_supplier_holds table (Supplier Management source-owned holds)
CREATE TABLE sm_supplier_holds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    supplier_id UUID NOT NULL,
    source_type TEXT NOT NULL,
    source_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    released_by TEXT,
    released_at TIMESTAMPTZ,
    release_reason TEXT
);

CREATE UNIQUE INDEX sm_supplier_holds_company_source_idx 
    ON sm_supplier_holds(company_id, source_type, source_id);

CREATE INDEX sm_supplier_holds_company_supplier_active_idx 
    ON sm_supplier_holds(company_id, supplier_id, active);

CREATE INDEX sm_supplier_holds_company_supplier_source_active_idx 
    ON sm_supplier_holds(company_id, supplier_id, source_type, active);

-- Backfill existing ON_HOLD suppliers into the new hold model
-- This uses LEGACY_MANUAL_HOLD as the source type for pre-existing ON_HOLD status
INSERT INTO sm_supplier_holds (company_id, supplier_id, source_type, source_id, reason, active, created_by, created_at)
SELECT 
    sp.company_id,
    sp.id AS supplier_id,
    'LEGACY_MANUAL_HOLD' AS source_type,
    'backfill_' || sp.id AS source_id,
    'Legacy ON_HOLD status backfilled during SP-03 migration' AS reason,
    true AS active,
    'SYSTEM' AS created_by,
    now() AS created_at
FROM sm_supplier_profiles sp
WHERE sp.status = 'ON_HOLD';
