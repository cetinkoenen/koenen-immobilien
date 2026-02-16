# Koenen Immobilien

A modern real estate web application built with **React**, **Vite**, **TypeScript**, and **Supabase**.  
The project focuses on a clean frontend architecture, modern tooling, and a production-ready deployment workflow.

## 🚀 Live Demo
👉 https://koenen-immobilien.vercel.app

## ✨ Features
- Modern React frontend with TypeScript
- Fast development & optimized production builds using Vite
- Responsive UI built with Tailwind CSS
- Backend-as-a-Service using Supabase (Auth & Database)
- Environment-based configuration (Development / Production)
- Continuous deployment via Vercel (CI/CD)

## 🛠️ Tech Stack
- **Frontend:** React, TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS
- **Backend:** Supabase
- **Hosting & CI/CD:** Vercel

## 📁 Project Structure

```text
koenen-app/
├─ public/
│  ├─ logo/                 # Static assets (logos, images)
│  └─ vite.svg
│
├─ src/
│  ├─ components/           # Reusable UI components
│  ├─ pages/                # Application pages / routes
│  ├─ lib/                  # Utilities (e.g. Supabase client)
│  ├─ assets/               # Frontend assets
│  ├─ App.tsx               # Root application component
│  └─ main.tsx              # Application entry point
│
├─ screenshots/             # Project screenshots for README
│
├─ index.html               # HTML entry file
├─ vite.config.ts           # Vite configuration
├─ tsconfig.json            # Base TypeScript configuration
├─ tsconfig.app.json        # App-specific TS config
├─ tsconfig.node.json       # Node/Vite TS config
├─ package.json             # Dependencies & scripts
└─ README.md                # Project documentation
