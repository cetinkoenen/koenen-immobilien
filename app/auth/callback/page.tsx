import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { createClient } from '@supabase/supabase-js'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    const run = async () => {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      const code = new URL(window.location.href).searchParams.get('code')

      if (code) {
        await supabase.auth.exchangeCodeForSession(code)
      }

      router.replace('/')
    }

    run()
  }, [router])

  return <p>Signing you in...</p>
}

