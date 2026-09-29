import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { CircleCheck, CirclePlay, Circle, Clock, Headphones, Heart, LibraryBig, User, Video, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { AudioNowPlaying } from "@/components/player/AudioNowPlaying";
import { PlayerStage } from "@/components/player/PlayerStage";
import { useFullscreen } from "@/hooks/use-fullscreen";
import { useMediaSession } from "@/hooks/use-media-session";
import { SKIP_SECONDS, useVideoEngine } from "@/hooks/use-video-engine";
import { fetchVideo, getVideoProgress, saveVideoProgress, toggleFavoriteVideo } from "@/lib/api";
import { formatDuration, formatRelativeDate } from "@/lib/format";

/** True when a key press is meant for a focused control rather than for the player shortcuts. */
function isEditable(target) {
  return target instanceof Element && (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable);
}

function PlayerBody({ video, saveRef, onWatchedChange }) {
  const [mode, setMode] = useState("video");
  const [resume, setResume] = useState(null); // { seconds, watched, favourite } once the saved progress is known
  const [details, setDetails] = useState(null); // raw Video record: channel_name (the list items lack it)
  const [isWatched, setIsWatched] = useState(Boolean(video.user_progress?.is_watched));
  const [isFavourite, setIsFavourite] = useState(Boolean(video.user_progress?.is_favorite));
  const [watchedBusy, setWatchedBusy] = useState(false);
  const [favouriteBusy, setFavouriteBusy] = useState(false);

  // Resume from the freshest saved position (not the list, which may be stale). If the request
  // fails we fall back to the list data so playback still starts.
  useEffect(() => {
    let cancelled = false;
    getVideoProgress(video.id)
      .then((p) => {
        if (cancelled) return;
        setResume({ seconds: p.watch_progress_seconds || 0, watched: Boolean(p.is_watched) });
        setIsWatched(Boolean(p.is_watched));
        setIsFavourite(Boolean(p.is_favorite));
      })
      .catch(() => {
        if (cancelled) return;
        const p = video.user_progress;
        setResume({ seconds: p?.watch_progress_seconds || 0, watched: Boolean(p?.is_watched) });
      });
    fetchVideo(video.id)
      .then((v) => !cancelled && setDetails(v))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [video.id]);

  const engine = useVideoEngine({
    enabled: resume !== null,
    videoId: video.id,
    durationHint: video.duration_seconds || 0,
    resumeAt: resume && !resume.watched ? resume.seconds : 0,
    mode,
    onWatched: (watched) => {
      setIsWatched(watched);
      onWatchedChange?.(watched);
    },
  });
  const { controls, flush } = engine;
  // Lets the dialog save the position when it is closed (before the library is refreshed).
  saveRef.current = () => flush({ keepalive: true });
  const fullscreen = useFullscreen(controls.getMediaElement);
  useMediaSession(video, engine);

  async function handleToggleWatched(next) {
    if (watchedBusy) return;
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

  async function handleToggleFavourite() {
    if (favouriteBusy) return;
    const previous = isFavourite;
    setFavouriteBusy(true);
    setIsFavourite(!previous);
    try {
      const result = await toggleFavoriteVideo(video.id);
      setIsFavourite(Boolean(result.is_favorite));
    } catch (err) {
      console.error(err);
      setIsFavourite(previous);
    } finally {
      setFavouriteBusy(false);
    }
  }

  // Shortcuts (spec §8.3.5): Space/K play-pause, ←/→ ±10 s, F fullscreen, M mute.
  // Listening on the document (the dialog is modal, so focus is always inside it) and leaving alone
  // keys that a focused button/slider/radio already handles natively.
  const handleKeyDownRef = useRef(null);
  handleKeyDownRef.current = (event) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || isEditable(event.target)) return;
    const target = event.target instanceof Element ? event.target : null;
    const onNativeControl = Boolean(target?.closest('button, a, [role="slider"], [role="radio"]'));
    const inSliderOrRadio = Boolean(target?.closest('[role="slider"], [role="radio"]'));

    switch (event.key) {
      case " ":
        if (onNativeControl) return;
        event.preventDefault();
        controls.togglePlay();
        break;
      case "k":
      case "K":
        controls.togglePlay();
        break;
      case "ArrowLeft":
      case "ArrowRight":
        if (inSliderOrRadio) return;
        event.preventDefault();
        controls.skip(event.key === "ArrowLeft" ? -SKIP_SECONDS : SKIP_SECONDS);
        break;
      case "f":
      case "F":
        if (mode !== "video" || !fullscreen.canFullscreen) return;
        fullscreen.toggleFullscreen();
        break;
      case "m":
      case "M":
        controls.toggleMute();
        break;
      default:
    }
  };
  useEffect(() => {
    const listener = (event) => handleKeyDownRef.current?.(event);
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, []);

  const channel = details?.channel_name;
  const description = details?.description || video.description;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PlayerStage mode={mode} engine={engine} fullscreen={fullscreen} />
      {mode === "audio" && (
        <div className="p-3 sm:p-4">
          <AudioNowPlaying video={video} engine={engine} />
        </div>
      )}

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-4 p-4 sm:p-6">
          <DialogTitle asChild>
            <h2 className="font-heading text-2xl leading-snug">{video.title}</h2>
          </DialogTitle>
          <DialogDescription className="sr-only">Pemain ceramah</DialogDescription>

          <div className="flex flex-wrap items-center gap-2">
            {video.speaker && (
              <Badge asChild variant="secondary">
                <Link to={`/penceramah/${video.speaker.id}`}>
                  <User />
                  {video.speaker.name}
                </Link>
              </Badge>
            )}
            {video.collection && (
              <Badge asChild variant="outline">
                <Link to={`/koleksi/${video.collection.id}`}>
                  <LibraryBig />
                  {video.collection.title}
                </Link>
              </Badge>
            )}
            {channel && (
              <Badge variant="outline">
                <CirclePlay />
                {channel}
              </Badge>
            )}
            {video.duration_seconds > 0 && (
              <Badge variant="outline">
                <Clock />
                {formatDuration(video.duration_seconds)}
              </Badge>
            )}
            <span className="text-sm text-muted-foreground">Ditambah {formatRelativeDate(video.created_at).toLowerCase()}</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <ToggleGroup
              type="single"
              variant="outline"
              spacing={0}
              value={mode}
              aria-label="Mod main"
              onValueChange={(value) => value && setMode(value)}
            >
              <ToggleGroupItem value="video">
                <Video />
                Video
              </ToggleGroupItem>
              <ToggleGroupItem value="audio">
                <Headphones />
                Audio
              </ToggleGroupItem>
            </ToggleGroup>
            <Toggle variant="outline" pressed={isWatched} disabled={watchedBusy} onPressedChange={handleToggleWatched}>
              {isWatched ? <CircleCheck /> : <Circle />}
              Tandai Telah Ditonton
            </Toggle>
            <Toggle variant="outline" pressed={isFavourite} disabled={favouriteBusy} onPressedChange={handleToggleFavourite}>
              <Heart className="group-aria-pressed/toggle:fill-current" />
              Kegemaran
            </Toggle>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-sm text-muted-foreground">Penerangan</h3>
            <p className="whitespace-pre-line leading-relaxed">
              {description || "Tiada penerangan tambahan untuk ceramah ini."}
            </p>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

/**
 * The player dialog (spec §8.3.5): wide on tablets/desktops, full-screen on phones.
 * `onRequestClose` asks the owner to close it (X/Esc/overlay); `onClosed(savePromise)` fires after any close.
 */
export function PlayerDialog({ video, open, onRequestClose, onClosed, onWatchedChange }) {
  const saveRef = useRef(null);

  // Whatever closes the dialog (X, Esc, overlay, browser Back), save the position once and tell the
  // caller when that is done so it can refresh progress. PlayerBody is still mounted during the exit animation.
  const wasOpen = useRef(open);
  useEffect(() => {
    if (wasOpen.current && !open) onClosed?.(saveRef.current?.());
    wasOpen.current = open;
  }, [open, onClosed]);

  if (!video) return null;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onRequestClose()}>
      <DialogContent
        showCloseButton={false}
        // Focus the dialog itself (not the Close button) so Space/K reach the player shortcuts.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          event.currentTarget.focus();
        }}
        className="flex h-dvh max-h-dvh w-full max-w-none flex-col gap-0 overflow-hidden p-0 sm:h-11/12 sm:w-11/12 sm:max-w-4xl"
      >
        <DialogClose asChild>
          <Button variant="secondary" size="icon" className="absolute top-3 right-3 z-10" aria-label="Tutup">
            <X />
          </Button>
        </DialogClose>
        {/* key: a different video gets a fresh engine, resume lookup and toggles. */}
        <PlayerBody key={video.id} video={video} saveRef={saveRef} onWatchedChange={onWatchedChange} />
      </DialogContent>
    </Dialog>
  );
}
