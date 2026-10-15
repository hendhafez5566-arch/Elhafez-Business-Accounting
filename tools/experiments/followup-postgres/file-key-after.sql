DO $test$
BEGIN
  IF (SELECT data_type FROM information_schema.columns WHERE table_schema='legacy_file_keys' AND table_name='pc_files' AND column_name='id') <> 'text' THEN
    RAISE EXCEPTION 'file key did not normalize to TEXT';
  END IF;
  IF (SELECT count(*) FROM pc_files WHERE id='11111111-1111-4111-8111-111111111111' AND storage_key='retained-object') <> 1 THEN
    RAISE EXCEPTION 'existing file identity or metadata changed';
  END IF;
END
$test$;
CREATE TABLE pc_entity_file_links (id TEXT PRIMARY KEY, file_id TEXT NOT NULL, CONSTRAINT pc_entity_file_links_file_id_fkey FOREIGN KEY(file_id) REFERENCES pc_files(id) ON DELETE CASCADE ON UPDATE CASCADE);
INSERT INTO pc_entity_file_links VALUES ('retained-link','11111111-1111-4111-8111-111111111111');
-- A second execution tests the populated already-compatible upgrade path.
