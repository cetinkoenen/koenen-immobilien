CREATE TABLE IF NOT EXISTS public.app_user_access (
  email text PRIMARY KEY,
  role text NOT NULL CHECK (role IN ('admin', 'viewer')),
  requires_login_approval boolean NOT NULL DEFAULT false,
  approved_at timestamptz,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.login_approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL REFERENCES public.app_user_access(email) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note text
);

CREATE INDEX IF NOT EXISTS login_approval_requests_email_status_idx
  ON public.login_approval_requests(email, status, requested_at DESC);

ALTER TABLE public.app_user_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_approval_requests ENABLE ROW LEVEL SECURITY;

INSERT INTO public.app_user_access (email, role, requires_login_approval, approved_at, is_active)
VALUES
  ('info.koenen@gmail.com', 'admin', false, now(), true),
  ('nihal.koenen@gmail.com', 'viewer', true, NULL, true),
  ('cetin.koenen@gmail.com', 'viewer', true, NULL, true)
ON CONFLICT (email) DO UPDATE SET
  role = EXCLUDED.role,
  requires_login_approval = EXCLUDED.requires_login_approval,
  is_active = EXCLUDED.is_active,
  updated_at = now();

DROP POLICY IF EXISTS app_user_access_select_own_or_admin ON public.app_user_access;
CREATE POLICY app_user_access_select_own_or_admin
ON public.app_user_access
FOR SELECT
TO authenticated
USING (
  lower(email) = lower(auth.jwt() ->> 'email')
  OR lower(auth.jwt() ->> 'email') = 'info.koenen@gmail.com'
);

DROP POLICY IF EXISTS login_approval_requests_select_own_or_admin ON public.login_approval_requests;
CREATE POLICY login_approval_requests_select_own_or_admin
ON public.login_approval_requests
FOR SELECT
TO authenticated
USING (
  lower(email) = lower(auth.jwt() ->> 'email')
  OR lower(auth.jwt() ->> 'email') = 'info.koenen@gmail.com'
);

DROP POLICY IF EXISTS login_approval_requests_insert_own ON public.login_approval_requests;
CREATE POLICY login_approval_requests_insert_own
ON public.login_approval_requests
FOR INSERT
TO authenticated
WITH CHECK (
  lower(email) = lower(auth.jwt() ->> 'email')
  AND status = 'pending'
);

DROP POLICY IF EXISTS app_user_access_update_admin ON public.app_user_access;
CREATE POLICY app_user_access_update_admin
ON public.app_user_access
FOR UPDATE
TO authenticated
USING (lower(auth.jwt() ->> 'email') = 'info.koenen@gmail.com')
WITH CHECK (lower(auth.jwt() ->> 'email') = 'info.koenen@gmail.com');

DROP POLICY IF EXISTS login_approval_requests_update_admin ON public.login_approval_requests;
CREATE POLICY login_approval_requests_update_admin
ON public.login_approval_requests
FOR UPDATE
TO authenticated
USING (lower(auth.jwt() ->> 'email') = 'info.koenen@gmail.com')
WITH CHECK (lower(auth.jwt() ->> 'email') = 'info.koenen@gmail.com');

CREATE OR REPLACE FUNCTION public.touch_app_user_access_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_app_user_access_updated_at ON public.app_user_access;
CREATE TRIGGER touch_app_user_access_updated_at
BEFORE UPDATE ON public.app_user_access
FOR EACH ROW
EXECUTE FUNCTION public.touch_app_user_access_updated_at();
