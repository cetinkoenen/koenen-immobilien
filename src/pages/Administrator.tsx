import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Building2, ShieldCheck, UserPlus } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { isAdminEmail } from "../auth/accessControl";
import { supabase } from "../lib/supabaseClient";

type PropertyType = "wohnung" | "garage";
type UserRoleInput = "viewer" | "admin";
type AdministratorFocus = "all" | "property" | "tenant" | "users";

type PropertyForm = {
  type: PropertyType;
  name: string;
  street: string;
  postalCode: string;
  city: string;
  unitLabel: string;
  rentType: string;
  rentMonthly: string;
  startDate: string;
  endDate: string;
  livingArea: string;
  rooms: string;
  coldRent: string;
  operatingCosts: string;
  marketValue: string;
  notes: string;
};

type UserForm = {
  email: string;
  password: string;
  role: UserRoleInput;
  requiresApproval: boolean;
};

const emptyPropertyForm: PropertyForm = {
  type: "wohnung",
  name: "",
  street: "",
  postalCode: "",
  city: "",
  unitLabel: "Wohnung",
  rentType: "Wohnung",
  rentMonthly: "",
  startDate: "",
  endDate: "",
  livingArea: "",
  rooms: "",
  coldRent: "",
  operatingCosts: "",
  marketValue: "",
  notes: "",
};

const emptyUserForm: UserForm = {
  email: "",
  password: "",
  role: "viewer",
  requiresApproval: true,
};

