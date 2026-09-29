import React, { useEffect } from "react";
import { Play, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { PlayerControls } from "@/components/player/PlayerControls";
import { useAutoHide } from "@/hooks/use-auto-hide";
import { cn } from "@/lib/utils";

/** Error panel shared by the video stage and the audio card. */
export function PlayerError({ onRetry }) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <TriangleAlert />
        </EmptyMedia>
        <EmptyTitle>Ceramah Tidak Dapat Dimainkan</EmptyTitle>
        <EmptyDescription>Sila cuba lagi, atau tukar ke mod Audio.</EmptyDescription>
      </EmptyHeader>
      <Button variant="outline" onClick={onRetry}>
        Cuba Lagi
      </Button>
    </Empty>
  );
}

/**
 * The 16:9 stage. It stays mounted in Audio mode (collapsed with `sr-only`) because it holds the
 * Video.js media element — that is what lets the switch to Audio keep playing without a gap.
 * In Video mode it shows the buffering Spinner, the error state and the auto-hiding controls.
 */
export function PlayerStage({ mode, engine, fullscreen }) {
  const { containerRef, state, controls } = engine;
  const isVideo = mode === "video";
  const autoHide = useAutoHide(isVideo && state.playing && !state.error);

  // Keyboard use (shortcuts, Tab) brings the controls back too.
  const { show } = autoHide;
  useEffect(() => {
    if (!isVideo) return undefined;
    document.addEventListener("keydown", show);
    return () => document.removeEventListener("keydown", show);
  }, [isVideo, show]);

  // Mouse click = play/pause; a touch tap only shows/hides the controls (buttons do the rest).
  function handlePointerUp(event) {
    if (!isVideo || event.target.closest("[data-player-controls]")) return;
    if (event.pointerType === "mouse") {
      if (state.error) return;
      controls.togglePlay();
      autoHide.show();
    } else if (autoHide.visible) {
      autoHide.hide();
    } else {
      autoHide.show();
    }
  }

  return (
    <div
      ref={fullscreen.stageRef}
      className={cn(
        "relative bg-foreground text-background",
        !isVideo && "sr-only",
        isVideo && (fullscreen.isFullscreen ? "size-full" : "aspect-video max-h-2/3 w-full"),
        isVideo && state.playing && !autoHide.visible && "cursor-none"
      )}
      onPointerMove={isVideo ? autoHide.show : undefined}
      onPointerUp={handlePointerUp}
    >
      <div ref={containerRef} className="absolute inset-0" />

      {isVideo && state.buffering && !state.error && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Spinner className="size-10" aria-label="Memuatkan video" />
        </div>
      )}

      {isVideo && !state.playing && !state.buffering && !state.error && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Button size="icon-lg" className="pointer-events-auto size-16" aria-label="Main" onClick={controls.togglePlay}>
            <Play className="size-8" />
          </Button>
        </div>
      )}

      {isVideo && state.error && (
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <div data-player-controls className="rounded-lg bg-popover text-popover-foreground">
            <PlayerError onRetry={controls.retry} />
          </div>
        </div>
      )}

      {isVideo && !state.error && (
        <div
          data-player-controls
          inert={!autoHide.visible}
          className={cn(
            "absolute inset-x-0 bottom-0 p-1 transition-opacity sm:p-3",
            !autoHide.visible && "opacity-0"
          )}
          {...autoHide.pinProps}
        >
          <div className="rounded-lg bg-popover/90 p-2 text-popover-foreground sm:p-3 shadow-md backdrop-blur-sm">
            <PlayerControls state={state} controls={controls} fullscreen={fullscreen} />
          </div>
        </div>
      )}
    </div>
  );
}
