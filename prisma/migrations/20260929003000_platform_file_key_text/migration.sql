-- Normalize the original UUID file key to the TEXT representation already used
-- by the canonical Prisma model and entity-file-link contract. This prerequisite
-- sorts before the existing file-link creation migration on fresh databases.
-- Existing databases with compatible links retain every ID and association.
BEGIN;
DO $migration$
BEGIN
  IF to_regclass('pc_entity_file_links') IS NOT NULL THEN
    ALTER TABLE "pc_entity_file_links" DROP CONSTRAINT IF EXISTS "pc_entity_file_links_file_id_fkey";
    ALTER TABLE "pc_entity_file_links" ALTER COLUMN "file_id" TYPE TEXT USING "file_id"::TEXT;
  END IF;
END
$migration$;
ALTER TABLE "pc_files" ALTER COLUMN "id" TYPE TEXT USING "id"::TEXT;
DO $migration$
BEGIN
  IF to_regclass('pc_entity_file_links') IS NOT NULL THEN
    ALTER TABLE "pc_entity_file_links" ADD CONSTRAINT "pc_entity_file_links_file_id_fkey"
      FOREIGN KEY ("file_id") REFERENCES "pc_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$migration$;
COMMIT;
