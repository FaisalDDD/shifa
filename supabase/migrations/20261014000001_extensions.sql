-- MedFind — extensions
-- PostGIS for geographic queries, pg_trgm for typo-tolerant search,
-- pgcrypto for uuid generation helpers.

create extension if not exists postgis;
create extension if not exists pg_trgm;
create extension if not exists pgcrypto;
