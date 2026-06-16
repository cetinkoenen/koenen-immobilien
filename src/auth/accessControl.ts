export const ADMIN_EMAIL = "info.koenen@gmail.com";

export const READONLY_APPROVAL_EMAILS = [
  "nihal.koenen@gmail.com",
  "cetin.koenen@gmail.com",
] as const;

export type AppAccessRole = "admin" | "viewer";

export function normalizeEmail(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

export function isAdminEmail(value: string | null | undefined): boolean {
  return normalizeEmail(value) === ADMIN_EMAIL;
}

export function isReadonlyApprovalEmail(value: string | null | undefined): boolean {
  return READONLY_APPROVAL_EMAILS.includes(normalizeEmail(value) as (typeof READONLY_APPROVAL_EMAILS)[number]);
}

export function roleForEmail(value: string | null | undefined): AppAccessRole {
  return isAdminEmail(value) ? "admin" : "viewer";
}
