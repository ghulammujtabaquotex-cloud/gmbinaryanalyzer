-- Enable required extensions for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Add telegram_sent column to track which signals have been sent
ALTER TABLE public.future_signals_pool 
ADD COLUMN IF NOT EXISTS telegram_sent BOOLEAN DEFAULT false;

-- Grant usage to postgres for cron
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;