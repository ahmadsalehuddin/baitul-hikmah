import React, { useMemo } from "react";
import { Combine, MapPin, Pencil, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { RowActions } from "@/components/urus/RowActions";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function actionsFor(location, { onRename, onMerge, onDelete }) {
  const unused = location.video_count === 0;
  return [
    { label: "Sunting", icon: Pencil, onSelect: () => onRename(location) },
    { label: "Gabung", icon: Combine, onSelect: () => onMerge(location) },
    {
      label: unused ? "Padam" : "Padam (lokasi digunakan)",
      icon: Trash2,
      destructive: true,
      disabled: !unused,
      onSelect: () => onDelete(location),
    },
  ];
}

/** Lokasi tab: Table (tablet+) or Card list (phone) with Sunting / Gabung / Padam. */
export function LocationTab({ locations, handlers }) {
  const rows = useMemo(() => [...locations].sort((a, b) => a.name.localeCompare(b.name, "ms")), [locations]);

  if (rows.length === 0) {
    return <EmptyState icon={MapPin} title="Belum Ada Lokasi" description="Tambah lokasi baharu menggunakan butang di atas." />;
  }

  return (
    <>
      <div className="hidden rounded-lg border sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lokasi</TableHead>
              <TableHead>Ceramah</TableHead>
              <TableHead className="w-12 text-right">
                <span className="sr-only">Tindakan</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="max-w-xs truncate">{l.name}</TableCell>
                <TableCell><span className="text-muted-foreground">{l.video_count}</span></TableCell>
                <TableCell className="text-right">
                  <RowActions label={`Tindakan untuk ${l.name}`} actions={actionsFor(l, handlers)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 sm:hidden">
        {rows.map((l) => (
          <Card key={l.id} size="sm">
            <CardContent className="flex-row items-center gap-3">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="line-clamp-2 font-medium">{l.name}</span>
                <span className="text-xs text-muted-foreground">{l.video_count} ceramah</span>
              </div>
              <RowActions label={`Tindakan untuk ${l.name}`} actions={actionsFor(l, handlers)} />
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
