import { useMemo, useState, type CSSProperties } from "react";
import {
  NavLink,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { ArrowRight, Building2, CheckCircle2, LockKeyhole, Mail, Menu, Phone, ShieldCheck, X } from "lucide-react";

import PropertyDetailPage from "./features/property-detail/PropertyDetailPage";
import EntryAdd from "./pages/EntryAdd";
import Monate from "./pages/Monate";
import Objekte from "./pages/Objekte";
import Portfolio from "./pages/Portfolio";
import Auswertung from "./pages/Auswertung";
import NebenkostenTiefgarage from "./pages/NebenkostenTiefgarage";
import NebenkostenWohnungen from "./pages/NebenkostenWohnungen";
import Mietuebersicht from "./pages/Mietuebersicht";
import PortfolioAddress from "./pages/portfolio/PortfolioAddress";
import PortfolioDetails from "./pages/portfolio/PortfolioDetails";
import PortfolioEnergy from "./pages/portfolio/PortfolioEnergy";
import PortfolioFinance from "./pages/portfolio/PortfolioFinance";
import PortfolioPropertyLayout from "./pages/portfolio/PortfolioPropertyLayout";
import PortfolioRenting from "./pages/portfolio/PortfolioRenting";
import Login from "./pages/Login";
import MFA from "./pages/MFA";
import AuthCallback from "./pages/AuthCallback";
import RequireAuthMFA from "./components/RequireAuthMFA";
import BackupButton from "./components/BackupButton";
import CookieConsent from "./components/CookieConsent";
import { useAuth } from "./auth/AuthProvider";
import { supabase } from "./lib/supabaseClient";
import { clearAppSessionStorage } from "./lib/security";
import logo from "./assets/koenen-brand-logo.png";
import { AppDataProvider } from "./state/AppDataContext";
import "./App.css";


function HomePage() {
  const investmentPoints = [
    "Langfristiger Vermögensaufbau",
    "Fokus auf stabile und planbare Cashflows",
    "Nachhaltiger Portfolioaufbau im Bestand",
    "Erfahrung in aktiver Vermietung & Verwaltung",
    "Strukturierte und schnelle Entscheidungsprozesse",
  ];

  return (
    <main className="min-h-screen bg-[#f6f1e8] text-slate-950">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(15,35,55,0.14),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(184,134,70,0.18),transparent_32%)]" />
        <div className="relative mx-auto max-w-7xl px-5 py-6 sm:px-8 lg:px-10">
          <header className="flex items-center justify-between gap-4 rounded-[28px] border border-white/70 bg-white/75 px-4 py-3 shadow-sm backdrop-blur md:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-[#efe7da] ring-1 ring-slate-200">
                <img src={logo} alt="Könen Immobilien Logo" className="h-12 w-12 object-contain" />
              </div>
              <div>
                <div className="text-lg font-black tracking-tight text-[#0b2a44]">KÖNEN IMMOBILIEN</div>
                <div className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Investment & Bestand</div>
              </div>
            </div>
            <NavLink to="/login" className="hidden rounded-2xl bg-[#1f4e79] px-5 py-3 text-sm font-extrabold !text-white shadow-md shadow-slate-900/15 transition hover:bg-[#2b6396] sm:inline-flex">
              Login
            </NavLink>
          </header>

          <div className="grid items-center gap-10 py-14 lg:grid-cols-[1.08fr_0.92fr] lg:py-20">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#d6c7ad] bg-white/70 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[#8a642f]">
                <ShieldCheck size={16} /> Seit 2016 aktiv
              </div>
              <h1 className="mt-7 max-w-4xl text-3xl font-black leading-[1.08] tracking-tight text-[#0b2a44] sm:text-5xl lg:text-6xl">
                Strategischer Immobilienbestand mit planbaren Cashflows.
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-700 sm:text-xl">
                Seit 2016 vermieten wir unsere Immobilien im Bereich der kurz- und mittelfristigen Apartmentvermietung und bauen unser Portfolio kontinuierlich sowie strategisch aus.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a href="#kontakt" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#1f4e79] to-[#2b6396] px-6 py-4 text-base font-black !text-white shadow-lg shadow-slate-900/20 transition hover:from-[#173c5f] hover:to-[#245680]">
                  Kontakt aufnehmen <ArrowRight size={18} />
                </a>
                <NavLink to="/login" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white/80 px-6 py-4 text-base font-black text-[#0b2a44] shadow-sm transition hover:bg-white">
                  Interner Bereich <LockKeyhole size={18} />
                </NavLink>
              </div>
            </div>

            <div className="rounded-[36px] border border-white/80 bg-white/70 p-4 shadow-2xl shadow-slate-900/10 backdrop-blur">
              <div className="rounded-[28px] bg-[#f3eadc] p-8 text-center">
                <img src={logo} alt="Könen Immobilien" className="mx-auto h-48 w-48 object-contain sm:h-64 sm:w-64" />
                <div className="mt-6 rounded-3xl bg-white/75 p-5 text-left shadow-sm">
                  <div className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">Fokus</div>
                  <p className="mt-2 text-2xl font-black text-[#0b2a44]">Bestandimmobilien, aktive Verwaltung und nachhaltiger Vermögensaufbau.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-5 pb-10 sm:px-8 lg:grid-cols-3 lg:px-10">
        {["Kurz- & Mittelfristvermietung", "Bestand statt Spekulation", "Strukturierte Entscheidungen"].map((title, index) => (
          <div key={title} className="rounded-[28px] border border-white/80 bg-white/80 p-6 shadow-sm">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0b2a44] text-white"><Building2 size={22} /></div>
            <h2 className="text-xl font-black text-[#0b2a44]">{title}</h2>
            <p className="mt-3 leading-7 text-slate-600">
              {index === 0 && "Professionelle Vermietungsstrukturen für Appartements mit klarer Objekt- und Mieterübersicht."}
              {index === 1 && "Unser Fokus liegt auf nachhaltigem Portfolioaufbau durch Bestandimmobilien und stabile Cashflow-Strukturen."}
              {index === 2 && "Schnelle, nachvollziehbare Prozesse von der Prüfung bis zur Verwaltung."}
            </p>
          </div>
        ))}
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:px-10">
        <div className="rounded-[32px] bg-[#0b2a44] p-8 text-white shadow-xl shadow-slate-900/10 md:p-10">
          <div className="text-sm font-black uppercase tracking-[0.22em] text-[#d6c7ad]">Über uns</div>
          <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Könen Immobilien</h2>
          <p className="mt-5 leading-8 text-slate-100">
            Seit 2016 vermieten wir unsere Immobilien im Bereich Kurz- und Mittelfristvermietung von Appartements und bauen unser Portfolio kontinuierlich und strategisch weiter aus.
          </p>
          <p className="mt-4 leading-8 text-slate-100">
            Unser Fokus liegt auf nachhaltigem Vermögensaufbau durch Bestandimmobilien und stabile Cashflow-Strukturen.
          </p>
        </div>

        <div className="rounded-[32px] border border-white/80 bg-white/85 p-8 shadow-sm md:p-10">
          <div className="text-sm font-black uppercase tracking-[0.22em] text-[#8a642f]">Investmentansatz</div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {investmentPoints.map((point) => (
              <div key={point} className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <CheckCircle2 className="mt-0.5 shrink-0 text-[#0b2a44]" size={20} />
                <span className="font-bold leading-6 text-slate-800">{point}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="kontakt" className="mx-auto max-w-7xl px-5 py-12 sm:px-8 lg:px-10">
        <div className="grid gap-8 rounded-[36px] bg-white p-8 shadow-xl shadow-slate-900/10 md:p-10 lg:grid-cols-[1fr_0.9fr]">
          <div>
            <div className="text-sm font-black uppercase tracking-[0.22em] text-[#8a642f]">Kontakt</div>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-[#0b2a44] sm:text-5xl">Wir investieren in Immobilien mit Potenzial.</h2>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-650">
              Als langfristig orientierter Immobilieninvestor sind wir kontinuierlich auf der Suche nach attraktiven Wohn- und Anlageimmobilien. Diskretion, Verlässlichkeit und eine professionelle Zusammenarbeit stehen für uns an erster Stelle.
Wir freuen uns darauf, von Ihnen zu hören.
            </p>
          </div>
          <div className="rounded-[28px] bg-[#f6f1e8] p-6">
            <div className="text-xl font-black text-[#0b2a44]">Cetin & Nihal Könen</div>
            <div className="mt-5 space-y-4">
              <a className="flex items-center gap-3 rounded-2xl bg-white p-4 font-bold text-slate-800" href="mailto:Info.koenen@gmail.com"><Mail size={19} /> Info.koenen@gmail.com</a>
              <a className="flex items-center gap-3 rounded-2xl bg-white p-4 font-bold text-slate-800" href="tel:+4917623430637"><Phone size={19} /> +49 176 243 30 637</a>
            </div>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-col gap-3 px-5 pb-8 text-sm text-slate-500 sm:px-8 lg:px-10 md:flex-row md:items-center md:justify-between">
        <span>© {new Date().getFullYear()} Könen Immobilien</span>
        <div className="flex gap-4">
          <NavLink to="/impressum" className="font-bold text-[#1f4e79] underline underline-offset-4">Impressum</NavLink>
          <NavLink to="/datenschutz" className="font-bold text-[#1f4e79] underline underline-offset-4">Datenschutz</NavLink>
          <button type="button" onClick={() => window.dispatchEvent(new Event("open-cookie-settings"))} className="font-bold text-[#1f4e79] underline underline-offset-4">Cookie-Einstellungen</button>
        </div>
      </footer>
    </main>
  );
}

function DatenschutzPage() {
  return (
    <main className="min-h-screen bg-[#f6f1e8] px-5 py-8 text-slate-950 sm:px-8">
      <div className="mx-auto max-w-4xl rounded-[32px] border border-white/80 bg-white/85 p-6 shadow-xl shadow-slate-900/10 sm:p-10">
        <NavLink to="/" className="text-sm font-black text-[#1f4e79] underline underline-offset-4">
          Zurück zur Hauptseite
        </NavLink>
        <p className="mt-8 text-sm font-black uppercase tracking-[0.22em] text-[#8a642f]">Datenschutz</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-[#0b2a44] sm:text-5xl">Datenschutzerklärung</h1>
        <div className="mt-8 space-y-7 text-sm leading-7 text-slate-700 sm:text-base">
          <section>
            <h2 className="text-xl font-black text-[#0b2a44]">Verantwortliche Stelle</h2>
            <p className="mt-2">Cetin Könen<br />Hohenloher Str. 78/1<br />74243 Langenbrettach<br />E-Mail: <a className="font-bold text-[#1f4e79]" href="mailto:info.koenen@gmail.com">info.koenen@gmail.com</a><br />Telefon: <a className="font-bold text-[#1f4e79]" href="tel:+4917624330637">+49 176 243 30 637</a></p>
          </section>
          <section>
            <h2 className="text-xl font-black text-[#0b2a44]">Cookies</h2>
            <p className="mt-2">Unsere Webseite nutzt technisch notwendige Cookies bzw. lokale Speicherungen, damit die Webseite und der interne Bereich sicher funktionieren. Optionale Kategorien wie Analyse, Komfort und Marketing werden nur verwendet, wenn du diese im Cookie-Banner aktiv auswählst.</p>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event("open-cookie-settings"))}
              className="mt-4 inline-flex h-12 items-center justify-center rounded-2xl bg-[#1f4e79] px-5 text-sm font-black text-white transition hover:bg-[#2b6396]"
            >
              Cookie-Einstellungen öffnen
            </button>
          </section>
          <section>
            <h2 className="text-xl font-black text-[#0b2a44]">Zugriffsdaten und Hosting</h2>
            <p className="mt-2">Beim Besuch der Webseite können technisch erforderliche Zugriffsdaten verarbeitet werden, etwa Datum und Uhrzeit des Aufrufs, Browserinformationen, IP-Adresse und aufgerufene Seiten. Die Verarbeitung dient dem sicheren und stabilen Betrieb der Webseite.</p>
          </section>
          <section>
            <h2 className="text-xl font-black text-[#0b2a44]">Kontaktaufnahme</h2>
            <p className="mt-2">Wenn du uns per E-Mail oder Telefon kontaktierst, verarbeiten wir deine Angaben zur Bearbeitung der Anfrage und für mögliche Anschlussfragen.</p>
          </section>
          <section>
            <h2 className="text-xl font-black text-[#0b2a44]">Deine Rechte</h2>
            <p className="mt-2">Du hast nach Maßgabe der gesetzlichen Voraussetzungen Rechte auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch. Außerdem kannst du eine erteilte Einwilligung jederzeit mit Wirkung für die Zukunft ändern oder widerrufen.</p>
          </section>
          <p className="rounded-2xl bg-[#f6f1e8] p-4 text-xs leading-6 text-slate-600">Hinweis: Diese Vorlage ist eine technische und textliche Vorbereitung und ersetzt keine individuelle Rechtsberatung.</p>
        </div>
      </div>
    </main>
  );
}

function ImpressumPage() {
  return (
    <main className="min-h-screen bg-[#f6f1e8] px-5 py-8 text-slate-950 sm:px-8">
      <div className="mx-auto max-w-4xl rounded-[32px] border border-white/80 bg-white/85 p-6 shadow-xl shadow-slate-900/10 sm:p-10">
        <NavLink to="/" className="text-sm font-black text-[#1f4e79] underline underline-offset-4">
          Zurück zur Hauptseite
        </NavLink>
        <p className="mt-8 text-sm font-black uppercase tracking-[0.22em] text-[#8a642f]">Impressum</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-[#0b2a44] sm:text-5xl">Impressum</h1>
        <div className="mt-8 space-y-7 text-sm leading-7 text-slate-700 sm:text-base">
          <section>
            <h2 className="text-xl font-black text-[#0b2a44]">Angaben gemäß § 5 DDG</h2>
            <p className="mt-2">
              Cetin Könen<br />
              Hohenloher Str. 78/1<br />
              74243 Langenbrettach<br />
              Deutschland
            </p>
          </section>
          <section>
            <h2 className="text-xl font-black text-[#0b2a44]">Kontakt</h2>
            <p className="mt-2">
              E-Mail: <a className="font-bold text-[#1f4e79]" href="mailto:info.koenen@gmail.com">info.koenen@gmail.com</a><br />
              Telefon: <a className="font-bold text-[#1f4e79]" href="tel:+4917624330637">+49 176 243 30 637</a>
            </p>
          </section>
          <section>
            <h2 className="text-xl font-black text-[#0b2a44]">Verantwortlich für den Inhalt</h2>
            <p className="mt-2">Cetin Könen<br />Hohenloher Str. 78/1<br />74243 Langenbrettach</p>
          </section>
          <section>
            <h2 className="text-xl font-black text-[#0b2a44]">Haftung für Inhalte</h2>
            <p className="mt-2">Die Inhalte dieser Webseite wurden mit größter Sorgfalt erstellt. Für die Richtigkeit, Vollständigkeit und Aktualität übernehmen wir keine Gewähr.</p>
          </section>
          <section>
            <h2 className="text-xl font-black text-[#0b2a44]">Haftung für Links</h2>
            <p className="mt-2">Diese Webseite kann Links zu externen Webseiten enthalten. Auf deren Inhalte haben wir keinen Einfluss.</p>
          </section>
          <section>
            <h2 className="text-xl font-black text-[#0b2a44]">Urheberrecht</h2>
            <p className="mt-2">Die auf dieser Webseite erstellten Inhalte und Werke unterliegen dem deutschen Urheberrecht.</p>
          </section>
          <p className="rounded-2xl bg-[#f6f1e8] p-4 text-xs leading-6 text-slate-600">
            Bitte vor Veröffentlichung Adresse und ggf. Rechtsform/USt-ID ergänzen. Diese Vorlage ersetzt keine individuelle Rechtsberatung.
          </p>
        </div>
      </div>
    </main>
  );
}

function NotFoundPage() {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
      <h1 className="text-2xl font-semibold text-rose-900">Seite nicht gefunden</h1>
      <p className="mt-2 text-rose-700">Die aufgerufene Route existiert nicht.</p>
    </div>
  );
}

function navLinkStyle(isActive: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 136,
    height: 46,
    padding: "0 18px",
    borderRadius: 16,
    textDecoration: "none",
    fontWeight: 850,
    fontSize: 14,
    lineHeight: 1,
    letterSpacing: "-0.01em",
    transition: "background 140ms ease, border-color 140ms ease, transform 140ms ease, box-shadow 140ms ease",
    border: isActive ? "1px solid #c8c7ff" : "1px solid #d8d2c7",
    background: isActive ? "#eef0ff" : "rgba(255,255,255,0.78)",
    color: isActive ? "#3730a3" : "#111827",
    whiteSpace: "nowrap",
    boxShadow: isActive ? "0 3px 9px rgba(71, 85, 105, 0.12)" : "0 2px 6px rgba(71, 85, 105, 0.10)",
  };
}


function PropertyContextNotice() {
  const location = useLocation();
  const { propertyId } = useParams<{ propertyId: string }>();

  const activeSection = location.pathname.endsWith("/monate")
    ? "Monate"
    : location.pathname.endsWith("/auswertungen")
      ? "Auswertungen"
      : "Objektdetail";

  const shortId = !propertyId
    ? "–"
    : propertyId.length <= 14
      ? propertyId
      : `${propertyId.slice(0, 8)}…${propertyId.slice(-4)}`;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
      <span className="font-medium">Objekt:</span> <span className="font-mono">{shortId}</span>
      <span className="mx-2 text-slate-400">•</span>
      <span className="font-medium">Bereich:</span> {activeSection}
    </div>
  );
}

