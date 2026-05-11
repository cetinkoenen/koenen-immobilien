import { Navigate, Route, Routes } from "react-router-dom";

import Portfolio from "./pages/Portfolio";
import Login from "./pages/Login";
import RequireAuthMFA from "./components/RequireAuthMFA";
import { AppDataProvider } from "./state/AppDataContext";
import "./App.css";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />

      <Route
        path="/dashboard"
        element={
          <RequireAuthMFA>
            <AppDataProvider>
              <Portfolio />
            </AppDataProvider>
          </RequireAuthMFA>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
