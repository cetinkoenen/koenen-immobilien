import { Routes, Route } from "react-router-dom";
import { PropertyDetailPage } from "./features/property-detail";

function Home() {
  return (
    <div style={{ padding: 40 }}>
      <h1>App läuft 🚀</h1>
      <p>Gehe zu /objekte/1 um ein Objekt zu sehen.</p>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/objekte/:propertyId" element={<PropertyDetailPage />} />
    </Routes>
  );
}