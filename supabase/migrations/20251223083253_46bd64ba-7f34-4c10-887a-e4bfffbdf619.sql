-- Grant permissions to anon role for payment_requests
GRANT INSERT ON public.payment_requests TO anon;
GRANT SELECT ON public.payment_requests TO anon;

-- Also grant to authenticated users
GRANT INSERT ON public.payment_requests TO authenticated;
GRANT SELECT ON public.payment_requests TO authenticated;
GRANT UPDATE ON public.payment_requests TO authenticated;