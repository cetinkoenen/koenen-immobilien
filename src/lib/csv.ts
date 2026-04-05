// src/lib/csv.ts
export function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";

  const stringValue = String(value);

  // Falls Komma, Anführungszeichen oder Zeilenumbruch enthalten sind:
  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n")
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

export function toCsv(
  rows: Array<Record<string, unknown>>,
  headers?: string[]
): string {
  if (!rows.length) return "";

  const columns = headers ?? Object.keys(rows[0]);

  const headerLine = columns.map(escapeCsvValue).join(",");

  const dataLines = rows.map((row) =>
    columns.map((col) => escapeCsvValue(row[col])).join(",")
  );

  return [headerLine, ...dataLines].join("\n");
}

export function downloadCsv(filename: string, csvContent: string) {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}