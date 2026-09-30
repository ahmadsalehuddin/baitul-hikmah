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

/** One-line text that truncates with an ellipsis and shows the full text in a Tooltip. */
function TruncatedText({ text }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="min-w-0 truncate">{text}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-sm">{text}</TooltipContent>
    </Tooltip>
  );
}

/** Video card (spec §8.3.4): 16:9 thumbnail, duration Badge, watch Progress, 2-line title with Tooltip, then Penceramah, then "Ditambah oleh …" • date (§8.6). */
export function VideoCard({ video, className }) {
  const location = useLocation();
  const percent = watchedPercent(video);
  const speakerName = video.speaker?.name;
  const adderName = video.added_by?.display_name;
  const date = formatRelativeDate(video.created_at);

  return (
    <Link
      to={tontonTo(location, video.id)}
      state={TONTON_LINK_STATE}
      className={`group flex flex-col gap-3 rounded-lg outline-none transition-transform duration-200 ease-out motion-safe:hover:-translate-y-1 focus-visible:ring-3 focus-visible:ring-ring/50 ${className ?? ""}`}
    >
      <div className="relative aspect-video overflow-hidden rounded-lg bg-muted transition-shadow duration-200 group-hover:shadow-md">
        {video.thumbnail_path ? (
          <img
            src={video.thumbnail_path}
            alt=""
            loading="lazy"
            decoding="async"
            className="size-full object-cover transition-transform duration-300 ease-out motion-safe:group-hover:scale-105"
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
        {speakerName && (
          <p className="flex text-sm text-muted-foreground">
            <TruncatedText text={speakerName} />
          </p>
        )}
        {(adderName || date) && (
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            {adderName && <TruncatedText text={`Ditambah oleh ${adderName}`} />}
            {adderName && date && <span className="shrink-0">•</span>}
            {date && <span className="shrink-0 whitespace-nowrap">{date}</span>}
          </p>
        )}
      </div>
    </Link>
  );
}
