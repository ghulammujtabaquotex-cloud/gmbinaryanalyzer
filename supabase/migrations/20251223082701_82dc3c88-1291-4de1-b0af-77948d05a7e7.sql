-- Add storage policies for anonymous payment proof uploads
CREATE POLICY "Allow anonymous uploads to payment-proofs"
ON storage.objects
FOR INSERT
TO anon
WITH CHECK (bucket_id = 'payment-proofs' AND (storage.foldername(name))[1] = 'anonymous');

-- Allow admins to view payment proofs
CREATE POLICY "Admins can view payment proofs"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'payment-proofs' AND public.has_role(auth.uid(), 'admin'::app_role));