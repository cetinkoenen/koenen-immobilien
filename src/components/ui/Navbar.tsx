import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

export default function Navbar() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    let mounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setEmail(data.user?.email ?? "");
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setEmail(session?.user?.email ?? "");
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div
      style={{
        padding: "12px 16px",
        borderBottom: "1px solid #e5e5e5",
        marginBottom: 16,
        display: "flex",
        gap: 12,
        alignItems: "center",
      }}
    >
      <strong style={{ marginRight: 8 }}>Koenen</strong>

      <Link to="/monate">Monate</Link>
      <Link to="/auswertung">Auswertung</Link>
      <Link to="/admin">Kategorien</Link>

      <div style={{ marginLeft: "auto", display: "flex", gap: 12, alignItems: "center" }}>
        {email ? (
          <span style={{ fontSize: 12, opacity: 0.8 }}>{email}</span>
        ) : (
          <span style={{ fontSize: 12, opacity: 0.6 }}>—</span>
        )}
        <button onClick={logout}>Logout</button>
      </div>
    </div>
  );
}
