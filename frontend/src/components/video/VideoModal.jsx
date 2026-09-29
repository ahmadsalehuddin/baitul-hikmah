import React, { useEffect, useRef, useState } from "react";
import { User, BookOpen, Youtube, Clock, Check, Heart } from "lucide-react";
import { Dialog, DialogContent } from "../ui/dialog";
import { VideoPlayer } from "./VideoPlayer";
import { saveVideoProgress, toggleFavoriteVideo } from "../../lib/api";

export function VideoModal({ video, open, onClose }) {
  const playerRef = useRef(null);
  const [isWatched, setIsWatched] = useState(Boolean(video?.user_progress?.is_watched));
  const [isFavorite, setIsFavorite] = useState(Boolean(video?.user_progress?.is_favorite));
  const [watchedBusy, setWatchedBusy] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);

  useEffect(() => {
    setIsWatched(Boolean(video?.user_progress?.is_watched));
    setIsFavorite(Boolean(video?.user_progress?.is_favorite));
  }, [video?.id]);

  function handleClose() {
    playerRef.current?.pause();
    playerRef.current?.flush();
    onClose();
  }

  async function handleToggleWatched() {
    if (!video || watchedBusy) return;
    const next = !isWatched;
    setWatchedBusy(true);
    setIsWatched(next);
    try {
      await saveVideoProgress(video.id, {
        watch_progress_seconds: next ? video.duration_seconds || 0 : 0,
        is_watched: next,
      });
    } catch (err) {
      console.error(err);
      setIsWatched(!next);
    } finally {
      setWatchedBusy(false);
    }
  }

  async function handleToggleFavorite() {
    if (!video || favoriteBusy) return;
    const previous = isFavorite;
    setFavoriteBusy(true);
    setIsFavorite(!previous);
    try {
      const result = await toggleFavoriteVideo(video.id);
      setIsFavorite(Boolean(result.is_favorite));
    } catch (err) {
      console.error(err);
      setIsFavorite(previous);
    } finally {
      setFavoriteBusy(false);
    }
  }

  if (!video) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose();
      }}
    >
      <DialogContent className="max-w-4xl w-full p-0 overflow-hidden bg-white rounded-2xl border border-border">
        <VideoPlayer
          ref={playerRef}
          video={video}
          initialProgress={video.user_progress?.watch_progress_seconds || 0}
          initialWatched={video.user_progress?.is_watched || false}
          onWatchedChange={setIsWatched}
        />

        <div className="p-6 max-h-[45vh] overflow-y-auto">
          <h2 className="font-heading font-bold text-xl sm:text-2xl text-foreground leading-snug">
            {video.title}
          </h2>

          <div className="flex flex-wrap items-center gap-2 mt-3">
            {video.speaker && (
              <span className="flex items-center gap-1.5 px-3 py-1 bg-brand-sage/50 text-brand-forest rounded-full text-xs font-semibold">
                <User className="w-3.5 h-3.5" />
                {video.speaker.name}
              </span>
            )}
            {video.collection && (
              <span className="flex items-center gap-1.5 px-3 py-1 bg-muted text-foreground rounded-full text-xs font-semibold">
                <BookOpen className="w-3.5 h-3.5" />
                {video.collection.title}
              </span>
            )}
            {video.channel_name && (
              <span className="flex items-center gap-1.5 px-3 py-1 bg-muted text-muted-foreground rounded-full text-xs font-medium">
                <Youtube className="w-3.5 h-3.5" />
                {video.channel_name}
              </span>
            )}
            {video.duration_seconds > 0 && (
              <span className="flex items-center gap-1.5 px-3 py-1 bg-muted text-muted-foreground rounded-full text-xs font-medium">
                <Clock className="w-3.5 h-3.5" />
                {Math.round(video.duration_seconds / 60)} minit
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-5">
            <button
              type="button"
              onClick={handleToggleWatched}
              disabled={watchedBusy}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold border transition-colors disabled:opacity-60 ${
                isWatched
                  ? "bg-brand-emerald text-white border-brand-emerald"
                  : "bg-white text-foreground border-border hover:bg-muted"
              }`}
            >
              <Check className="w-4 h-4" />
              Tandai Telah Ditonton
            </button>
            <button
              type="button"
              onClick={handleToggleFavorite}
              disabled={favoriteBusy}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold border transition-colors disabled:opacity-60 ${
                isFavorite
                  ? "bg-brand-gold text-white border-brand-gold"
                  : "bg-white text-foreground border-border hover:bg-muted"
              }`}
            >
              <Heart className={`w-4 h-4 ${isFavorite ? "fill-current" : ""}`} />
              Kegemaran
            </button>
          </div>

          <div className="mt-5 pt-5 border-t border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Penerangan
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
              {video.description || "Tiada penerangan tambahan untuk ceramah ini."}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