function PropertyDetailRoute(props: { mode?: "detail" | "monate" | "auswertungen" }) {
  return (
    <div className="space-y-4">
      <PropertyContextNotice />
      <PropertyDetailPage mode={props.mode ?? "detail"} />
    </div>
  );
}

function LogoutButton() {
  const navigate = useNavigate();
  const { user } = useAuth();

  async function handleLogout() {
    try {
      await supabase.auth.signOut({ scope: "local" });
      clearAppSessionStorage();
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Logout fehlgeschlagen:", error);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <span className="hidden h-[46px] items-center rounded-2xl border border-[#d8d2c7] bg-white/65 px-4 text-sm font-semibold text-slate-600 2xl:inline-flex">
        {user?.email ?? "Eingeloggt"}
      </span>
      <button
        type="button"
        onClick={handleLogout}
        className="inline-flex h-[46px] w-[116px] items-center justify-center rounded-2xl border border-[#d8d2c7] bg-white/75 px-4 text-sm font-extrabold text-slate-900 shadow-sm transition hover:bg-white"
      >
        Logout
      </button>
    </div>
  );
}

function ProtectedAppShell() {
  return (
    <RequireAuthMFA>
      <AppDataProvider>
        <AppShell />
      </AppDataProvider>
    </RequireAuthMFA>
  );
}

function NebenkostenIndexPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm md:p-10">
        <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-slate-500">Nebenkostenabrechnungen</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">NK-Abrechnungen</h1>
        <p className="mt-4 max-w-3xl text-slate-600">
          Wähle die passende Abrechnungsseite. Die bestehenden Inhalte, Berechnungen und Funktionen bleiben unverändert.
        </p>
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        <NavLink
          to="/nebenkosten/wohnungen"
          className="rounded-[28px] border border-slate-200 bg-white p-6 text-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md md:p-8"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700">
            <Building2 size={22} />
          </div>
          <h2 className="mt-5 text-2xl font-black">NK-Wohnungen</h2>
          <p className="mt-3 leading-7 text-slate-600">
            Nebenkostenabrechnung für Wohnungen mit den vorhandenen Eingaben, Umlageschlüsseln und Berechnungen.
          </p>
          <span className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-extrabold text-white">
            Öffnen <ArrowRight size={16} />
          </span>
        </NavLink>

        <NavLink
          to="/nebenkosten/tiefgarage"
          className="rounded-[28px] border border-slate-200 bg-white p-6 text-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md md:p-8"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
            <Building2 size={22} />
          </div>
          <h2 className="mt-5 text-2xl font-black">NK-Tiefgaragen</h2>
          <p className="mt-3 leading-7 text-slate-600">
            Nebenkostenabrechnung für Tiefgaragen/Stellplätze mit den bisherigen Funktionen und Ausgaben.
          </p>
          <span className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-extrabold text-white">
            Öffnen <ArrowRight size={16} />
          </span>
        </NavLink>
      </section>
    </div>
  );
}

