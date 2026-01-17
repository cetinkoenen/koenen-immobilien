import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../auth/AuthProvider";

export type Role = "viewer" | "admin" | "owner";

type State = {
  loading: boolean;
  role: Role;
  error?: string;
};

export function useMyRole(accountId: string | null): State {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<State>({ loading: true, role: "viewer" });

  useEffect(() => {
    let alive = true;

    (async () => {
      if (authLoading) return;

      if (!user || !accountId) {
        if (alive) setState({ loading: false, role: "viewer" });
        return;
      }

      try {
        const { data, error } = await supabase
          .from("account_members")
          .select("role")
          .eq("account_id", accountId)
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) throw error;

        const role = (data?.role as Role) ?? "viewer";
        if (alive) setState({ loading: false, role });
      } catch (e: any) {
        const msg = e?.message ?? e?.details ?? String(e);
        if (alive) setState({ loading: false, role: "viewer", error: msg });
      }
    })();

    return () => {
      alive = false;
    };
  }, [user, authLoading, accountId]);

  return state;
}
