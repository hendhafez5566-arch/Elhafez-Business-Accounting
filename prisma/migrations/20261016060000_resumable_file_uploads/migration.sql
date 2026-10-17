CREATE TABLE "pc_file_uploads" (
 "id" TEXT PRIMARY KEY,"company_id" TEXT NOT NULL,"branch_id" TEXT NOT NULL,"actor_id" TEXT NOT NULL,"request_id" TEXT NOT NULL,"payload_hash" TEXT NOT NULL,
 "entity_type" TEXT NOT NULL,"entity_id" TEXT NOT NULL,"label" TEXT,"content_type" TEXT NOT NULL,"size" INTEGER NOT NULL CHECK (size > 0 AND size <= 52428800),"checksum" TEXT NOT NULL,
 "chunk_count" INTEGER NOT NULL CHECK (chunk_count > 0 AND chunk_count <= 800),"state" TEXT NOT NULL CHECK (state IN ('UPLOADING','FINALIZING','COMPLETED')),"file_id" TEXT,"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE ("company_id","id"),UNIQUE ("company_id","branch_id","actor_id","request_id")
);
CREATE INDEX "pc_file_uploads_company_id_branch_id_actor_id_state_idx" ON "pc_file_uploads" ("company_id","branch_id","actor_id","state");
CREATE TABLE "pc_file_upload_chunks" (
 "company_id" TEXT NOT NULL,"upload_id" TEXT NOT NULL,"chunk_index" INTEGER NOT NULL CHECK (chunk_index >= 0),"checksum" TEXT NOT NULL,"content" BYTEA NOT NULL CHECK (octet_length(content) > 0 AND octet_length(content) <= 65536),
 PRIMARY KEY ("company_id","upload_id","chunk_index"),FOREIGN KEY ("company_id","upload_id") REFERENCES "pc_file_uploads" ("company_id","id") ON DELETE RESTRICT ON UPDATE CASCADE
);
