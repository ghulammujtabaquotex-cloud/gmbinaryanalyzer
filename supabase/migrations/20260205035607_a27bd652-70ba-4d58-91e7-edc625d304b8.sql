-- Drop the get_trade_statistics function
DROP FUNCTION IF EXISTS public.get_trade_statistics();

-- Drop the trade_results table
DROP TABLE IF EXISTS public.trade_results;

-- Drop the submission_usage table (used for rate limiting submissions)
DROP TABLE IF EXISTS public.submission_usage;

-- Drop the atomic_increment_submission function
DROP FUNCTION IF EXISTS public.atomic_increment_submission(text, date, integer);