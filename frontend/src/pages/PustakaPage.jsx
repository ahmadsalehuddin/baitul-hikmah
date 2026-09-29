import React from "react";
import { Outlet } from "react-router";
import { PageLayout } from "@/components/PageLayout";
import { SearchBar } from "@/components/library/SearchBar";

/**
 * Layout for every Pustaka Ceramah route (/, /penceramah/:id, /koleksi/:id, /cari):
 * narrow centred header (H1, description, search) above the wider content column (spec §8.3.3).
 * It stays mounted while navigating between those routes, so the search box keeps focus while typing.
 */
export function PustakaPage() {
  return (
    <PageLayout
      title="Pustaka Ceramah"
      description="Cari dan tonton kesemua koleksi ceramah secara terus dari dalam pustaka."
      header={<SearchBar />}
    >
      <Outlet />
    </PageLayout>
  );
}
