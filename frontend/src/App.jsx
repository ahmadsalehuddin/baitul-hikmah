import React, { useState } from "react";
import { Navbar } from "./components/Navbar";
import { PustakaPage } from "./pages/PustakaPage";
import { TambahCeramahPage } from "./pages/TambahCeramahPage";
import { UrusPustakaPage } from "./pages/UrusPustakaPage";

export default function App() {
  const [activeTab, setActiveTab] = useState("pustaka");

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-brand-gold selection:text-white">
      <Navbar activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="flex-1">
        {activeTab === "pustaka" && <PustakaPage />}
        {activeTab === "tambah" && <TambahCeramahPage onGoHome={() => setActiveTab("pustaka")} />}
        {activeTab === "urus" && <UrusPustakaPage onGoHome={() => setActiveTab("pustaka")} />}
      </main>
    </div>
  );
}
