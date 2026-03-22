import type { Property } from "@/services/propertyService";

type Props = {
  property: Property;
};

export function PropertyHeader({ property }: Props) {
  return (
    <div>
      <h1 style={{ margin: 0 }}>
        {property.title || property.name || "Unbenanntes Objekt"}
      </h1>
      <p style={{ marginTop: 8, color: "#666" }}>
        ID: {property.id}
      </p>
    </div>
  );
}
