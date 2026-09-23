-- Runtime authorization moves from global role-permission grants to company-scoped grants.
-- Preserve every effective legacy grant in each company where that role is assigned.
CREATE TABLE "pc_company_role_permissions" AS
SELECT DISTINCT ur."company_id", rp."role_id", rp."permission_id"
FROM "pc_user_roles" ur
JOIN "pc_role_permissions" rp ON rp."role_id" = ur."role_id";

ALTER TABLE "pc_company_role_permissions" ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "pc_company_role_permissions" ALTER COLUMN "role_id" SET NOT NULL;
ALTER TABLE "pc_company_role_permissions" ALTER COLUMN "permission_id" SET NOT NULL;
ALTER TABLE "pc_company_role_permissions"
  ADD CONSTRAINT "pc_company_role_permissions_pkey" PRIMARY KEY ("company_id","role_id","permission_id");
ALTER TABLE "pc_company_role_permissions"
  ADD CONSTRAINT "pc_company_role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "pc_roles"("id") ON DELETE CASCADE;
ALTER TABLE "pc_company_role_permissions"
  ADD CONSTRAINT "pc_company_role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "pc_permissions"("id") ON DELETE CASCADE;
CREATE INDEX "pc_company_role_permissions_company_role_idx" ON "pc_company_role_permissions"("company_id","role_id");
