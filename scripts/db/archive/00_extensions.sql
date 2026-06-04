-- Database bootstrap: required extensions
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
create extension if not exists pg_net   with schema extensions;
create extension if not exists pg_cron  with schema pg_catalog;
