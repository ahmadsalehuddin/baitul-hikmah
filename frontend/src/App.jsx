import React from "react";
import { Navigate, Route, Routes } from "react-router";
import { Navbar } from "./components/Navbar";
import { PlayerHost } from "./components/player/PlayerHost";
import { LibraryProvider } from "./hooks/use-library";
import { LibraryView } from "./pages/LibraryView";
import { PustakaPage } from "./pages/PustakaPage";
import { TambahCeramahPage } from "./pages/TambahCeramahPage";
import { UrusPustakaPage } from "./pages/UrusPustakaPage";

export default function App() {
  return (
    <LibraryProvider>
      <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
        <Navbar />

        <main className="flex-1">
          <Routes>
            <Route element={<PustakaPage />}>
              <Route path="/" element={<LibraryView mode="home" />} />
              <Route path="/penceramah/:id" element={<LibraryView mode="speaker" />} />
              <Route path="/koleksi/:id" element={<LibraryView mode="collection" />} />
              <Route path="/cari" element={<LibraryView mode="search" />} />
            </Route>
            <Route path="/tambah" element={<TambahCeramahPage />} />
            <Route path="/urus" element={<UrusPustakaPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>

      {/* Outside <Routes>: the player opens on top of any page. */}
      <PlayerHost />
    </LibraryProvider>
  );
}
