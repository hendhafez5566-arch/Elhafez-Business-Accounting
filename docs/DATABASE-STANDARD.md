# Database Standard

PostgreSQL is the system database and Prisma is the schema/client tool. The root `prisma/schema.prisma` is intentionally model-free in Phase 0.

Each future model must have one owner declared in `modules/<module>/module.json`. Only that owner may create migrations or use Prisma to mutate its table. Use module-prefixed table names, explicit foreign-key names, UTC timestamps, and database constraints for local invariants.

Cross-module links use stable IDs and public contracts/events. A foreign key may establish referential integrity only when explicitly approved; it never authorizes cross-module queries, joins, or writes. Avoid database triggers that encode business collaboration between modules.
