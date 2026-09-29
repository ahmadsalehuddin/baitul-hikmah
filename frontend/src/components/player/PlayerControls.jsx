import React, { useState } from "react";
import { Maximize, Minimize, Pause, Play, RotateCcw, RotateCw, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SKIP_SECONDS, SPEEDS } from "@/hooks/use-video-engine";
import { formatDuration } from "@/lib/format";

/**
 * The one control set shared by Video and Audio mode (spec §8.3.5): seek Slider with times,
 * ±10 s, Play/Pause, speed Toggle Group, volume + mute, and fullscreen (video mode only).
 * Everything is rem-sized, so it scales with Saiz Teks.
 *
 * `state` / `controls` come from `useVideoEngine`; `fullscreen` from `useFullscreen` (omit to hide the button).
 */
export function PlayerControls({ state, controls, fullscreen }) {
  const { playing, currentTime, duration, speed, volume, muted } = state;
  // While dragging the seek Slider we show the dragged position and only seek on release.
  const [scrub, setScrub] = useState(null);
  const shown = scrub ?? currentTime;
  const silent = muted || volume === 0;

  return (
    <div className="flex flex-col gap-2 sm:gap-3">
      <div role="group" aria-label="Kedudukan tontonan" className="flex items-center gap-2 sm:gap-3">
        <span className="w-12 text-right text-sm tabular-nums sm:w-14">{formatDuration(shown)}</span>
        <Slider
          value={[Math.min(shown, duration || 0)]}
          min={0}
          max={duration || 1}
          step={1}
          disabled={!duration}
          onValueChange={([value]) => setScrub(value)}
          onValueCommit={([value]) => {
            controls.seek(value);
            setScrub(null);
          }}
        />
        <span className="w-12 text-sm tabular-nums sm:w-14">{formatDuration(duration)}</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-3 sm:gap-x-4">
        <div className="flex items-center gap-1 sm:gap-2">
          <Button variant="ghost" size="lg" aria-label={`Undur ${SKIP_SECONDS} saat`} onClick={() => controls.skip(-SKIP_SECONDS)}>
            <RotateCcw />
            <span className="hidden sm:inline">{SKIP_SECONDS}</span>
          </Button>
          <Button
            size="icon-lg"
            className="size-12 sm:size-14"
            aria-label={playing ? "Jeda" : "Main"}
            onClick={controls.togglePlay}
          >
            {playing ? <Pause className="size-7" /> : <Play className="size-7" />}
          </Button>
          <Button variant="ghost" size="lg" aria-label={`Maju ${SKIP_SECONDS} saat`} onClick={() => controls.skip(SKIP_SECONDS)}>
            <RotateCw />
            <span className="hidden sm:inline">{SKIP_SECONDS}</span>
          </Button>
        </div>

        <ToggleGroup
          type="single"
          variant="outline"
          spacing={0}
          value={String(speed)}
          aria-label="Kelajuan main balik"
          onValueChange={(value) => value && controls.setSpeed(Number(value))}
        >
          {SPEEDS.map((rate) => (
            <ToggleGroupItem key={rate} value={String(rate)} aria-label={`Kelajuan ${rate}x`}>
              {rate}x
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <div className="flex items-center gap-1 sm:gap-2">
          {/* Phones use the hardware volume keys, so mute and the volume Slider start at tablet width. */}
          <Button variant="ghost" size="icon-lg" className="max-sm:hidden" aria-label={silent ? "Nyahsenyap" : "Senyapkan"} onClick={controls.toggleMute}>
            {silent ? <VolumeX /> : <Volume2 />}
          </Button>
          <div role="group" aria-label="Kelantangan" className="hidden w-24 sm:block">
            <Slider
              value={[silent ? 0 : volume]}
              min={0}
              max={1}
              step={0.05}
              onValueChange={([value]) => controls.setVolume(value)}
            />
          </div>
          {fullscreen?.canFullscreen && (
            <Button
              variant="ghost"
              size="icon-lg"
              aria-label={fullscreen.isFullscreen ? "Keluar skrin penuh" : "Skrin penuh"}
              onClick={fullscreen.toggleFullscreen}
            >
              {fullscreen.isFullscreen ? <Minimize /> : <Maximize />}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
