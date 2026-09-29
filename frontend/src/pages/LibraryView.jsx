import React, { useMemo, useState } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router";
import { Heart, LibraryBig, RefreshCw, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { ContinueWatchingRow } from "@/components/library/ContinueWatchingRow";
import { LibraryGrid, LoadingIndicator } from "@/components/library/LibraryGrid";
import { FilterSortControls, LibraryBreadcrumb } from "@/components/library/LibraryToolbar";
import { useLibrary } from "@/hooks/use-library";
import { availableKinds, filterItems, itemsForView, sortItems } from "@/lib/library";

function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  );
}

const HOME_BUTTON = (
  <Button asChild variant="ghost">
    <Link to="/">Laman Utama</Link>
  </Button>
);

/**
 * One view for all four library routes (spec §8.3.4):
 * `mode` = home (/) | speaker (/penceramah/:id) | collection (/koleksi/:id) | search (/cari?q=).
 * Remounts per route target (see LibraryView) so filters and sort start fresh in each view.
 */
function LibraryViewInner({ mode, id }) {
  const [params] = useSearchParams();
  const query = (params.get("q") ?? "").trim();
  const { library, continueWatching, loaded, error, refresh } = useLibrary();

  const kinds = useMemo(() => availableKinds(mode), [mode]);
  const [tickedKinds, setTickedKinds] = useState(() => new Set(kinds));
  const [favouritesOnly, setFavouritesOnly] = useState(false);
  const [sort, setSort] = useState(mode === "collection" ? "series_asc" : "date_desc");

  const speaker = mode === "speaker" ? library.speakersById.get(id) : null;
  const collection = mode === "collection" ? library.collectionsById.get(id) : null;

  const items = useMemo(() => {
    const allowed = kinds.length > 0 ? tickedKinds : new Set(["video"]);
    const base = itemsForView(library, { mode, id, query });
    return sortItems(filterItems(base, { kinds: allowed, favouritesOnly }), sort);
  }, [library, mode, id, query, kinds, tickedKinds, favouritesOnly, sort]);

  function toggleKind(kind) {
    setTickedKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) {
        if (next.size > 1) next.delete(kind); // at least one kind stays ticked
      } else {
        next.add(kind);
      }
      return next;
    });
  }

  // Unknown/removed ids and an empty search go back to the library home.
  if (loaded && !error) {
    if ((mode === "speaker" && !speaker) || (mode === "collection" && !collection) || (mode === "search" && !query)) {
      return <Navigate to="/" replace />;
    }
  }

  const crumbs = [{ label: "Laman Utama", to: "/" }];
  if (mode === "speaker" && speaker) crumbs.push({ label: speaker.name });
  if (mode === "search") crumbs.push({ label: `Mencari “${query}”` });
  if (mode === "collection" && collection) {
    if (collection.speakerIds.length === 1) {
      crumbs.push({ label: collection.speakerNames[0], to: `/penceramah/${collection.speakerIds[0]}` });
    }
    crumbs.push({ label: collection.title });
  }

  const showContinueWatching = mode === "home" && !favouritesOnly && tickedKinds.has("video");
  const continueVideos = showContinueWatching
    ? continueWatching.map((c) => library.videosById.get(c.id)).filter(Boolean)
    : [];

  const resetKey = [mode, id, query, sort, favouritesOnly, [...tickedKinds].sort().join()].join("|");

  let content;
  if (!loaded) {
    content = <LoadingIndicator />;
  } else if (error && library.videoItems.length === 0) {
    content = (
      <EmptyState
        icon={RefreshCw}
        title="Gagal Memuatkan Ceramah"
        description="Sila semak sambungan anda dan cuba lagi."
        action={
          <Button variant="outline" onClick={refresh}>
            Cuba Lagi
          </Button>
        }
      />
    );
  } else if (items.length === 0 && mode === "search" && !favouritesOnly) {
    content = (
      <EmptyState
        icon={SearchX}
        title="Hasil Carian Tidak Dijumpai"
        description="Padam carian dan cuba semula kata kunci yang baharu atau kembali ke halaman utama."
        action={HOME_BUTTON}
      />
    );
  } else if (items.length === 0 && favouritesOnly) {
    content = (
      <EmptyState
        icon={Heart}
        title="Tiada Ceramah Kegemaran"
        description="Tandai ceramah sebagai kegemaran dan ia akan muncul di sini."
        action={mode === "home" ? null : HOME_BUTTON}
      />
    );
  } else if (items.length === 0) {
    content = (
      <EmptyState
        icon={LibraryBig}
        title="Pustaka Masih Kosong"
        description="Belum ada video ceramah yang dimuat turun."
        action={mode === "home" ? null : HOME_BUTTON}
      />
    );
  } else {
    content = <LibraryGrid items={items} resetKey={resetKey} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <LibraryBreadcrumb crumbs={crumbs} />
        <FilterSortControls
          mode={mode}
          kinds={kinds}
          tickedKinds={tickedKinds}
          onToggleKind={toggleKind}
          favouritesOnly={favouritesOnly}
          onFavouritesOnlyChange={setFavouritesOnly}
          sort={sort}
          onSortChange={setSort}
        />
      </div>
      {continueVideos.length > 0 && <ContinueWatchingRow videos={continueVideos} />}
      {content}
    </div>
  );
}

export function LibraryView({ mode }) {
  const { id: idParam } = useParams();
  const id = idParam ? Number(idParam) : null;
  return <LibraryViewInner key={`${mode}-${id ?? ""}`} mode={mode} id={id} />;
}
