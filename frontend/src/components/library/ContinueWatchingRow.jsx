import React from "react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { VideoCard } from "@/components/library/VideoCard";

/** "Sambung Tonton": one horizontal row of in-progress videos (spec §8.3.4). */
export function ContinueWatchingRow({ videos }) {
  if (videos.length === 0) return null;
  return (
    <section aria-labelledby="sambung-tonton" className="flex flex-col gap-3">
      <h2 id="sambung-tonton" className="font-heading text-xl">
        Sambung Tonton
      </h2>
      <ScrollArea className="w-full">
        <div className="flex gap-3 pb-4">
          {videos.map((video) => (
            <VideoCard key={video.key} video={video} className="w-64 shrink-0 sm:w-72" />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </section>
  );
}
