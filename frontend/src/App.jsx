import React from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router";
import { Navbar } from "./components/Navbar";
import { PustakaPage } from "./pages/PustakaPage";
import { TambahCeramahPage } from "./pages/TambahCeramahPage";
import { UrusPustakaPage } from "./pages/UrusPustakaPage";

export default function App() {
  const navigate = useNavigate();
  const goHome = () => navigate("/");

  // /penceramah/:id, /koleksi/:id and /cari render the library page for now;
  // their dedicated views and breadcrumbs arrive with Phase 7.3 (spec §8.3.4).
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <Navbar />

      <main className="flex-1">
        <Routes>
          <Route path="/" element={<PustakaPage />} />
          <Route path="/penceramah/:id" element={<PustakaPage />} />
          <Route path="/koleksi/:id" element={<PustakaPage />} />
          <Route path="/cari" element={<PustakaPage />} />
          <Route path="/tambah" element={<TambahCeramahPage onGoHome={goHome} />} />
          <Route path="/urus" element={<UrusPustakaPage onGoHome={goHome} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
