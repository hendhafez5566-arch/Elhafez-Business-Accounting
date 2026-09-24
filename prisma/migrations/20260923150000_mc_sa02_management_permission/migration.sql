-- Provision the canonical Management read permission and upgrade only the
-- established company-administrator role in companies where it is assigned.
WITH "management_permission" AS (
  INSERT INTO "pc_permissions" ("id", "name")
  VALUES ('a91b5044-8b6f-4e97-9f4f-c3fde26b6037', 'management.control.read')
  ON CONFLICT ("name") DO UPDATE SET "name" = EXCLUDED."name"
  RETURNING "id"
)
INSERT INTO "pc_company_role_permissions" ("company_id", "role_id", "permission_id")
SELECT DISTINCT ur."company_id", role."id", permission."id"
FROM "pc_user_roles" ur
JOIN "pc_roles" role ON role."id" = ur."role_id"
CROSS JOIN "management_permission" permission
WHERE role."name" = 'company-administrator'
ON CONFLICT ("company_id", "role_id", "permission_id") DO NOTHING;
