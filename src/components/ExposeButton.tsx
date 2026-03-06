
import { supabase } from "../lib/supabaseClient";

type ExposeButtonProps = {
  exposePath?: string | null;
};

function emptyButton() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 110,
        padding: "8px 14px",
        borderRadius: 12,
        border: "1px solid #e5e7eb",
        background: "#f9fafb",
        fontSize: 14,
        fontWeight: 800,
        color: "#9ca3af",
        whiteSpace: "nowrap",
      }}
      title="Noch kein Exposé hinterlegt"
    >
      Kein Exposé
    </span>
  );
}

export default function ExposeButton({ exposePath }: ExposeButtonProps) {
  const cleanedPath = typeof exposePath === "string" ? exposePath.trim() : "";

  if (!cleanedPath) {
    return emptyButton();
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("exposes").getPublicUrl(cleanedPath);

  if (!publicUrl) {
    return emptyButton();
  }

  return (
    <a
      href={publicUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => event.stopPropagation()}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 110,
        padding: "8px 14px",
        borderRadius: 12,
        border: "1px solid #e5e7eb",
        background: "#ffffff",
        fontSize: 14,
        fontWeight: 800,
        color: "#111827",
        textDecoration: "none",
        whiteSpace: "nowrap",
      }}
      title={cleanedPath}
    >
      Exposé
    </a>
  );
}