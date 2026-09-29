import React from "react";
import { Link } from "react-router";
import { LibraryBig } from "lucide-react";
import { formatSpeakerNames } from "@/lib/library";

/** Koleksi Kitab card (spec §8.3.4): stacked-thumbnail look, title, speaker names. Opens /koleksi/:id. */
export function CollectionCard({ collection }) {
  return (
    <Link
      to={`/koleksi/${collection.id}`}
      className="group -mt-2 flex flex-col gap-3 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <div className="relative pt-2">
        <div aria-hidden className="absolute inset-x-3 top-0 bottom-0 rounded-lg bg-border" />
        <div aria-hidden className="absolute inset-x-1.5 top-1 bottom-0 rounded-lg bg-muted-foreground/30" />
        <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
          {collection.thumbnail_path ? (
            <img
              src={collection.thumbnail_path}
              alt=""
              loading="lazy"
              decoding="async"
              className="size-full object-cover transition-opacity group-hover:opacity-90"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground">
              <LibraryBig className="size-8" />
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="line-clamp-2 font-heading text-lg leading-snug">{collection.title}</h3>
        <p className="line-clamp-1 text-sm text-muted-foreground">
          {formatSpeakerNames(collection.speakerNames)}
        </p>
      </div>
    </Link>
  );
}
