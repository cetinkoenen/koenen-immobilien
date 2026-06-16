UPDATE public.app_user_access
SET
  requires_login_approval = false,
  approved_at = COALESCE(approved_at, now()),
  is_active = true,
  updated_at = now()
WHERE email IN ('nihal.koenen@gmail.com', 'cetin.koenen@gmail.com');
