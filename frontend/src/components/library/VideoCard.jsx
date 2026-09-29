import React from "react";
import { Link, useLocation } from "react-router";
import { Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDuration, formatRelativeDate } from "@/lib/format";
import { TONTON_LINK_STATE, tontonTo } from "@/lib/tonton";

/** Percent watched for an in-progress video, else 0. */
export function watchedPercent(video) {
  const progress = video.user_progress;
  if (!progress || progress.is_watched || !(video.duration_seconds > 0)) return 0;
  return Math.min(100, (progress.watch_progress_seconds / video.duration_seconds) * 100);
}

/** Video card (spec §8.3.4): 16:9 thumbnail, duration Badge, watch Progress, 2-line title with Tooltip. */
export function VideoCard({ video, className }) {
  const location = useLocation();
  const percent = watchedPercent(video);
  const details = [video.speaker?.name, formatRelativeDate(video.created_at)].filter(Boolean).join(" • ");

  return (
    <Link
      to={tontonTo(location, video.id)}
      state={TONTON_LINK_STATE}
      className={`group flex flex-col gap-3 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${className ?? ""}`}
    >
      <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
        {video.thumbnail_path ? (
          <img
            src={video.thumbnail_path}
            alt=""
            loading="lazy"
            decoding="async"
            className="size-full object-cover transition-opacity group-hover:opacity-90"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <Video className="size-8" />
          </div>
        )}
        {video.duration_seconds > 0 && (
          <Badge variant="secondary" className="absolute right-2 bottom-2">
            {formatDuration(video.duration_seconds)}
          </Badge>
        )}
        {percent > 0 && (
          <Progress
            value={percent}
            aria-label="Kemajuan tontonan"
            className="absolute inset-x-0 bottom-0 h-1"
          />
        )}
      </div>
      <div className="flex flex-col gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <h3 className="line-clamp-2 font-heading text-lg leading-snug">{video.title}</h3>
          </TooltipTrigger>
          <TooltipContent className="max-w-sm">{video.title}</TooltipContent>
        </Tooltip>
        {video.collection && (
          <p className="line-clamp-1 text-sm text-muted-foreground">{video.collection.title}</p>
        )}
        {details && <p className="text-sm text-muted-foreground">{details}</p>}
      </div>
    </Link>
  );
}
