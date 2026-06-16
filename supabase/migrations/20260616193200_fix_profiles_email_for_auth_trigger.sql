ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS email text;

UPDATE public.profiles
SET email = auth.users.email
FROM auth.users
WHERE profiles.id = auth.users.id
  AND public.profiles.email IS DISTINCT FROM auth.users.email;

CREATE INDEX IF NOT EXISTS profiles_email_idx
ON public.profiles (lower(email));
