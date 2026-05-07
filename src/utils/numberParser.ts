export function parseLocaleNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (value === null || value === undefined) return fallback;

  let raw = String(value).trim();
  if (!raw) return fallback;

  raw = raw
    .replace(/€/g, "")
    .replace(/\s+/g, "")
    .replace(/[^0-9,.-]/g, "");

  if (!raw || raw === "-" || raw === "," || raw === ".") return fallback;

  const sign = raw.startsWith("-") ? "-" : "";
  raw = raw.replace(/-/g, "");

  const comma = raw.lastIndexOf(",");
  const dot = raw.lastIndexOf(".");

  if (comma >= 0 && dot >= 0) {
    // 1.234,56 => 1234.56 | 1234.56 => 1234.56
    raw = comma > dot ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/,/g, "");
  } else if (comma >= 0) {
    const parts = raw.split(",");
    const decimals = parts.at(-1) ?? "";
    raw = decimals.length > 0 && decimals.length <= 2
      ? parts.slice(0, -1).join("").replace(/\./g, "") + "." + decimals
      : raw.replace(/,/g, "");
  } else if (dot >= 0) {
    const parts = raw.split(".");
    if (parts.length > 2) {
      // German thousands format: 1.250.629 => 1250629
      raw = raw.replace(/\./g, "");
    } else {
      const [integerPart, decimalPart = ""] = parts;
      // Important: Supabase numeric values arrive as strings like
      // "125062.860000000000". That is a decimal point, not a
      // thousands separator. Older code removed the dot because the
      // decimal part had more than two digits, which turned
      // 125062.86 into 12,506,286,000,000,000.
      const dotLooksLikeThousands = decimalPart.length === 3 && integerPart.length <= 3;
      const dotLooksLikeDecimal = decimalPart.length > 0 && !dotLooksLikeThousands;
      raw = dotLooksLikeDecimal ? `${integerPart}.${decimalPart}` : raw.replace(/\./g, "");
    }
  }

  const parsed = Number(sign + raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function parseNullableLocaleNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = parseLocaleNumber(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : null;
}
