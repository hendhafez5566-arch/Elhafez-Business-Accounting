-- Disposable database fixture: both legacy bootstrap and populated link upgrade.
CREATE SCHEMA legacy_file_keys;
SET search_path TO legacy_file_keys;
CREATE TABLE pc_files (id UUID PRIMARY KEY, storage_key TEXT NOT NULL UNIQUE);
INSERT INTO pc_files VALUES ('11111111-1111-4111-8111-111111111111','retained-object');
