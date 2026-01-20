-- Add telegram_enabled setting to future_signals_pool or create app_settings table
CREATE TABLE IF NOT EXISTS public.app_settings (
  id TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read settings
CREATE POLICY "Anyone can read settings" 
ON public.app_settings 
FOR SELECT 
USING (true);

-- Only admins can update settings
CREATE POLICY "Admins can update settings" 
ON public.app_settings 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Only admins can insert settings
CREATE POLICY "Admins can insert settings" 
ON public.app_settings 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Insert default telegram setting
INSERT INTO public.app_settings (id, value) 
VALUES ('telegram_auto_send', '{"enabled": true}'::jsonb)
ON CONFLICT (id) DO NOTHING;