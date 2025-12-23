-- Fix 1: Add proper anonymous upload policy for payment-proofs bucket
CREATE POLICY "Allow anonymous uploads to anonymous folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'payment-proofs' 
  AND (storage.foldername(name))[1] = 'anonymous'
);

-- Fix 2: Remove the overly permissive public SELECT policy on trade_results
DROP POLICY IF EXISTS "Anyone can read results for aggregation" ON public.trade_results;

-- Keep only user-specific policy (already exists: "Users can view their own trade results")