import React from "react";
import { Spinner } from "@/components/ui/spinner";
import { useProgressiveList } from "@/hooks/use-progressive-list";
import { CollectionCard } from "@/components/library/CollectionCard";
import { SpeakerCard } from "@/components/library/SpeakerCard";
import { VideoCard } from "@/components/library/VideoCard";

export function LoadingIndicator() {
  return (
    <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
      <Spinner aria-label="Memuatkan" />
      Memuatkan ceramah
    </div>
  );
}

/** Mixed grid of video / Koleksi Kitab / Penceramah cards, revealed in batches on scroll. */
export function LibraryGrid({ items, resetKey }) {
  const { visible, hasMore, sentinelRef } = useProgressiveList(items, resetKey);

  return (
    <>
      <div className="grid grid-cols-1 gap-x-3 gap-y-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visible.map((item) => {
          if (item.kind === "collection") return <CollectionCard key={item.key} collection={item} />;
          if (item.kind === "speaker") return <SpeakerCard key={item.key} speaker={item} />;
          return <VideoCard key={item.key} video={item} />;
        })}
      </div>
      {hasMore && (
        <div ref={sentinelRef}>
          <LoadingIndicator />
        </div>
      )}
    </>
  );
}
