import { useCallback, useEffect, useRef, useState } from "react";

const fullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;

/**
 * Fullscreen for the player stage (so our controls stay visible in fullscreen).
 * iPhone Safari can only fullscreen the <video> itself (system controls) — `getMediaElement`
 * is used as that fallback.
 */
export function useFullscreen(getMediaElement) {
  const stageRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const stageSupported =
    typeof document !== "undefined" && Boolean(document.fullscreenEnabled || document.webkitFullscreenEnabled);
  const [mediaFallback, setMediaFallback] = useState(false);
  useEffect(() => {
    setMediaFallback(!stageSupported && typeof HTMLVideoElement !== "undefined" && "webkitEnterFullscreen" in HTMLVideoElement.prototype);
  }, [stageSupported]);
  const canFullscreen = stageSupported || mediaFallback;

  useEffect(() => {
    const onChange = () => setIsFullscreen(fullscreenElement() === stageRef.current);
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);

  // Leave fullscreen if the player goes away while fullscreen.
  useEffect(() => {
    const stage = stageRef.current;
    return () => {
      const active = fullscreenElement();
      if (active && active === stage) {
        (document.exitFullscreen || document.webkitExitFullscreen)?.call(document)?.catch?.(() => {});
      }
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    const stage = stageRef.current;
    if (fullscreenElement()) {
      (document.exitFullscreen || document.webkitExitFullscreen)?.call(document)?.catch?.(() => {});
    } else if (stage && stageSupported) {
      (stage.requestFullscreen || stage.webkitRequestFullscreen)?.call(stage)?.catch?.(() => {});
    } else {
      getMediaElement()?.webkitEnterFullscreen?.();
    }
  }, [stageSupported, getMediaElement]);

  return { stageRef, isFullscreen, canFullscreen, toggleFullscreen };
}
