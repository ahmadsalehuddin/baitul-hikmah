import React from "react";
import { Link } from "react-router";
import { User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

/** Penceramah card (spec §8.3.4): Avatar on a muted thumbnail area, name, counts. Opens /penceramah/:id. */
export function SpeakerCard({ speaker }) {
  const counts =
    speaker.collectionCount > 0
      ? `${speaker.videoCount} ceramah dan ${speaker.collectionCount} koleksi kitab`
      : `${speaker.videoCount} ceramah`;

  return (
    <Link
      to={`/penceramah/${speaker.id}`}
      className="group flex flex-col gap-3 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <div className="flex aspect-video items-center justify-center rounded-lg bg-border transition-opacity group-hover:opacity-90">
        <Avatar className="size-16">
          {speaker.avatar_url && <AvatarImage src={speaker.avatar_url} alt="" />}
          <AvatarFallback>
            <User className="size-8" />
          </AvatarFallback>
        </Avatar>
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="line-clamp-2 font-heading text-lg leading-snug">{speaker.name}</h3>
        <p className="text-sm text-muted-foreground">{counts}</p>
      </div>
    </Link>
  );
}