function parseMoney(value: string): number | null {
  const normalized = value.trim().replace(/\./g, "").replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanText(value: string): string | null {
  const cleaned = value.trim();
  return cleaned ? cleaned : null;
}

function composePropertyName(form: PropertyForm): string {
  const direct = form.name.trim();
  if (direct) return direct;
  return [form.street, form.postalCode, form.city].map((part) => part.trim()).filter(Boolean).join(" ");
}

const headerCopy: Record<AdministratorFocus, { eyebrow: string; title: string; description: string }> = {
  all: {
    eyebrow: "Administration",
    title: "Administrator",
    description: "Zentrale Anlage für neue Immobilien, Mieterstammdaten und Benutzerrechte.",
  },
  property: {
    eyebrow: "Immobilien",
    title: "Immobilie anlegen",
    description: "Neue Wohnungen oder Garagen mit Vermietungsstart und Sollmiete im Immobilienbestand erfassen.",
  },
  tenant: {
    eyebrow: "Mieter",
    title: "Mieter-Stammdaten",
    description: "Mieter anlegen und Mietverhältnisse im Mieterbereich pflegen.",
  },
  users: {
    eyebrow: "Einstellungen",
    title: "Benutzer- & Rechteverwaltung",
    description: "Benutzer, Rollen und Login-Sicherheit verwalten. Immobilien- und Mieterstammdaten liegen in den Fachbereichen.",
  },
};

export default function Administrator({ focus = "all" }: { focus?: AdministratorFocus }) {
  const { user } = useAuth();
  const isAdmin = isAdminEmail(user?.email);
  const showProperty = focus === "all" || focus === "property";
  const showTenant = focus === "all" || focus === "tenant";
  const showUsers = focus === "all" || focus === "users";
  const copy = headerCopy[focus];
  const [propertyForm, setPropertyForm] = useState<PropertyForm>(emptyPropertyForm);
  const [userForm, setUserForm] = useState<UserForm>(emptyUserForm);
  const [propertyStatus, setPropertyStatus] = useState<string | null>(null);
  const [userStatus, setUserStatus] = useState<string | null>(null);
  const [propertyError, setPropertyError] = useState<string | null>(null);
  const [userError, setUserError] = useState<string | null>(null);
  const [savingProperty, setSavingProperty] = useState(false);
  const [savingUser, setSavingUser] = useState(false);

  const propertyName = useMemo(() => composePropertyName(propertyForm), [propertyForm]);

  function updatePropertyField(event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = event.target;
    setPropertyForm((current) => {
      const next = { ...current, [name]: value };
      if (name === "type") {
        next.unitLabel = value === "garage" ? "Garage" : "Wohnung";
        next.rentType = value === "garage" ? "Garage" : "Wohnung";
      }
      return next;
    });
  }

  function updateUserField(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value, type } = event.target;
    const checked = type === "checkbox" ? (event.target as HTMLInputElement).checked : undefined;
    setUserForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  }

  async function handleCreateProperty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPropertyStatus(null);
    setPropertyError(null);

    if (!propertyName) {
      setPropertyError("Bitte Objektname oder Adresse eintragen.");
      return;
    }

    if (!propertyForm.startDate) {
      setPropertyError("Bitte Startdatum der Vermietung eintragen.");
      return;
    }

    setSavingProperty(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const userId = authData.user?.id;
      if (!userId) throw new Error("Nicht eingeloggt.");

      const { data: property, error: propertyInsertError } = await supabase
        .from("portfolio_properties")
        .insert({
          name: propertyName,
        })
        .select("id")
        .single();

      if (propertyInsertError) throw propertyInsertError;
      const propertyId = String((property as { id: string }).id);

      const rentMonthly = parseMoney(propertyForm.rentMonthly);
      if (rentMonthly !== null) {
        const { error: rentalError } = await supabase.from("portfolio_property_rentals").insert({
          property_id: propertyId,
          unit_id: cleanText(propertyForm.unitLabel),
          rent_type: cleanText(propertyForm.rentType),
          rent_monthly: rentMonthly,
          start_date: propertyForm.startDate,
          end_date: cleanText(propertyForm.endDate),
          notes: cleanText(propertyForm.notes),
        });
        if (rentalError) throw rentalError;
      }

      const { error: extraError } = await supabase.from("property_extra_info").upsert({
        user_id: userId,
        property_id: propertyId,
        living_area: propertyForm.livingArea,
        rooms: propertyForm.rooms,
        cold_rent: propertyForm.coldRent,
        operating_costs: propertyForm.operatingCosts,
        total_rent: propertyForm.rentMonthly,
        market_value: propertyForm.marketValue,
        equipment: propertyForm.notes,
      });
      if (extraError) console.warn("Zusatzdaten konnten nicht gespeichert werden:", extraError);

      window.dispatchEvent(new Event("koenen:rentals-changed"));
      setPropertyStatus("Immobilie und Vermietungszeitraum wurden angelegt.");
      setPropertyForm(emptyPropertyForm);
    } catch (error) {
      setPropertyError(error instanceof Error ? error.message : "Immobilie konnte nicht angelegt werden.");
    } finally {
      setSavingProperty(false);
    }
  }

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUserStatus(null);
    setUserError(null);

    if (!userForm.email.trim() || !userForm.password.trim()) {
      setUserError("Bitte E-Mail und Passwort eintragen.");
      return;
    }

    setSavingUser(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      const response = await fetch("/api/admin-create-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(userForm),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? `HTTP ${response.status}`);
      setUserStatus("User wurde angelegt/aktualisiert.");
      setUserForm(emptyUserForm);
    } catch (error) {
      setUserError(error instanceof Error ? error.message : "User konnte nicht angelegt werden.");
    } finally {
      setSavingUser(false);
    }
  }

  if (!isAdmin) {
    return (
      <section className="admin-page">
        <div className="admin-denied">
          <ShieldCheck size={28} />
          <h1>{copy.title}</h1>
          <p>Diese Seite ist nur für den Admin sichtbar.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="admin-page">
      <header className="admin-hero">
        <div>
          <span>{copy.eyebrow}</span>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>
        </div>
      </header>

      <div className={["admin-grid", showProperty !== (showTenant || showUsers) ? "admin-grid-single" : ""].filter(Boolean).join(" ")}>
        {showProperty ? (
          <form className="admin-panel" onSubmit={handleCreateProperty}>
            <div className="admin-panel-head">
              <Building2 size={22} />
              <div>
                <h2>Immobilie anlegen</h2>
                <p>Wohnung oder Garage mit Vermietungsstart und Sollmiete.</p>
              </div>
            </div>

            <div className="admin-form-grid">
              <label>
                Art
                <select name="type" value={propertyForm.type} onChange={updatePropertyField}>
                  <option value="wohnung">Wohnung</option>
                  <option value="garage">Garage</option>
                </select>
              </label>
              <label>
                Objektname
                <input name="name" value={propertyForm.name} onChange={updatePropertyField} placeholder="z. B. Musterstr. 12" />
              </label>
              <label>
                Straße
                <input name="street" value={propertyForm.street} onChange={updatePropertyField} />
              </label>
              <label>
                PLZ
                <input name="postalCode" value={propertyForm.postalCode} onChange={updatePropertyField} />
              </label>
              <label>
                Ort
                <input name="city" value={propertyForm.city} onChange={updatePropertyField} />
              </label>
              <label>
                Einheit
                <input name="unitLabel" value={propertyForm.unitLabel} onChange={updatePropertyField} />
              </label>
              <label>
                Mietart
                <input name="rentType" value={propertyForm.rentType} onChange={updatePropertyField} />
              </label>
              <label>
                Sollmiete gesamt
                <input name="rentMonthly" value={propertyForm.rentMonthly} onChange={updatePropertyField} placeholder="0,00" />
              </label>
              <label>
                Kaltmiete
                <input name="coldRent" value={propertyForm.coldRent} onChange={updatePropertyField} placeholder="0,00" />
              </label>
              <label>
                Nebenkosten
                <input name="operatingCosts" value={propertyForm.operatingCosts} onChange={updatePropertyField} placeholder="0,00" />
              </label>
              <label>
                Start Vermietung
                <input type="date" name="startDate" value={propertyForm.startDate} onChange={updatePropertyField} />
              </label>
              <label>
                Ende
                <input type="date" name="endDate" value={propertyForm.endDate} onChange={updatePropertyField} />
              </label>
              <label>
                Wohn-/Nutzfläche
                <input name="livingArea" value={propertyForm.livingArea} onChange={updatePropertyField} />
              </label>
              <label>
                Zimmer
                <input name="rooms" value={propertyForm.rooms} onChange={updatePropertyField} />
              </label>
              <label>
                Marktwert
                <input name="marketValue" value={propertyForm.marketValue} onChange={updatePropertyField} />
              </label>
              <label className="admin-wide">
                Notizen / Ausstattung
                <textarea name="notes" value={propertyForm.notes} onChange={updatePropertyField} rows={4} />
              </label>
            </div>

            {propertyError ? <div className="admin-message error">{propertyError}</div> : null}
            {propertyStatus ? <div className="admin-message">{propertyStatus}</div> : null}
            <button className="admin-primary" type="submit" disabled={savingProperty}>
              {savingProperty ? "Speichern..." : "Immobilie speichern"}
            </button>
          </form>
        ) : null}

        {showTenant || showUsers ? (
          <div className="admin-stack">
            {showTenant ? (
              <div className="admin-panel">
                <div className="admin-panel-head">
                  <UserPlus size={22} />
                  <div>
                    <h2>Mieter anlegen</h2>
                    <p>Mieterstammdaten und Mietverhältnisse zentral im Mieterbereich pflegen.</p>
                  </div>
                </div>
                <Link className="admin-link-button" to="/mieter/stammdaten">Mieter-Stammdaten öffnen</Link>
              </div>
            ) : null}

            {showUsers ? (
              <form className="admin-panel" onSubmit={handleCreateUser}>
                <div className="admin-panel-head">
                  <ShieldCheck size={22} />
                  <div>
                    <h2>User anlegen</h2>
                    <p>Neue Nutzer mit Lese- oder Admin-Rechten erstellen.</p>
                  </div>
                </div>
                <div className="admin-form-grid one">
                  <label>
                    E-Mail
                    <input name="email" type="email" value={userForm.email} onChange={updateUserField} />
                  </label>
                  <label>
                    Passwort
                    <input name="password" type="password" value={userForm.password} onChange={updateUserField} />
                  </label>
                  <label>
                    Rechte
                    <select name="role" value={userForm.role} onChange={updateUserField}>
                      <option value="viewer">Read</option>
                      <option value="admin">Write / Admin</option>
                    </select>
                  </label>
                  <label className="admin-check">
                    <input name="requiresApproval" type="checkbox" checked={userForm.requiresApproval} onChange={updateUserField} />
                    Login erst nach Admin-Freigabe erlauben
                  </label>
                </div>
                {userError ? <div className="admin-message error">{userError}</div> : null}
                {userStatus ? <div className="admin-message">{userStatus}</div> : null}
                <button className="admin-primary" type="submit" disabled={savingUser}>
                  {savingUser ? "User wird angelegt..." : "User speichern"}
                </button>
              </form>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
