import React, { useMemo } from "react";
import { Combine, LibraryBig, Pencil, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { RowActions } from "@/components/urus/RowActions";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function actionsFor(collection, { onRename, onMerge, onDelete }) {
  const empty = collection.video_count === 0;
  return [
    { label: "Sunting", icon: Pencil, onSelect: () => onRename(collection) },
    { label: "Gabung", icon: Combine, onSelect: () => onMerge(collection) },
    {
      label: empty ? "Padam" : "Padam (koleksi tidak kosong)",
      icon: Trash2,
      destructive: true,
      disabled: !empty,
      onSelect: () => onDelete(collection),
    },
  ];
}

/** Koleksi Kitab tab: Table (tablet+) or Card list (phone) with Sunting / Gabung / Padam. */
export function CollectionTab({ collections, handlers }) {
  const rows = useMemo(() => [...collections].sort((a, b) => a.title.localeCompare(b.title, "ms")), [collections]);

  if (rows.length === 0) {
    return <EmptyState icon={LibraryBig} title="Belum Ada Koleksi Kitab" description="Tambah koleksi kitab baharu menggunakan butang di atas." />;
  }

  return (
    <>
      <div className="hidden rounded-lg border sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Koleksi Kitab</TableHead>
              <TableHead>Penceramah</TableHead>
              <TableHead>Ceramah</TableHead>
              <TableHead className="w-12 text-right">
                <span className="sr-only">Tindakan</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="max-w-xs truncate">{c.title}</TableCell>
                <TableCell className="whitespace-normal">
                  <span className="text-muted-foreground">{c.speaker_name ?? "-"}</span>
                </TableCell>
                <TableCell><span className="text-muted-foreground">{c.video_count}</span></TableCell>
                <TableCell className="text-right">
                  <RowActions label={`Tindakan untuk ${c.title}`} actions={actionsFor(c, handlers)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 sm:hidden">
        {rows.map((c) => (
          <Card key={c.id} size="sm">
            <CardContent className="flex-row items-center gap-3">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="line-clamp-2 font-medium">{c.title}</span>
                <span className="text-xs text-muted-foreground">
                  {c.video_count} ceramah{c.speaker_name ? ` • ${c.speaker_name}` : ""}
                </span>
              </div>
              <RowActions label={`Tindakan untuk ${c.title}`} actions={actionsFor(c, handlers)} />
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
