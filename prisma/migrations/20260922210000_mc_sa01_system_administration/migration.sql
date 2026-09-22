-- Company-scoped authorization is the sole runtime role assignment truth.
ALTER TABLE "pc_user_roles" ADD COLUMN "company_id" TEXT;
UPDATE "pc_user_roles" ur SET "company_id" = (SELECT b."company_id" FROM "pc_user_branch_access" a JOIN "pc_branches" b ON b.id=a."branch_id" WHERE a."user_id"=ur."user_id" ORDER BY b."created_at" LIMIT 1);
DELETE FROM "pc_user_roles" WHERE "company_id" IS NULL;
ALTER TABLE "pc_user_roles" ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "pc_user_roles" DROP CONSTRAINT "pc_user_roles_pkey";
ALTER TABLE "pc_user_roles" ADD CONSTRAINT "pc_user_roles_pkey" PRIMARY KEY ("user_id","company_id","role_id");
ALTER TABLE "pc_user_roles" ADD CONSTRAINT "pc_user_roles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "pc_companies"("id") ON DELETE CASCADE;
CREATE INDEX "pc_user_roles_company_user_idx" ON "pc_user_roles"("company_id","user_id");
CREATE TABLE "pc_password_recovery" ("id" TEXT PRIMARY KEY,"user_id" TEXT NOT NULL,"token_hash" TEXT NOT NULL UNIQUE,"expires_at" TIMESTAMP(3) NOT NULL,"used_at" TIMESTAMP(3),"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "pc_password_recovery_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "pc_users"("id") ON DELETE CASCADE);
CREATE INDEX "pc_password_recovery_user_expiry_idx" ON "pc_password_recovery"("user_id","expires_at");
CREATE TABLE "dex_jobs" ("id" TEXT PRIMARY KEY,"company_id" TEXT NOT NULL,"branch_id" TEXT,"direction" TEXT NOT NULL,"status" TEXT NOT NULL,"file_name" TEXT NOT NULL,"mapping" JSONB NOT NULL,"idempotency_key" TEXT NOT NULL,"result_key" TEXT,"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "dex_jobs_company_key" UNIQUE("company_id","idempotency_key"));
CREATE INDEX "dex_jobs_company_created_idx" ON "dex_jobs"("company_id","created_at");
CREATE TABLE "dex_rows" ("id" TEXT PRIMARY KEY,"job_id" TEXT NOT NULL,"row_number" INTEGER NOT NULL,"source" JSONB NOT NULL,"outcome" TEXT NOT NULL,"error" TEXT,CONSTRAINT "dex_rows_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "dex_jobs"("id") ON DELETE CASCADE,CONSTRAINT "dex_rows_job_row_key" UNIQUE("job_id","row_number"));
CREATE TABLE "pops_backup_jobs" ("id" TEXT PRIMARY KEY,"actor_id" TEXT NOT NULL,"company_id" TEXT,"status" TEXT NOT NULL,"manifest" JSONB NOT NULL,"checksum" TEXT,"provider_ref" TEXT,"pinned" BOOLEAN NOT NULL DEFAULT false,"error" TEXT,"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "pops_backup_company_created_idx" ON "pops_backup_jobs"("company_id","created_at");
CREATE TABLE "pops_restore_jobs" ("id" TEXT PRIMARY KEY,"backup_id" TEXT NOT NULL,"actor_id" TEXT NOT NULL,"status" TEXT NOT NULL,"error" TEXT,"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "pops_restore_backup_id_fkey" FOREIGN KEY ("backup_id") REFERENCES "pops_backup_jobs"("id") ON DELETE RESTRICT);
