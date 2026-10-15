CREATE TABLE "am_commission_agreements" (
 "id" TEXT PRIMARY KEY, "company_id" TEXT NOT NULL, "agent_id" TEXT NOT NULL,
 "parent_agent_id" TEXT NOT NULL, "request_id" TEXT NOT NULL, "version" INTEGER NOT NULL,
 "principal_percent" NUMERIC(9,6) NOT NULL, "subordinate_percent" NUMERIC(9,6) NOT NULL,
 "reason" TEXT NOT NULL, "actor_id" TEXT NOT NULL, "created_at" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "am_agreement_shares" CHECK ("principal_percent" >= 0 AND "principal_percent" <= 100 AND "subordinate_percent" >= 0 AND "subordinate_percent" <= 100 AND "principal_percent" + "subordinate_percent" = 100),
 CONSTRAINT "am_agreement_version" CHECK ("version" > 0),
 CONSTRAINT "am_agreement_distinct_agents" CHECK ("agent_id" <> "parent_agent_id"),
 CONSTRAINT "am_agreement_child_fk" FOREIGN KEY ("company_id","agent_id") REFERENCES "am_agents"("company_id","id") ON DELETE RESTRICT ON UPDATE NO ACTION,
 CONSTRAINT "am_agreement_parent_fk" FOREIGN KEY ("company_id","parent_agent_id") REFERENCES "am_agents"("company_id","id") ON DELETE RESTRICT ON UPDATE NO ACTION
);
CREATE UNIQUE INDEX "am_commission_agreements_company_id_request_id_key" ON "am_commission_agreements"("company_id","request_id");
CREATE UNIQUE INDEX "am_commission_agreements_company_id_agent_id_version_key" ON "am_commission_agreements"("company_id","agent_id","version");
CREATE INDEX "am_commission_agreements_company_id_parent_agent_id_idx" ON "am_commission_agreements"("company_id","parent_agent_id");
