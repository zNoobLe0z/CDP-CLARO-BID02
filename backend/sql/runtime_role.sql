-- Execute once with the migration/administration account, not from the browser.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cdp_api') THEN
    CREATE ROLE cdp_api NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA cdp TO cdp_api;
GRANT SELECT ON ALL TABLES IN SCHEMA cdp TO cdp_api;
GRANT UPDATE (executed_quantity, version) ON cdp.scope_items TO cdp_api;
GRANT INSERT ON cdp.production_records, cdp.idempotency, cdp.workforce, cdp.workforce_revisions TO cdp_api;
GRANT UPDATE (status, version) ON cdp.production_records TO cdp_api;
GRANT UPDATE (response) ON cdp.idempotency TO cdp_api;
GRANT UPDATE (headcount, observation, author_name, author_id, updated_at, version) ON cdp.workforce TO cdp_api;

-- A DBA must create a separate login with a strong password and grant cdp_api to it.
-- Do not connect the running API as postgres, as the schema owner or as a superuser.
-- Do not expose the cdp schema in the Supabase Data API.

-- Administrative writes are authorized by project membership in the API.
GRANT UPDATE (name) ON cdp.projects TO cdp_api;
GRANT INSERT ON cdp.floors, cdp.environments, cdp.disciplines, cdp.activities, cdp.elements, cdp.scope_items, cdp.companies, cdp.catalog_audit TO cdp_api;
GRANT UPDATE (name, version) ON cdp.floors, cdp.disciplines, cdp.companies TO cdp_api;
GRANT UPDATE (name, floor_id, version) ON cdp.environments TO cdp_api;
GRANT UPDATE (name, discipline_id, version) ON cdp.activities TO cdp_api;
GRANT UPDATE (name, code, environment_id, version) ON cdp.elements TO cdp_api;
GRANT UPDATE (element_id, activity_id, measurement_type, unit, planned_quantity, production_weight) ON cdp.scope_items TO cdp_api;
