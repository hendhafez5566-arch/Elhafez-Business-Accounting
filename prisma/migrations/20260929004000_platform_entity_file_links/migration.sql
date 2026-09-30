CREATE TABLE \"pc_entity_file_links\" (
  \"id\" TEXT NOT NULL,
  \"company_id\" TEXT NOT NULL,
  \"entity_type\" TEXT NOT NULL,
  \"entity_id\" TEXT NOT NULL,
  \"file_id\" UUID NOT NULL,
  \"label\" TEXT,
  \"created_by\" TEXT,
  \"created_at\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT \"pc_entity_file_links_pkey\" PRIMARY KEY (\"id\"),
  CONSTRAINT \"pc_entity_file_links_file_id_fkey\" FOREIGN KEY (\"file_id\") REFERENCES \"pc_files\"(\"id\") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX \"pc_entity_file_links_file_id_key\" ON \"pc_entity_file_links\"(\"file_id\");
CREATE INDEX \"pc_entity_file_links_company_entity_idx\" ON \"pc_entity_file_links\"(\"company_id\", \"entity_type\", \"entity_id\", \"created_at\");

