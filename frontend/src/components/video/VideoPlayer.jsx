import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import videojs from "video.js";
import "video.js/dist/video-js.css";
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Video as VideoIcon,
  Headphones,
  BookOpen,
} from "lucide-react";
import { saveVideoProgress } from "../../lib/api";

const SPEED_OPTIONS = [1, 1.25, 1.5];
const HEARTBEAT_INTERVAL_MS = 5000;
const SKIP_SECONDS = 10;

function formatTime(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "00:00";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  const ss = String(s).padStart(2, "0");
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${ss}`;
  return `${m}:${ss}`;
}

export const VideoPlayer = React.forwardRef(function VideoPlayer(
  { video, initialProgress = 0, initialWatched = false, onWatchedChange },
  ref
) {
  const videoNodeRef = useRef(null);
  const playerRef = useRef(null);
  const currentTimeRef = useRef(initialProgress);
  const durationRef = useRef(video.duration_seconds || 0);
  const lastSentSecondsRef = useRef(-1);
  const seekedInitialRef = useRef(false);
  const isFirstModeRenderRef = useRef(true);

  const [mode, setMode] = useState("video");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(initialProgress);
  const [duration, setDuration] = useState(video.duration_seconds || 0);
  const [speed, setSpeed] = useState(1);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);

  const flushProgress = useCallback(
    (isWatched) => {
      const t = Math.floor(currentTimeRef.current || 0);
      const d = Math.floor(durationRef.current || 0);
      if (!isWatched && t === lastSentSecondsRef.current) return;
      lastSentSecondsRef.current = t;
      saveVideoProgress(video.id, {
        watch_progress_seconds: t,
        duration_seconds: d || undefined,
        is_watched: isWatched || undefined,
      })
        .then(() => {
          if (isWatched) onWatchedChange?.(true);
        })
        .catch(() => {});
    },
    [video.id, onWatchedChange]
  );

  useImperativeHandle(
    ref,
    () => ({
      pause: () => playerRef.current?.pause(),
      flush: () => flushProgress(false),
    }),
    [flushProgress]
  );

  // Initialize the Video.js player once per video.
  useEffect(() => {
    if (!videoNodeRef.current) return undefined;

    const player = videojs(videoNodeRef.current, {
      controls: false,
      autoplay: true,
      preload: "auto",
      playsinline: true,
      responsive: true,
      sources: [{ src: `/api/stream/${video.id}?mode=video`, type: "video/mp4" }],
    });
    playerRef.current = player;

    player.on("loadedmetadata", () => {
      const d = player.duration();
      if (Number.isFinite(d) && d > 0) {
        durationRef.current = d;
        setDuration(d);
      }
      if (!seekedInitialRef.current && initialProgress > 5 && !initialWatched) {
        player.currentTime(initialProgress);
        seekedInitialRef.current = true;
      }
    });

    player.on("play", () => setIsPlaying(true));
    player.on("pause", () => setIsPlaying(false));
    player.on("timeupdate", () => {
      const t = player.currentTime();
      currentTimeRef.current = t;
      setCurrentTime(t);
    });
    player.on("ended", () => {
      setIsPlaying(false);
      flushProgress(true);
    });

    return () => {
      flushProgress(false);
      player.dispose();
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.id]);

  // Throttled 5-second progress heartbeat while playing.
  useEffect(() => {
    const interval = setInterval(() => {
      const player = playerRef.current;
      if (player && !player.paused()) {
        flushProgress(false);
      }
    }, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [flushProgress]);

  // Switch between video and audio-only sources, preserving playback position.
  useEffect(() => {
    if (isFirstModeRenderRef.current) {
      isFirstModeRenderRef.current = false;
      return;
    }
    const player = playerRef.current;
    if (!player) return;

    const resumeAt = player.currentTime() || currentTimeRef.current || 0;
    const wasPlaying = !player.paused();

    const source =
      mode === "audio"
        ? { src: `/api/stream/${video.id}?mode=audio`, type: "audio/mp4" }
        : { src: `/api/stream/${video.id}?mode=video`, type: "video/mp4" };

    player.src(source);
    player.one("loadedmetadata", () => {
      player.currentTime(resumeAt);
      if (wasPlaying) player.play().catch(() => {});
    });
  }, [mode, video.id]);

  // Lock-screen / Bluetooth media controls.
  useEffect(() => {
    if (!("mediaSession" in navigator)) return undefined;

    navigator.mediaSession.metadata = new window.MediaMetadata({
      title: video.title,
      artist: video.speaker?.name || video.channel_name || "Baitul Hikmah",
      album: video.collection?.title || "Baitul Hikmah",
      artwork: video.thumbnail_path
        ? [{ src: video.thumbnail_path, sizes: "512x512", type: "image/webp" }]
        : [],
    });

    navigator.mediaSession.setActionHandler("play", () => playerRef.current?.play());
    navigator.mediaSession.setActionHandler("pause", () => playerRef.current?.pause());
    navigator.mediaSession.setActionHandler("seekbackward", () => skip(-SKIP_SECONDS));
    navigator.mediaSession.setActionHandler("seekforward", () => skip(SKIP_SECONDS));

    return () => {
      ["play", "pause", "seekbackward", "seekforward"].forEach((action) => {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch {
          // Action not supported by this browser - ignore.
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.title, video.speaker, video.collection, video.channel_name, video.thumbnail_path]);

  function togglePlay() {
    const player = playerRef.current;
    if (!player) return;
    if (player.paused()) player.play().catch(() => {});
    else player.pause();
  }

  function skip(delta) {
    const player = playerRef.current;
    if (!player) return;
    const max = player.duration() || durationRef.current || 0;
    const next = Math.max(0, Math.min(max, player.currentTime() + delta));
    player.currentTime(next);
  }

  function changeSpeed(rate) {
    setSpeed(rate);
    playerRef.current?.playbackRate(rate);
  }

  function changeVolume(v) {
    setVolume(v);
    playerRef.current?.volume(v);
    setMuted(v === 0);
    if (v > 0) playerRef.current?.muted(false);
  }

  function toggleMute() {
    const player = playerRef.current;
    if (!player) return;
    const next = !muted;
    player.muted(next);
    setMuted(next);
  }

  function handleSeek(value) {
    playerRef.current?.currentTime(value);
    currentTimeRef.current = value;
    setCurrentTime(value);
  }

  function modeButtonClass(active) {
    return `flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
      active ? "bg-brand-gold text-white" : "text-white/80 hover:text-white"
    }`;
  }

  return (
    <div className="w-full bg-neutral-950">
      <div className="relative w-full aspect-video overflow-hidden bg-black">
        <div data-vjs-player className={mode === "audio" ? "hidden" : "h-full w-full"}>
          <video ref={videoNodeRef} className="video-js h-full w-full" playsInline />
        </div>

        {mode === "audio" && (
          <div className="absolute inset-0 flex items-center justify-center bg-linear-to-br from-brand-emerald via-[#0a3d2f] to-black">
            <div
              className="absolute inset-0 opacity-[0.08] bg-repeat"
              style={{ backgroundImage: "url('/background-pattern.svg')", backgroundSize: "300px" }}
            />
            <div className="relative z-10 flex flex-col items-center gap-4 px-6 text-center">
              <div className="w-36 h-36 sm:w-48 sm:h-48 rounded-2xl overflow-hidden border-4 border-brand-gold/70 shadow-2xl bg-white/10">
                {video.thumbnail_path ? (
                  <img
                    src={video.thumbnail_path}
                    alt={video.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <BookOpen className="w-14 h-14 text-brand-gold" />
                  </div>
                )}
              </div>
              <div>
                <p className="font-heading text-white text-base sm:text-lg font-bold line-clamp-2 max-w-sm">
                  {video.title}
                </p>
                {video.speaker && (
                  <p className="text-white/70 text-sm mt-1">{video.speaker.name}</p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="absolute top-3 right-3 z-20 flex items-center gap-1 rounded-full bg-black/50 backdrop-blur-xs p-1">
          <button type="button" onClick={() => setMode("video")} className={modeButtonClass(mode === "video")}>
            <VideoIcon className="w-3.5 h-3.5" />
            Video
          </button>
          <button type="button" onClick={() => setMode("audio")} className={modeButtonClass(mode === "audio")}>
            <Headphones className="w-3.5 h-3.5" />
            Audio
          </button>
        </div>
      </div>

      <div className="px-4 sm:px-6 py-4 flex flex-col gap-3">
        <div className="flex items-center gap-3 text-[11px] font-mono text-white/70">
          <span className="w-12 text-right">{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={1}
            value={Math.min(currentTime, duration || 0)}
            onChange={(e) => handleSeek(Number(e.target.value))}
            className="flex-1 accent-brand-gold h-1.5"
            aria-label="Kedudukan tontonan"
          />
          <span className="w-12">{formatTime(duration)}</span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => skip(-SKIP_SECONDS)}
              className="p-2 rounded-full text-white hover:bg-white/10 transition-colors"
              aria-label="Undur 10 saat"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={togglePlay}
              className="w-12 h-12 flex items-center justify-center rounded-full bg-brand-gold text-white shadow-lg hover:bg-brand-gold/90 transition-colors"
              aria-label={isPlaying ? "Jeda" : "Main"}
            >
              {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
            </button>
            <button
              type="button"
              onClick={() => skip(SKIP_SECONDS)}
              className="p-2 rounded-full text-white hover:bg-white/10 transition-colors"
              aria-label="Maju 10 saat"
            >
              <RotateCw className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-1 bg-white/10 rounded-full p-1">
            {SPEED_OPTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => changeSpeed(s)}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                  speed === s ? "bg-brand-gold text-white" : "text-white/70 hover:text-white"
                }`}
              >
                {s}x
              </button>
            ))}
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <button
              type="button"
              onClick={toggleMute}
              className="text-white p-1.5 rounded-full hover:bg-white/10 transition-colors"
              aria-label={muted ? "Nyahsenyap" : "Senyapkan"}
            >
              {muted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => changeVolume(Number(e.target.value))}
              className="w-20 accent-brand-gold h-1.5"
              aria-label="Kelantangan"
            />
          </div>
        </div>
      </div>
    </div>
  );
});
