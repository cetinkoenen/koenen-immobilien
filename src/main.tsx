// src/main.tsx
import { StrictMode, Component, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";

// Falls du eine globale CSS-Datei hast, einkommentieren/anpassen:
// import "./index.css";

/**
 * Simple ErrorBoundary, damit du bei Runtime-Errors
 * nicht nur eine weiße Seite bekommst.
 */
type ErrorBoundaryState = { hasError: boolean; error?: unknown };

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: undefined };

  static getDerivedStateFromError(error: unknown) {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown) {
    console.error("App crashed:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, fontFamily: "system-ui" }}>
          <h1 style={{ margin: 0, fontSize: 18 }}>Etwas ist schiefgelaufen.</h1>
          <p style={{ opacity: 0.75 }}>
            Öffne die Konsole (F12 → Console) für Details.
          </p>
          <pre
            style={{
              marginTop: 12,
              padding: 12,
              background: "#f3f4f6",
              borderRadius: 12,
              overflow: "auto",
              fontSize: 12
            }}
          >
            {String(this.state.error)}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>
);
