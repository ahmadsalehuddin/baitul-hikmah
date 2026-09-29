import React, { useMemo } from "react";
import { Pencil, Users } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { RowActions } from "@/components/urus/RowActions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getInitials } from "@/lib/format";

function SpeakerAvatar({ speaker }) {
  return (
    <Avatar>
      {speaker.avatar_url && <AvatarImage src={speaker.avatar_url} alt="" />}
      <AvatarFallback>{getInitials(speaker.name)}</AvatarFallback>
    </Avatar>
  );
}

/** Penceramah tab: Table (tablet+) or Card list (phone) with Sunting. */
export function SpeakerTab({ speakers, handlers }) {
  const rows = useMemo(() => [...speakers].sort((a, b) => a.name.localeCompare(b.name, "ms")), [speakers]);
  const actionsFor = (s) => [{ label: "Sunting", icon: Pencil, onSelect: () => handlers.onRename(s) }];

  if (rows.length === 0) {
    return <EmptyState icon={Users} title="Belum Ada Penceramah" description="Tambah penceramah baharu menggunakan butang di atas." />;
  }

  return (
    <>
      <div className="hidden rounded-lg border sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Penceramah</TableHead>
              <TableHead>Ceramah</TableHead>
              <TableHead>Koleksi Kitab</TableHead>
              <TableHead className="w-12 text-right">
                <span className="sr-only">Tindakan</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <SpeakerAvatar speaker={s} />
                    <span>{s.name}</span>
                  </div>
                </TableCell>
                <TableCell><span className="text-muted-foreground">{s.video_count}</span></TableCell>
                <TableCell><span className="text-muted-foreground">{s.collection_count}</span></TableCell>
                <TableCell className="text-right">
                  <RowActions label={`Tindakan untuk ${s.name}`} actions={actionsFor(s)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 sm:hidden">
        {rows.map((s) => (
          <Card key={s.id} size="sm">
            <CardContent className="flex-row items-center gap-3">
              <SpeakerAvatar speaker={s} />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="line-clamp-2 font-medium">{s.name}</span>
                <span className="text-xs text-muted-foreground">
                  {s.video_count} ceramah dan {s.collection_count} koleksi kitab
                </span>
              </div>
              <RowActions label={`Tindakan untuk ${s.name}`} actions={actionsFor(s)} />
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