function AppShell() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user } = useAuth();

  const navItems = useMemo<Array<{ to: string; label: string; end?: boolean }>>(
    () => [
      { to: "/portfolio", label: "Portfolio" },
      { to: "/objekte", label: "Objekte" },
      { to: "/monate", label: "Monate" },
      { to: "/auswertungen", label: "Auswertungen" },
      { to: "/buchungen", label: "Buchungen" },
      { to: "/mieteruebersicht", label: "Mieterübersicht" },
      { to: "/nebenkosten", label: "NK-Abrechnungen" },
    ],
    []
  );

  return (
    <div className="min-h-screen bg-[#f6f1e8] text-slate-950">
      <header className="sticky top-0 z-30 border-b border-[#e7ddcf] bg-[#f6f1e8]/88 backdrop-blur-xl">
        <div className="mx-auto max-w-[1760px] px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-5">
            <NavLink to="/" className="flex min-w-0 items-center gap-3" title="Zur Hauptseite">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#e3d8ca] bg-[#f3eadc] shadow-sm">
                <img src={logo} alt="Könen Immobilien" className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Property App
                </div>
                <div className="text-lg font-semibold leading-tight text-slate-950 sm:text-2xl">
                  Immobilien-Finanzübersicht
                </div>
              </div>
            </NavLink>

            <div className="hidden min-w-0 flex-1 items-center justify-end gap-5 xl:flex">
              <nav className="flex max-w-[660px] flex-wrap justify-center gap-2.5">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    style={({ isActive }) => navLinkStyle(isActive)}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>
              <BackupButton />
              <LogoutButton />
            </div>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm xl:hidden"
              aria-label={mobileMenuOpen ? "Menü schließen" : "Menü öffnen"}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>

          {mobileMenuOpen && (
            <div className="mt-4 rounded-[24px] border border-[#e7ddcf] bg-white/76 p-3 shadow-sm xl:hidden">
              <nav className="grid gap-2">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      [
                        "rounded-2xl border px-4 py-3 text-base font-extrabold shadow-sm transition",
                        isActive
                          ? "border-indigo-200 bg-indigo-50 text-indigo-800"
                          : "border-slate-200 bg-white text-slate-900",
                      ].join(" ")
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>

              <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-[#e7ddcf] bg-white/80 p-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600">
                  {user?.email ?? "Eingeloggt"}
                </div>
                <BackupButton />
                <LogoutButton />
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6">
        <Outlet />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <>
      <Routes>
      <Route
        path="/login"
        element={
          <RequireAuthMFA>
            <Login />
          </RequireAuthMFA>
        }
      />
      <Route
        path="/mfa"
        element={
          <RequireAuthMFA>
            <MFA />
          </RequireAuthMFA>
        }
      />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/" element={<HomePage />} />
      <Route path="/datenschutz" element={<DatenschutzPage />} />
      <Route path="/impressum" element={<ImpressumPage />} />

      <Route element={<ProtectedAppShell />}>
        <Route path="/dashboard" element={<Navigate to="/portfolio" replace />} />

        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="/portfolio/:propertyId" element={<PortfolioPropertyLayout />}>
          <Route index element={<Navigate to="address" replace />} />
          <Route path="address" element={<PortfolioAddress />} />
          <Route path="details" element={<PortfolioDetails />} />
          <Route path="finanzen" element={<PortfolioFinance />} />
          <Route path="energie" element={<PortfolioEnergy />} />
          <Route path="vermietung" element={<PortfolioRenting />} />
        </Route>

        <Route path="/objekte" element={<Objekte />} />
        <Route path="/objekte/:propertyId" element={<PropertyDetailRoute mode="detail" />} />
        <Route path="/objekte/:propertyId/monate" element={<PropertyDetailRoute mode="monate" />} />
        <Route
          path="/objekte/:propertyId/auswertungen"
          element={<PropertyDetailRoute mode="auswertungen" />}
        />

        <Route path="/monate" element={<Monate />} />
        <Route path="/auswertungen" element={<Auswertung />} />
        <Route path="/auswertung" element={<Navigate to="/auswertungen" replace />} />

        <Route path="/buchungen" element={<EntryAdd />} />
        <Route path="/mieteruebersicht" element={<Mietuebersicht />} />
        <Route path="/entry-add" element={<Navigate to="/buchungen" replace />} />

        <Route path="/nebenkosten" element={<NebenkostenIndexPage />} />
        <Route path="/nebenkosten/tiefgarage" element={<NebenkostenTiefgarage />} />
        <Route path="/nebenkosten/wohnungen" element={<NebenkostenWohnungen />} />

        <Route path="/darlehen" element={<Navigate to="/objekte" replace />} />
      </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <CookieConsent />
    </>
  );
}
