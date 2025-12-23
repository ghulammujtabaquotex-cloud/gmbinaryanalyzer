-- Add column to store generated credentials for approved payments
ALTER TABLE public.payment_requests 
ADD COLUMN IF NOT EXISTS generated_password text;