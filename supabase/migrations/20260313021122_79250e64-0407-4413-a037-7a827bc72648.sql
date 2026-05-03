
-- Add enrollment fields to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS enrollment_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Create enrollment_codes table
CREATE TABLE public.enrollment_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  class_level class_level NOT NULL,
  created_by uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  max_uses integer DEFAULT NULL,
  times_used integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz DEFAULT NULL
);

ALTER TABLE public.enrollment_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage enrollment codes" ON public.enrollment_codes
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone authenticated can read active codes" ON public.enrollment_codes
  FOR SELECT TO authenticated
  USING (is_active = true);

-- Create login_activity table
CREATE TABLE public.login_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  logged_in_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text
);

ALTER TABLE public.login_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all login activity" ON public.login_activity
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own login activity" ON public.login_activity
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own login activity" ON public.login_activity
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Create active_sessions table for single-device enforcement
CREATE TABLE public.active_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  session_token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own session" ON public.active_sessions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all sessions" ON public.active_sessions
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Function to enroll student with code
CREATE OR REPLACE FUNCTION public.enroll_with_code(enrollment_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code enrollment_codes%ROWTYPE;
  v_user_id uuid := auth.uid();
BEGIN
  -- Find the code
  SELECT * INTO v_code FROM enrollment_codes 
  WHERE code = enrollment_code AND is_active = true;
  
  IF v_code IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or expired enrollment code');
  END IF;
  
  -- Check expiry
  IF v_code.expires_at IS NOT NULL AND v_code.expires_at < now() THEN
    RETURN json_build_object('success', false, 'error', 'This enrollment code has expired');
  END IF;
  
  -- Check max uses
  IF v_code.max_uses IS NOT NULL AND v_code.times_used >= v_code.max_uses THEN
    RETURN json_build_object('success', false, 'error', 'This enrollment code has reached its maximum uses');
  END IF;
  
  -- Update student profile
  UPDATE profiles 
  SET class_level = v_code.class_level, 
      enrollment_status = 'enrolled',
      updated_at = now()
  WHERE user_id = v_user_id;
  
  -- Increment usage
  UPDATE enrollment_codes SET times_used = times_used + 1 WHERE id = v_code.id;
  
  RETURN json_build_object('success', true, 'class_level', v_code.class_level);
END;
$$;

-- Update handle_new_user to set enrollment_status to pending
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, class_level, enrollment_status, is_active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', ''),
    'basic_1',
    'pending',
    true
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student');
  RETURN NEW;
END;
$$;
