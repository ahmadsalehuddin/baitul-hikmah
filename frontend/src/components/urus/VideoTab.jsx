import React, { useMemo, useState } from "react";
import { Pencil, RotateCcw, Search, Trash2, Video, X } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { RowActions } from "@/components/urus/RowActions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useProgressiveList } from "@/hooks/use-progressive-list";
import { formatDuration, formatFileSize, formatShortDate } from "@/lib/format";

const ALL = "all";

const normalise = (text) =>
  String(text ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();

function Thumbnail({ video }) {
  return (
    <div className="aspect-video w-16 shrink-0 overflow-hidden rounded-md bg-muted">
      {video.thumbnail_path ? (
        <img src={video.thumbnail_path} alt="" loading="lazy" className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center text-muted-foreground">
          <Video className="size-4" />
        </div>
      )}
    </div>
  );
}

function videoActions(video, { onEdit, onDelete }) {
  return [
    { label: "Sunting", icon: Pencil, onSelect: () => onEdit(video) },
    { label: "Padam", icon: Trash2, destructive: true, onSelect: () => onDelete(video) },
  ];
}

function failedActions(video, { onRetry, onDelete }) {
  return [
    { label: "Cuba Semula", icon: RotateCcw, onSelect: () => onRetry(video.id) },
    { label: "Padam", icon: Trash2, destructive: true, onSelect: () => onDelete(video) },
  ];
}

/** Ceramah tab: search + Penceramah / Koleksi Kitab filters, Table (tablet+) or Card list (phone). */
export function VideoTab({ loaded, videos, failed, speakers, collections, handlers }) {
  const [query, setQuery] = useState("");
  const [speakerId, setSpeakerId] = useState(ALL);
  const [collectionId, setCollectionId] = useState(ALL);

  const filtered = useMemo(() => {
    const q = normalise(query).trim();
    return videos
      .filter((v) => (speakerId === ALL ? true : v.speaker?.id === Number(speakerId)))
      .filter((v) => (collectionId === ALL ? true : v.collection?.id === Number(collectionId)))
      .filter((v) => (q ? normalise(v.title).includes(q) : true))
      .sort((a, b) => b.newestMs - a.newestMs);
  }, [videos, query, speakerId, collectionId]);

  const filtering = query.trim() !== "" || speakerId !== ALL || collectionId !== ALL;
  // Failed downloads (retry / delete) lead the list; they hide while a filter is active.
  const failedRows = filtering ? [] : failed;
  const { visible, hasMore, sentinelRef } = useProgressiveList(filtered, `${query}|${speakerId}|${collectionId}`);

  const toolbar = (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <InputGroup className="sm:min-w-64 sm:flex-1">
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
        <InputGroupInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari tajuk ceramah"
          aria-label="Cari tajuk ceramah"
          autoComplete="off"
        />
        {query && (
          <InputGroupAddon align="inline-end">
            <InputGroupButton size="icon-xs" aria-label="Padam carian" onClick={() => setQuery("")}>
              <X />
            </InputGroupButton>
          </InputGroupAddon>
        )}
      </InputGroup>
      <Select value={speakerId} onValueChange={setSpeakerId}>
        <SelectTrigger className="w-full sm:w-52" aria-label="Tapis mengikut penceramah">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Semua Penceramah</SelectItem>
          {speakers.map((s) => (
            <SelectItem key={s.id} value={String(s.id)}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={collectionId} onValueChange={setCollectionId}>
        <SelectTrigger className="w-full sm:w-52" aria-label="Tapis mengikut koleksi kitab">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Semua Koleksi Kitab</SelectItem>
          {collections.map((c) => (
            <SelectItem key={c.id} value={String(c.id)}>
              {c.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  if (!loaded) {
    return (
      <div className="flex flex-col gap-4">
        {toolbar}
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
          <Spinner aria-label="Memuatkan" />
          Memuatkan ceramah
        </div>
      </div>
    );
  }

  if (filtered.length === 0 && failedRows.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {toolbar}
        <EmptyState
          icon={Video}
          title={filtering ? "Tiada Ceramah Dijumpai" : "Pustaka Masih Kosong"}
          description={
            filtering
              ? "Tukar kata kunci atau tapisan dan cuba lagi."
              : "Belum ada video ceramah yang dimuat turun."
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {toolbar}

      {/* Tablet and up: Table (scrolls sideways if it must) */}
      <div className="hidden rounded-lg border sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ceramah</TableHead>
              <TableHead>Penceramah</TableHead>
              <TableHead>Koleksi Kitab</TableHead>
              <TableHead>Tempoh</TableHead>
              <TableHead className="hidden lg:table-cell">Saiz</TableHead>
              <TableHead className="hidden lg:table-cell">Tarikh</TableHead>
              <TableHead className="w-12 text-right">
                <span className="sr-only">Tindakan</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {failedRows.map((v) => (
              <TableRow key={`failed-${v.id}`}>
                <TableCell className="max-w-xs whitespace-normal">
                  <div className="flex min-w-56 items-center gap-3">
                    <Thumbnail video={v} />
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="line-clamp-2">{v.title}</span>
                      <span className="line-clamp-1 text-xs text-muted-foreground">
                        {v.error_message || "Ralat tidak diketahui semasa muat turun."}
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="destructive">Muat Turun Gagal</Badge>
                </TableCell>
                <TableCell />
                <TableCell />
                <TableCell className="hidden lg:table-cell" />
                <TableCell className="hidden lg:table-cell" />
                <TableCell className="text-right">
                  <RowActions label={`Tindakan untuk ${v.title}`} actions={failedActions(v, handlers)} />
                </TableCell>
              </TableRow>
            ))}
            {visible.map((v) => (
              <TableRow key={v.id}>
                <TableCell className="max-w-xs whitespace-normal">
                  <div className="flex min-w-56 items-center gap-3">
                    <Thumbnail video={v} />
                    <span className="line-clamp-2">{v.title}</span>
                  </div>
                </TableCell>
                <TableCell className="whitespace-normal">
                  <span className="text-muted-foreground">{v.speaker?.name ?? "-"}</span>
                </TableCell>
                <TableCell className="whitespace-normal">
                  <span className="text-muted-foreground">{v.collection?.title ?? "-"}</span>
                </TableCell>
                <TableCell><span className="text-muted-foreground">{formatDuration(v.duration_seconds)}</span></TableCell>
                <TableCell className="hidden lg:table-cell">
                  <span className="text-muted-foreground">{v.file_size_bytes ? formatFileSize(v.file_size_bytes) : "-"}</span>
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <span className="text-muted-foreground">{formatShortDate(v.created_at)}</span>
                </TableCell>
                <TableCell className="text-right">
                  <RowActions label={`Tindakan untuk ${v.title}`} actions={videoActions(v, handlers)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Phone: Card list */}
      <div className="flex flex-col gap-3 sm:hidden">
        {failedRows.map((v) => (
          <Card key={`failed-${v.id}`} size="sm">
            <CardContent className="flex-row items-start gap-3">
              <Thumbnail video={v} />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="line-clamp-2 font-medium">{v.title}</span>
                <span className="line-clamp-2 text-xs text-muted-foreground">
                  {v.error_message || "Ralat tidak diketahui semasa muat turun."}
                </span>
                <Badge variant="destructive" className="w-fit">
                  Muat Turun Gagal
                </Badge>
              </div>
              <RowActions label={`Tindakan untuk ${v.title}`} actions={failedActions(v, handlers)} />
            </CardContent>
          </Card>
        ))}
        {visible.map((v) => (
          <Card key={v.id} size="sm">
            <CardContent className="flex-row items-start gap-3">
              <Thumbnail video={v} />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="line-clamp-2 font-medium">{v.title}</span>
                <span className="line-clamp-1 text-xs text-muted-foreground">
                  {[v.speaker?.name, v.collection?.title].filter(Boolean).join(" • ") || "-"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDuration(v.duration_seconds)} • {v.file_size_bytes ? formatFileSize(v.file_size_bytes) : "-"} •{" "}
                  {formatShortDate(v.created_at)}
                </span>
              </div>
              <RowActions label={`Tindakan untuk ${v.title}`} actions={videoActions(v, handlers)} />
            </CardContent>
          </Card>
        ))}
      </div>

      {hasMore && (
        <div ref={sentinelRef} className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
          <Spinner aria-label="Memuatkan" />
          Memuatkan ceramah
        </div>
      )}
    </div>
  );
}
