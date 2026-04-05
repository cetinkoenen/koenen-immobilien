// src/lib/ids.ts

/** Strict UUID v1-v5 check */
export function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

/** Normalize unknown -> trimmed string (handles null/undefined/"null"/"undefined") */
export function normalizeString(raw: unknown): string {
  if (raw == null) return "";
  const s = String(raw).trim();
  if (!s) return "";
  const lower = s.toLowerCase();
  if (lower === "undefined" || lower === "null") return "";
  return s;
}

/** Normalize unknown -> UUID string or "" */
export function normalizeUuid(raw: unknown): string {
  const s = normalizeString(raw);
  return s && isUuid(s) ? s : "";
}

/** Normalize unknown -> UUID string or null */
export function normalizeUuidOrNull(raw: unknown): string | null {
  const s = normalizeUuid(raw);
  return s ? s : null;
}

/** Encode a UUID for usage in route segments. Returns "" if invalid. */
export function encodeUuid(raw: unknown): string {
  const s = normalizeUuid(raw);
  return s ? encodeURIComponent(s) : "";
}

/** Throws a readable Error if raw is not a UUID. Returns normalized UUID otherwise. */
export function assertUuid(raw: unknown, message = "Ungültige ID (keine UUID)."): string {
  const s = normalizeUuid(raw);
  if (!s) throw new Error(message);
  return s;
}
