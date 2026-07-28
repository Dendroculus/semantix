\set ON_ERROR_STOP on
\getenv migration_user SEMANTIX_MIGRATION_USER
\getenv migration_password SEMANTIX_MIGRATION_PASSWORD
\getenv runtime_user SEMANTIX_RUNTIME_USER
\getenv runtime_password SEMANTIX_RUNTIME_PASSWORD

SELECT 1 / COUNT(*)
FROM pg_roles
WHERE rolname = :'migration_user';

SELECT 1 / COUNT(*)
FROM pg_roles
WHERE rolname = :'runtime_user';

SELECT 1 / ((length(:'migration_password') > 0)::integer);
SELECT 1 / ((length(:'runtime_password') > 0)::integer);

BEGIN;
SELECT format('ALTER ROLE %I LOGIN PASSWORD %L', :'runtime_user', :'runtime_password')
\gexec
SELECT format(
    'ALTER ROLE %I LOGIN PASSWORD %L',
    :'migration_user',
    :'migration_password'
)
\gexec
COMMIT;
