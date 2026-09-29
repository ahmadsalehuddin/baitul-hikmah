import React from "react";
import { BookOpen } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { PlayerControls } from "@/components/player/PlayerControls";
import { PlayerError } from "@/components/player/PlayerStage";

/**
 * Audio mode "Now Playing" card (spec §4.3 / §8.3.5): Arabesque background, large speaker
 * portrait (falls back to the kitab thumbnail), and the same shared controls as Video mode.
 */
export function AudioNowPlaying({ video, engine }) {
  const { state, controls } = engine;
  const artwork = video.speaker?.avatar_url || video.thumbnail_path;

  return (
    <Card className="relative">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <img src="/background-pattern.svg" alt="" className="size-full object-cover opacity-20" />
      </div>
      <CardContent className="relative flex flex-col items-center gap-6 py-6">
        <div className="rounded-full shadow-lg">
          <Avatar className="size-40 sm:size-48">
            {artwork && <AvatarImage src={artwork} alt="" />}
            <AvatarFallback>
              <BookOpen className="size-16" />
            </AvatarFallback>
          </Avatar>
        </div>
        <div className="flex h-8 items-center">{state.buffering && !state.error && <Spinner aria-label="Memuatkan audio" />}</div>
        {state.error ? (
          <PlayerError onRetry={controls.retry} />
        ) : (
          <div className="w-full max-w-xl">
            <PlayerControls state={state} controls={controls} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
