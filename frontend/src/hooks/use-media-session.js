import { useEffect } from "react";
import { SKIP_SECONDS } from "@/hooks/use-video-engine";

/**
 * Lock-screen / car-Bluetooth controls (spec §4.3): title, speaker as artist, collection as album,
 * speaker avatar (else the thumbnail) as artwork, plus play/pause/±10 s/seek handlers.
 */
export function useMediaSession(video, engine) {
  const { state, controls } = engine;
  const artwork = video.speaker?.avatar_url || video.thumbnail_path;

  useEffect(() => {
    if (!("mediaSession" in navigator)) return undefined;
    navigator.mediaSession.metadata = new window.MediaMetadata({
      title: video.title,
      artist: video.speaker?.name || "Baitul Hikmah",
      album: video.collection?.title || "Baitul Hikmah",
      artwork: artwork ? [{ src: artwork, type: "image/webp" }] : [],
    });
    return () => {
      navigator.mediaSession.metadata = null;
    };
  }, [video.title, video.speaker?.name, video.collection?.title, artwork]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return undefined;
    const handlers = {
      play: () => controls.play(),
      pause: () => controls.pause(),
      seekbackward: () => controls.skip(-SKIP_SECONDS),
      seekforward: () => controls.skip(SKIP_SECONDS),
      seekto: (details) => {
        if (typeof details.seekTime === "number") controls.seek(details.seekTime);
      },
    };
    for (const [action, handler] of Object.entries(handlers)) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // Action not supported by this browser.
      }
    }
    return () => {
      for (const action of Object.keys(handlers)) {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch {
          // ignore
        }
      }
    };
  }, [controls]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = state.playing ? "playing" : "paused";
  }, [state.playing]);

  const whole = Math.floor(state.currentTime);
  useEffect(() => {
    if (!("mediaSession" in navigator) || !navigator.mediaSession.setPositionState) return;
    if (!Number.isFinite(state.duration) || state.duration <= 0) return;
    try {
      navigator.mediaSession.setPositionState({
        duration: state.duration,
        position: Math.min(whole, state.duration),
        playbackRate: state.speed || 1,
      });
    } catch {
      // Invalid position state — ignore.
    }
  }, [whole, state.duration, state.speed]);
}
