-- Company-scoped username authentication.
-- Additive identity layer; existing user ids, roles, branch access and audit references stay unchanged.

ALTER TABLE "pc_users" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "pc_sessions" ADD COLUMN "company_id" UUID;
ALTER TABLE "pc_sessions" ADD CONSTRAINT "pc_sessions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "pc_companies"("id") ON DELETE CASCADE;
CREATE INDEX "pc_sessions_company_id_idx" ON "pc_sessions"("company_id");

CREATE TABLE "pc_company_login_identities" (
  "company_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "username" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "must_change_password" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pc_company_login_identities_pkey" PRIMARY KEY ("company_id","user_id"),
  CONSTRAINT "pc_company_login_identities_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "pc_companies"("id") ON DELETE CASCADE,
  CONSTRAINT "pc_company_login_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "pc_users"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "pc_company_login_identities_company_username_key" ON "pc_company_login_identities"("company_id","username");
CREATE INDEX "pc_company_login_identities_user_id_idx" ON "pc_company_login_identities"("user_id");

WITH memberships AS (
  SELECT DISTINCT ur."company_id",ur."user_id"
  FROM "pc_user_roles" ur
  UNION
  SELECT DISTINCT branch."company_id",access."user_id"
  FROM "pc_user_branch_access" access
  JOIN "pc_branches" branch ON branch."id"=access."branch_id"
),
normalized AS (
  SELECT
    membership."company_id",
    membership."user_id",
    user_row."password_hash",
    LOWER(REGEXP_REPLACE(COALESCE(NULLIF(SPLIT_PART(user_row."email",'@',1),''),'user'),'[^a-zA-Z0-9._-]+','-','g')) AS raw_username
  FROM memberships membership
  JOIN "pc_users" user_row ON user_row."id"=membership."user_id"
),
bases AS (
  SELECT
    "company_id",
    "user_id",
    "password_hash",
    CASE
      WHEN LENGTH(TRIM(BOTH '-' FROM raw_username)) >= 3 THEN LEFT(TRIM(BOTH '-' FROM raw_username),30)
      ELSE 'user-'||LEFT(REPLACE("user_id"::text,'-',''),8)
    END AS base_username
  FROM normalized
),
candidates AS (
  SELECT
    *,
    ROW_NUMBER() OVER (PARTITION BY "company_id",base_username ORDER BY "user_id") AS collision_number
  FROM bases
)
INSERT INTO "pc_company_login_identities" (
  "company_id","user_id","username","password_hash","must_change_password","created_at","updated_at"
)
SELECT
  "company_id",
  "user_id",
  CASE WHEN collision_number=1
    THEN base_username
    ELSE LEFT(base_username,30)||'-'||LEFT(REPLACE("user_id"::text,'-',''),8)
  END,
  "password_hash",
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM candidates
ON CONFLICT ("company_id","user_id") DO NOTHING;
