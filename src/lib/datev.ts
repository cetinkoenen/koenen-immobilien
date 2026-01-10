export type VatRate = 0 | 7 | 19;
export type BookingType = "income" | "expense";

export type DatevMappingRule = {
  propertyId: number;
  type: BookingType;
  vatRate: VatRate;
  category: string | null;
  konto: string;
  steuerschluessel: string;
};

export function resolveDatev(
  category: string,
  type: BookingType,
  vatRate: VatRate,
  mappings: DatevMappingRule[],
  propertyId: number
) {
  const exact = mappings.find(
    (m) =>
      m.propertyId === propertyId &&
      m.type === type &&
      m.vatRate === vatRate &&
      m.category === category
  );
  if (exact) return exact;

  const fallback = mappings.find(
    (m) =>
      m.propertyId === propertyId &&
      m.type === type &&
      m.vatRate === vatRate &&
      m.category === null
  );
  if (fallback) return fallback;

  return { konto: "—", steuerschluessel: "—" };
}
