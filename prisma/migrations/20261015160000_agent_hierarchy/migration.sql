ALTER TABLE "am_agents" ADD COLUMN "parent_agent_id" TEXT;
CREATE INDEX "am_agents_company_id_parent_agent_id_idx" ON "am_agents"("company_id", "parent_agent_id");
ALTER TABLE "am_agents" ADD CONSTRAINT "am_agents_company_id_parent_agent_id_fkey"
 FOREIGN KEY ("company_id", "parent_agent_id") REFERENCES "am_agents"("company_id", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "am_agents" ADD CONSTRAINT "am_agents_parent_not_self" CHECK ("parent_agent_id" IS NULL OR "parent_agent_id" <> "id");
