import React from "react";
import { HardDriveDownload } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { formatFileSize } from "@/lib/format";
import { MIN_FREE_BYTES } from "@/lib/storage";

/** Storage health: 2 TB usage Progress, free space, breakdown Badges and the low-disk warning Alert (spec §8.3.8). */
export function StorageCard({ storage }) {
  const percent = storage ? Math.min(100, storage.percent_used || 0) : 0;
  const low = storage ? storage.free_bytes < MIN_FREE_BYTES : false;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kesihatan Storan Pelayan</CardTitle>
        <CardDescription>Cakera keras 2TB — HP Z240</CardDescription>
        {storage && (
          <CardAction>
            <span className="font-mono text-sm">{percent.toFixed(1)}%</span>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {!storage ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner aria-label="Memuatkan" />
            Memuatkan status storan…
          </div>
        ) : (
          <>
            <Progress value={percent} aria-label="Storan digunakan" />
            <p className="text-sm text-muted-foreground">
              {formatFileSize(storage.used_bytes)} digunakan daripada {formatFileSize(storage.total_bytes)} ·{" "}
              {formatFileSize(storage.free_bytes)} bebas
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Video: {formatFileSize(storage.videos_bytes)}</Badge>
              <Badge variant="secondary">Audio: {formatFileSize(storage.audio_bytes)}</Badge>
              <Badge variant="outline">Cache Thumbnail: {formatFileSize(storage.thumbnails_bytes)}</Badge>
            </div>
            {low && (
              <Alert variant="warning">
                <HardDriveDownload />
                <AlertTitle>Ruang storan pada cakera 2TB tidak mencukupi</AlertTitle>
                <AlertDescription>
                  Hanya {formatFileSize(storage.free_bytes)} ruang kosong berbaki. Muat turun ceramah baharu dilumpuhkan
                  sehingga sekurang-kurangnya 20 GB ruang kosong tersedia. Padam ceramah lama untuk membebaskan ruang.
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
