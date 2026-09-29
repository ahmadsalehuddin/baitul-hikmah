import React from "react";
import { Outlet } from "react-router";
import { SearchBar } from "@/components/library/SearchBar";

/**
 * Layout for every Pustaka Ceramah route (/, /penceramah/:id, /koleksi/:id, /cari):
 * narrow centred header (H1, description, search) above the wider content column (spec §8.3.3).
 * It stays mounted while navigating between those routes, so the search box keeps focus while typing.
 */
export function PustakaPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pt-8 pb-16 sm:px-6">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl">Pustaka Ceramah</h1>
          <p>Cari dan tonton kesemua koleksi ceramah secara terus dari dalam pustaka.</p>
        </div>
        <SearchBar />
      </div>
      <Outlet />
    </div>
  );
}
