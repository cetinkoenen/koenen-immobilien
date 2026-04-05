import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import logo from "../../assets/koenen.png";

function PillLink({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        display: "inline-flex",
        alignItems: "center",
        height: 38,
        padding: "0 14px",
        borderRadius: 999,
        textDecoration: "none",
        border: "1px solid #e5e7eb",
        background: isActive ? "#111827" : "#ffffff",
        color: isActive ? "#ffffff" : "#111827",
        fontWeight: 800,
        fontSize: 14,
        whiteSpace: "nowrap",
      })}
    >
      {label}
    </NavLink>
  );
}

export default function Navbar() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    let isMounted = true;

    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      if (!isMounted) return;
      setEmail(data.user?.email ?? "");
    }

    loadUser();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!isMounted) return;
        setEmail(session?.user?.email ?? "");
      }
    );

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  }

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "#ffffff",
        borderBottom: "1px solid #e5e7eb",
      }}
    >
      <div
        style={{
          padding: "12px 18px",
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        {/* Brand */}
        <Link
          to="/portfolio"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            textDecoration: "none",
            color: "#111827",
          }}
        >
          <img
            src={logo}
            alt="KÖNEN"
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              objectFit: "cover",
              border: "1px solid #e5e7eb",
            }}
          />
          <div style={{ display: "grid", lineHeight: 1.1 }}>
            <strong style={{ fontSize: 16 }}>Könen Immobilien</strong>
            <span style={{ fontSize: 12, opacity: 0.7 }}>
              Admin Dashboard
            </span>
          </div>
        </Link>

        {/* Navigation */}
        <nav
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            marginLeft: 18,
          }}
        >
          <PillLink to="/portfolio" label="Portfolio" />
          <PillLink to="/exports" label="Exports" />
          <PillLink to="/uebersicht" label="Übersicht" />
          <PillLink to="/auswertung" label="Auswertung" />
          <PillLink to="/monate" label="Monate" />
          <PillLink to="/entry-add" label="+ Buchung" />
          <PillLink to="/admin/categories" label="Kategorien" />
        </nav>

        {/* Right */}
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span style={{ fontSize: 12, opacity: 0.75 }}>
            {email || "—"}
          </span>
          <button
            onClick={logout}
            style={{
              height: 36,
              padding: "0 12px",
              borderRadius: 10,
              border: "1px solid #e5e7eb",
              background: "#f9fafb",
              cursor: "pointer",
              fontWeight: 800,
            }}
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
