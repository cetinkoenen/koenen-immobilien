// src/App.tsx
import React, { Suspense, useCallback, useEffect } from "react";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { supabase } from "./lib/supabaseClient";
import RequireAuthMFA from "./components/RequireAuthMFA";

/* =========================
   Lazy Pages
========================= */
const Login = React.lazy(() => import("./pages/Login"));
const MFA = React.lazy(() => import("./pages/MFA"));
const Portfolio = React.lazy(() => import("./pages/Portfolio"));

/* =========================
   Simple Layout
========================= */
function PageFallback() {
  return <div style={{ padding: 24 }}>Lädt…</div>;
}

function ProtectedLayout() {
  return (
    <div style={{ minHeight: "100vh", background: "#fff" }}>
      <div style={{ padding: 16, background: "crimson", color: "white", fontWeight: 900 }}>
        DEV-BASE-LAYOUT
