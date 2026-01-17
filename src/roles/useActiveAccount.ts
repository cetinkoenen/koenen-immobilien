import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../auth/AuthProvider";

type State = {
  loading: boolean;
  accountId: string | null;
  error?: string;
};

/**
 * MVP: nimmt den ersten Account, in dem der eingeloggte User Member ist.
 * Erwartet Tabelle: account_members(user_id, account_id, created_at)
 */
export function useActiveAccount(): State {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<State>({ loading: true, accountId: null });

  useEffect(() => {
    let alive = true;

    (async () => {
      if (authLoading) return;

      if (!user) {
        if (alive) setState({ loading: false, accountId: null });
        return;
      }

      try {
        const { data, error } = await supabase
          .from("account_members")
          .select("account_id")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true })
          .limit(1);

        if (error) throw error;

        const accountId = (data?.[0] as any)?.account_id ?? null;
        if (alive) setState({ loading: false, accountId });
      } catch (e: any) {
        const msg = e?.message ?? e?.details ?? String(e);
        if (alive) setState({ loading: false, accountId: null, error: msg });
      }
    })();

    return () => {
      alive = false;
    };
  }, [user, authLoading]);

  return state;
}
