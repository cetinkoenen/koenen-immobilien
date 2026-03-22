import { Routes, Route } from "react-router-dom";
import { PropertyDetailPage } from "./features/property-detail";

export default function App() {
  return (
    <Routes>
      <Route path="/objekte/:propertyId" element={<PropertyDetailPage />} />
    </Routes>
  );
}