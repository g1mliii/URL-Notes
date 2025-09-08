-- Review all custom roles and their permissions
-- Run this in your Supabase SQL Editor or via CLI

-- 1. List all custom roles (excluding system roles)
SELECT 
    rolname as role_name,
    rolsuper as is_superuser,
    rolinherit as can_inherit,
    rolcreaterole as can_create_roles,
    rolcreatedb as can_create_db,
    rolcanlogin as can_login,
    rolreplication as can_replicate,
    rolconnlimit as connection_limit,
    rolvaliduntil as password_expiry
FROM pg_roles 
WHERE rolname NOT LIKE 'pg_%' 
    AND rolname NOT IN ('postgres', 'authenticator', 'anon', 'authenticated', 'service_role', 'supabase_admin', 'supabase_auth_admin', 'dashboard_user')
ORDER BY rolname;

-- 2. Check role memberships (which roles belong to which groups)
SELECT 
    r.rolname as role_name,
    m.rolname as member_of
FROM pg_roles r
JOIN pg_auth_members am ON r.oid = am.member
JOIN pg_roles m ON am.roleid = m.oid
WHERE r.rolname NOT LIKE 'pg_%'
    AND r.rolname NOT IN ('postgres', 'authenticator', 'anon', 'authenticated', 'service_role', 'supabase_admin', 'supabase_auth_admin', 'dashboard_user')
ORDER BY r.rolname;

-- 3. Check database-level permissions
SELECT 
    r.rolname as role_name,
    d.datname as database_name,
    has_database_privilege(r.rolname, d.datname, 'CONNECT') as can_connect,
    has_database_privilege(r.rolname, d.datname, 'CREATE') as can_create,
    has_database_privilege(r.rolname, d.datname, 'TEMPORARY') as can_temp
FROM pg_roles r
CROSS JOIN pg_database d
WHERE r.rolname NOT LIKE 'pg_%'
    AND r.rolname NOT IN ('postgres', 'authenticator', 'anon', 'authenticated', 'service_role', 'supabase_admin', 'supabase_auth_admin', 'dashboard_user')
    AND d.datname = current_database()
ORDER BY r.rolname;

-- 4. Check schema-level permissions
SELECT DISTINCT
    r.rolname as role_name,
    n.nspname as schema_name,
    has_schema_privilege(r.rolname, n.nspname, 'USAGE') as can_use,
    has_schema_privilege(r.rolname, n.nspname, 'CREATE') as can_create
FROM pg_roles r
CROSS JOIN pg_namespace n
WHERE r.rolname NOT LIKE 'pg_%'
    AND r.rolname NOT IN ('postgres', 'authenticator', 'anon', 'authenticated', 'service_role', 'supabase_admin', 'supabase_auth_admin', 'dashboard_user')
    AND n.nspname NOT LIKE 'pg_%'
    AND n.nspname NOT IN ('information_schema')
ORDER BY r.rolname, n.nspname;