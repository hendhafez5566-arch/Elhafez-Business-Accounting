DO $test$
BEGIN
  IF (SELECT count(*) FROM pc_entity_file_links l JOIN pc_files f ON f.id=l.file_id WHERE l.id='retained-link' AND f.storage_key='retained-object') <> 1 THEN
    RAISE EXCEPTION 'existing association was not preserved';
  END IF;
END
$test$;
DELETE FROM pc_files WHERE id='11111111-1111-4111-8111-111111111111';
DO $test$
BEGIN
  IF EXISTS (SELECT 1 FROM pc_entity_file_links) THEN RAISE EXCEPTION 'cascade relationship was not preserved'; END IF;
END
$test$;
