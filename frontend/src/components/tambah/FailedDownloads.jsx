import React from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

/** Downloads that failed, each with "Cuba Semula" (retry). Not in the mockups; live feature kept. */
export function FailedDownloads({ videos, retryingId, onRetry }) {
  if (videos.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl">Muat Turun Gagal</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {videos.map((video) => (
          <Card key={video.id} size="sm">
            <CardHeader>
              <CardTitle className="line-clamp-1">{video.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="line-clamp-2 text-sm text-destructive">
                {video.error_message || "Ralat tidak diketahui semasa muat turun."}
              </p>
              <Button variant="destructive" disabled={retryingId === video.id} onClick={() => onRetry(video.id)}>
                {retryingId === video.id ? <Spinner data-icon="inline-start" /> : <RotateCcw data-icon="inline-start" />}
                Cuba Semula
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
