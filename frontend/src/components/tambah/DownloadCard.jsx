import React from "react";
import { Clock, HardDrive, Pencil, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDurationLong, formatFileSize } from "@/lib/format";

function formatEta(seconds) {
  if (!seconds && seconds !== 0) return "";
  if (seconds < 60) return `${seconds}s lagi`;
  return `${Math.floor(seconds / 60)}m lagi`;
}

function statusText(video) {
  if (video.status === "completed") return "Muat naik selesai.";
  if (video.status === "downloading") {
    const eta = video.eta_seconds ? ` • ${formatEta(video.eta_seconds)}` : "";
    return `${video.download_speed || "Memuat turun"}${eta}`;
  }
  return "Dalam giliran…";
}

function Detail({ label, value }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="line-clamp-1 text-xs font-medium">{value}</span>
    </div>
  );
}

/** Upload card (spec §8.3.6): thumbnail, title, Koleksi/Penceramah, duration + size, Sunting Butiran, progress footer. */
export function DownloadCard({ video, speakerName, collectionTitle, onEdit }) {
  const percent = Math.round(video.status === "completed" ? 100 : video.progress_percent || 0);

  return (
    <Card size="sm">
      <CardContent>
        <div className="aspect-video overflow-hidden rounded-lg bg-muted">
          {video.thumbnail_path ? (
            <img src={video.thumbnail_path} alt="" className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground">
              <Video className="size-8" />
            </div>
          )}
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <h3 className="truncate font-heading text-base">{video.title}</h3>
          </TooltipTrigger>
          <TooltipContent className="max-w-sm">{video.title}</TooltipContent>
        </Tooltip>

        <div className="flex flex-col gap-2">
          <Detail label="Koleksi Kitab" value={collectionTitle ?? "Belum ditentukan"} />
          <Detail label="Penceramah" value={speakerName ?? "Belum ditentukan"} />
        </div>

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Clock className="size-4" />
            {formatDurationLong(video.duration_seconds)}
          </span>
          <span className="flex items-center gap-1.5">
            <HardDrive className="size-4" />
            {formatFileSize(video.file_size_bytes)}
          </span>
        </div>

        {video.status === "completed" && (
          <Button variant="secondary" onClick={() => onEdit(video)}>
            <Pencil data-icon="inline-start" />
            Sunting Butiran
          </Button>
        )}
      </CardContent>

      <CardFooter className="flex-col items-stretch gap-2 border-t">
        <div className="flex items-center gap-3">
          <Progress value={percent} aria-label="Kemajuan muat naik" />
          <span className="text-xs text-muted-foreground">{percent}%</span>
        </div>
        <span className="text-xs text-muted-foreground">{statusText(video)}</span>
      </CardFooter>
    </Card>
  );
}
