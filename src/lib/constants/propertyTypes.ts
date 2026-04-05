// src/lib/constants/propertyTypes.ts

export const PROPERTY_TYPE_MAP = {
  Wohnung: "APARTMENT",
  Haus: "HOUSE",
  Garage: "GARAGE",
} as const

export type PropertyTypeLabel = keyof typeof PROPERTY_TYPE_MAP
export type PropertyTypeEnum = (typeof PROPERTY_TYPE_MAP)[PropertyTypeLabel]

export const PROPERTY_TYPE_LABELS = Object.keys(PROPERTY_TYPE_MAP) as PropertyTypeLabel[]

export const PROPERTY_TYPE_REVERSE_MAP = {
  APARTMENT: "Wohnung",
  HOUSE: "Haus",
  GARAGE: "Garage",
} as const
