import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import videojs from "video.js";
import "video.js/dist/video-js.css";
import { saveVideoProgress } from "@/lib/api";

export const SKIP_SECONDS = 10;
export const SPEEDS = [1, 1.25, 1.5];
const HEARTBEAT_INTERVAL_MS = 5000;
const RESUME_MIN_SECONDS = 5;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function sourceFor(videoId, mode) {
  return mode === "audio"
    ? { src: `/api/stream/${videoId}?mode=audio`, type: "audio/mp4" }
    : { src: `/api/stream/${videoId}?mode=video`, type: "video/mp4" };
}

/**
 * Video.js as a playback engine only (spec §8.3.5, O4): `controls: false` and every built-in
 * UI component switched off — the shadcn controls render all UI from the returned state.
 *
 * - `enabled`: create the player (wait until the resume position is known).
 * - `resumeAt`: seconds to resume from (ignored below 5 s); playback starts once it is applied.
 * - `mode`: "video" | "audio". Changing it swaps the source on the SAME player, keeping the
 *   position and play/pause state (seamless Video↔Audio switch, spec §4.3).
 * - Progress: 5 s heartbeat while playing, plus a save on pause, on unmount and when the page
 *   is hidden; `ended` marks the video watched (`onWatched`).
 */
export function useVideoEngine({ enabled, videoId, durationHint = 0, resumeAt = 0, mode, onWatched }) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const timeRef = useRef(resumeAt);
  const durationRef = useRef(durationHint);
  const pendingSeekRef = useRef(null);
  const shouldPlayRef = useRef(true);
  const speedRef = useRef(1);
  const lastSentRef = useRef(-1);
  const modeRef = useRef(mode);
  const onWatchedRef = useRef(onWatched);
  onWatchedRef.current = onWatched;
  modeRef.current = mode;

  const [state, setState] = useState({
    playing: false,
    buffering: true,
    error: false,
    currentTime: resumeAt,
    duration: durationHint,
    speed: 1,
    volume: 1,
    muted: false,
  });
  const patch = useCallback((changes) => setState((prev) => ({ ...prev, ...changes })), []);

  const flush = useCallback(
    ({ watched = false, keepalive = false } = {}) => {
      const seconds = Math.floor(timeRef.current || 0);
      if (!watched && seconds === lastSentRef.current) return Promise.resolve();
      lastSentRef.current = seconds;
      const duration = Math.floor(durationRef.current || 0);
      return saveVideoProgress(
        videoId,
        {
          watch_progress_seconds: seconds,
          duration_seconds: duration || undefined,
          is_watched: watched || undefined,
        },
        { keepalive }
      )
        .then(() => {
          if (watched) onWatchedRef.current?.(true);
        })
        .catch(() => {});
    },
    [videoId]
  );

  // Create the engine. Video.js owns the <video> element it builds inside our container div,
  // so React never sees nodes Video.js removes (safe under StrictMode's double mount).
  useEffect(() => {
    const container = containerRef.current;
    if (!enabled || !container) return undefined;

    // The saved position is known by the time the engine is enabled; apply it once metadata loads.
    timeRef.current = resumeAt;
    pendingSeekRef.current = resumeAt > RESUME_MIN_SECONDS ? resumeAt : null;
    shouldPlayRef.current = true;
    patch({ currentTime: resumeAt });

    const element = document.createElement("video");
    element.className = "video-js"; // Video.js' stylesheet keys its layout (fill/tech sizing) off this class
    element.setAttribute("playsinline", "");
    container.appendChild(element);

    const player = videojs(element, {
      controls: false,
      fill: true,
      preload: "auto",
      playsinline: true,
      bigPlayButton: false,
      controlBar: false,
      errorDisplay: false,
      loadingSpinner: false,
      textTrackDisplay: false,
      posterImage: false,
      textTrackSettings: false,
      userActions: { click: false, doubleClick: false, hotkeys: false },
    });
    playerRef.current = player;

    player.on("loadstart", () => patch({ buffering: true }));
    player.on("loadedmetadata", () => {
      const duration = player.duration();
      if (Number.isFinite(duration) && duration > 0) {
        durationRef.current = duration;
        patch({ duration });
      }
      player.defaultPlaybackRate(speedRef.current);
      player.playbackRate(speedRef.current);
      if (pendingSeekRef.current !== null) {
        player.currentTime(pendingSeekRef.current);
        pendingSeekRef.current = null;
      }
      if (shouldPlayRef.current) {
        // Browsers may refuse autoplay without a user gesture (e.g. a refreshed ?tonton link): stay paused then.
        player.play()?.catch(() => {});
      }
    });
    player.on("durationchange", () => {
      const duration = player.duration();
      if (Number.isFinite(duration) && duration > 0) {
        durationRef.current = duration;
        patch({ duration });
      }
    });
    player.on("play", () => patch({ playing: true }));
    player.on("pause", () => {
      patch({ playing: false });
      flush();
    });
    player.on("ended", () => {
      patch({ playing: false });
      flush({ watched: true });
    });
    player.on("timeupdate", () => {
      const time = player.currentTime();
      timeRef.current = time;
      patch({ currentTime: time });
    });
    player.on("waiting", () => patch({ buffering: true }));
    player.on("seeking", () => patch({ buffering: true }));
    ["canplay", "playing", "seeked"].forEach((event) => player.on(event, () => patch({ buffering: false })));
    player.on("error", () => patch({ error: true, buffering: false, playing: false }));
    player.on("volumechange", () => patch({ volume: player.volume(), muted: player.muted() }));
    player.on("ratechange", () => patch({ speed: player.playbackRate() }));

    player.src(sourceFor(videoId, modeRef.current));

    return () => {
      flush({ keepalive: true });
      player.dispose();
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, videoId]);

  // Seamless Video↔Audio: same player, new source, same position and play state.
  const firstModeRef = useRef(true);
  useEffect(() => {
    if (firstModeRef.current) {
      firstModeRef.current = false;
      return;
    }
    const player = playerRef.current;
    if (!player) return;
    pendingSeekRef.current = player.currentTime() || timeRef.current;
    shouldPlayRef.current = !player.paused();
    patch({ buffering: true, error: false });
    player.src(sourceFor(videoId, mode));
  }, [mode, videoId, patch]);

  // 5-second heartbeat while playing.
  useEffect(() => {
    if (!state.playing) return undefined;
    const timer = setInterval(() => flush(), HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [state.playing, flush]);

  // Last-chance save when the tab is hidden or closed.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flush({ keepalive: true });
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
    };
  }, [flush]);

  const play = useCallback(() => playerRef.current?.play()?.catch(() => {}), []);
  const pause = useCallback(() => playerRef.current?.pause(), []);
  const togglePlay = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    if (player.paused()) player.play()?.catch(() => {});
    else player.pause();
  }, []);
  const seek = useCallback(
    (seconds) => {
      const player = playerRef.current;
      if (!player) return;
      const max = player.duration() || durationRef.current || seconds;
      const next = clamp(seconds, 0, max);
      player.currentTime(next);
      timeRef.current = next;
      patch({ currentTime: next });
    },
    [patch]
  );
  const skip = useCallback(
    (delta) => {
      const player = playerRef.current;
      if (!player) return;
      const max = player.duration() || durationRef.current || Infinity;
      const next = clamp(player.currentTime() + delta, 0, max);
      player.currentTime(next);
      timeRef.current = next;
      patch({ currentTime: next });
    },
    [patch]
  );
  const setSpeed = useCallback((rate) => {
    speedRef.current = rate;
    const player = playerRef.current;
    player?.defaultPlaybackRate(rate);
    player?.playbackRate(rate);
  }, []);
  const setVolume = useCallback((volume) => {
    const player = playerRef.current;
    if (!player) return;
    player.volume(volume);
    player.muted(volume === 0);
  }, []);
  const toggleMute = useCallback(() => {
    const player = playerRef.current;
    if (player) player.muted(!player.muted());
  }, []);
  const retry = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    pendingSeekRef.current = timeRef.current;
    shouldPlayRef.current = true;
    patch({ error: false, buffering: true });
    player.src(sourceFor(videoId, modeRef.current));
  }, [videoId, patch]);
  /** The underlying <video> element (iPhone fullscreen fallback). */
  const getMediaElement = useCallback(() => playerRef.current?.tech(true)?.el() ?? null, []);

  const controls = useMemo(
    () => ({ play, pause, togglePlay, seek, skip, setSpeed, setVolume, toggleMute, retry, getMediaElement }),
    [play, pause, togglePlay, seek, skip, setSpeed, setVolume, toggleMute, retry, getMediaElement]
  );

  return { containerRef, state, controls, flush };
}
