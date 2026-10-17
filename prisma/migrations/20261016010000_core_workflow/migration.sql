-- Booking owns the contracting/beneficiary/debtor relationship; Billing owns debt.
ALTER TABLE hub_bookings ADD COLUMN financial_customer_id TEXT,
 ADD COLUMN financial_party_id TEXT, ADD COLUMN family_reference TEXT;
CREATE INDEX hub_bookings_family_idx ON hub_bookings(company_id, branch_id, family_reference);
ALTER TABLE tfo_booking_references ADD COLUMN commission_claim_ids JSONB;
ALTER TABLE hub_bookings ADD COLUMN commission_agreement JSONB;
ALTER TABLE hub_bookings ADD COLUMN create_request_id TEXT, ADD COLUMN create_request_hash TEXT;
CREATE UNIQUE INDEX hub_bookings_create_request_idx ON hub_bookings(company_id, branch_id, create_request_id);
CREATE TABLE oc_device_grants (
 id TEXT PRIMARY KEY, company_id TEXT NOT NULL, branch_id TEXT NOT NULL,
 actor_id TEXT NOT NULL, device_id TEXT NOT NULL, operations JSONB NOT NULL,
 issued_at TIMESTAMP(3) NOT NULL, expires_at TIMESTAMP(3) NOT NULL, revoked_at TIMESTAMP(3),
 CONSTRAINT oc_grant_window CHECK (expires_at > issued_at AND expires_at <= issued_at + INTERVAL '8 hours')
);
CREATE INDEX oc_device_grants_company_id_branch_id_actor_id_device_id_idx ON oc_device_grants(company_id,branch_id,actor_id,device_id);
CREATE TABLE oc_commands (
 id TEXT NOT NULL, company_id TEXT NOT NULL, branch_id TEXT NOT NULL, actor_id TEXT NOT NULL,
 device_id TEXT NOT NULL, grant_id TEXT NOT NULL, operation TEXT NOT NULL,
 payload JSONB NOT NULL, payload_hash TEXT NOT NULL, dependencies JSONB NOT NULL,
 captured_at TEXT NOT NULL, received_at TIMESTAMP(3) NOT NULL, state TEXT NOT NULL,
 attempt INTEGER NOT NULL DEFAULT 0, lease_until TIMESTAMP(3), result JSONB NOT NULL, reason TEXT,
 PRIMARY KEY(company_id,branch_id,id),
 CONSTRAINT oc_command_state CHECK (state IN ('PENDING','PROCESSING','ACCEPTED','REVIEW')),
 CONSTRAINT oc_command_operation CHECK (operation IN ('BOOKING_CREATE','BOOKING_CONFIRM','BOOKING_DEPOSIT')),
 CONSTRAINT oc_command_attempt CHECK (attempt>=0)
);
CREATE INDEX oc_commands_company_id_branch_id_actor_id_received_at_idx ON oc_commands(company_id,branch_id,actor_id,received_at);
ALTER TABLE hub_bookings ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;
CREATE TABLE oc_write_authorities (
 company_id TEXT PRIMARY KEY, authority_id TEXT NOT NULL,
 enrolled_by TEXT NOT NULL, enrolled_at TIMESTAMP(3) NOT NULL
);
