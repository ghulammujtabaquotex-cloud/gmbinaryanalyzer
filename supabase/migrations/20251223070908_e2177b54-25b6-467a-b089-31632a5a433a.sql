-- Add email column to payment_requests for anonymous submissions
ALTER TABLE public.payment_requests 
  ALTER COLUMN user_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS email TEXT;

-- Update the insert policy to allow anonymous submissions
DROP POLICY IF EXISTS "Users can insert their own payment requests" ON public.payment_requests;

CREATE POLICY "Anyone can submit payment requests"
ON public.payment_requests
FOR INSERT
WITH CHECK (true);

-- Add unique constraint on user_id for subscriptions (if not exists)
-- This allows upsert to work properly
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_user_id_key'
  ) THEN
    ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_user_id_key UNIQUE (user_id);
  END IF;
END $$;