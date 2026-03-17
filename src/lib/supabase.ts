import { createClient, type Session } from "@supabase/supabase-js";

type RequiredEnvVar = "VITE_SUPABASE_URL" | "VITE_SUPABASE_ANON_KEY";

function getEnvVar(name: RequiredEnvVar): string {
  const value = import.meta.env[name];

  if (!value || typeof value !== "string" || value.trim() === "") {
    throw new Error(
      `${name} fehlt oder ist leer. Bitte prüfe deine .env-Datei oder Vercel-Umgebungsvariablen.`
    );
  }

  return value.trim();
}

function getRuntimeLocation() {
  if (typeof window === "undefined") {
    return {
      origin: null,
      hostname: null,
      href: null,
      userAgent: null,
    };
  }

  return {
    origin: window.location.origin,
    hostname: window.location.hostname,
    href: window.location.href,
    userAgent: window.navigator.userAgent,
  };
}

function maskKey(value: string): string {
  if (!value) return "";
  if (value.length <= 12) return `${value.slice(0, 4)}...`;
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

function extractProjectRef(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    const firstPart = host.split(".")[0];
    return firstPart || null;
  } catch {
    return null;
  }
}

function serializeSession(session: Session | null) {
  if (!session) {
    return {
      exists: false,
      userId: null,
      email: null,
      expiresAt: null,
      accessTokenPresent: false,
      refreshTokenPresent: false,
    };
  }

  return {
    exists: true,
    userId: session.user?.id ?? null,
    email: session.user?.email ?? null,
    expiresAt: session.expires_at ?? null,
    accessTokenPresent: Boolean(session.access_token),
    refreshTokenPresent: Boolean(session.refresh_token),
  };
}

const supabaseUrl = getEnvVar("VITE_SUPABASE_URL");
const supabaseAnonKey = getEnvVar("VITE_SUPABASE_ANON_KEY");

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce",
  },
  global: {
    headers: {
      "x-application-name": "property-dashboard",
    },
  },
});

const isDev = Boolean(import.meta.env.DEV);

export async function getSupabaseRuntimeDebugInfo() {
  const location = getRuntimeLocation();

  let sessionInfo: ReturnType<typeof serializeSession> | null = null;
  let userInfo: { id: string | null; email: string | null } | null = null;
  let sessionError: string | null = null;
  let userError: string | null = null;

  try {
    const { data, error } = await supabase.auth.getSession();
    sessionInfo = serializeSession(data?.session ?? null);
    sessionError = error?.message ?? null;
  } catch (error) {
    sessionInfo = null;
    sessionError = error instanceof Error ? error.message : String(error);
  }

  try {
    const { data, error } = await supabase.auth.getUser();
    userInfo = {
      id: data?.user?.id ?? null,
      email: data?.user?.email ?? null,
    };
    userError = error?.message ?? null;
  } catch (error) {
    userInfo = null;
    userError = error instanceof Error ? error.message : String(error);
  }

  return {
    timestamp: new Date().toISOString(),
    env: {
      supabaseUrl,
      supabaseProjectRef: extractProjectRef(supabaseUrl),
      anonKeyPreview: maskKey(supabaseAnonKey),
      mode: import.meta.env.MODE ?? null,
      dev: Boolean(import.meta.env.DEV),
      prod: Boolean(import.meta.env.PROD),
    },
    runtime: location,
    auth: {
      session: sessionInfo,
      user: userInfo,
      sessionError,
      userError,
    },
  };
}

export async function logSupabaseRuntimeDebugInfo(label = "supabase.runtime") {
  const debugInfo = await getSupabaseRuntimeDebugInfo();
  console.log(`[${label}]`, debugInfo);
  return debugInfo;
}

if (typeof window !== "undefined" && isDev) {
  void logSupabaseRuntimeDebugInfo("supabase.init");

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    const location = getRuntimeLocation();

    console.log("[supabase.auth.onAuthStateChange]", {
      timestamp: new Date().toISOString(),
      event,
      runtime: location,
      env: {
        supabaseUrl,
        supabaseProjectRef: extractProjectRef(supabaseUrl),
        anonKeyPreview: maskKey(supabaseAnonKey),
        mode: import.meta.env.MODE ?? null,
      },
      session: serializeSession(session),
    });
  });

  void subscription;
}