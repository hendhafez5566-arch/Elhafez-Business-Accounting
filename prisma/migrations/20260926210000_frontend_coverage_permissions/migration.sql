-- Frontend Coverage Closure: surface canonical Tourism Contract Inventory without duplicating ownership.
-- Existing company administrators receive the new workspace permissions; other roles use normal role assignment.

WITH "inventory_permissions" AS (
  INSERT INTO "pc_permissions" ("id", "name") VALUES
    ('f6c3304d-9c3c-4c79-b8b2-000000000001', 'tourism.inventory.view'),
    ('f6c3304d-9c3c-4c79-b8b2-000000000002', 'tourism.inventory.manage')
  ON CONFLICT ("name") DO UPDATE SET "name" = EXCLUDED."name"
  RETURNING "id"
)
INSERT INTO "pc_company_role_permissions" ("company_id", "role_id", "permission_id")
SELECT DISTINCT ur."company_id", role."id", permission."id"
FROM "pc_user_roles" ur
JOIN "pc_roles" role ON role."id" = ur."role_id"
CROSS JOIN "inventory_permissions" permission
WHERE role."name" = 'company-administrator'
ON CONFLICT ("company_id", "role_id", "permission_id") DO NOTHING;
