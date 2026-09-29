import React, { useState } from "react";
import { DialogCloseButton } from "@/components/DialogCloseButton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { mergeCollections } from "@/lib/api";

/** Gabung: move every ceramah of `source` into another Koleksi Kitab, then delete `source`. Render while merging. */
export function MergeDialog({ source, collections, onClose, onMerged }) {
  const [targetId, setTargetId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const targets = collections.filter((c) => c.id !== source.id);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!targetId || saving) return;
    setSaving(true);
    setError("");
    try {
      await mergeCollections(source.id, Number(targetId));
      onMerged();
      onClose();
    } catch (err) {
      setError(err?.detail || "Gagal menggabungkan koleksi.");
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false}>
        <DialogCloseButton />
        <form onSubmit={handleSubmit} className="contents">
          <DialogHeader>
            <DialogTitle>Gabungkan Koleksi</DialogTitle>
            <DialogDescription>
              Semua {source.video_count} ceramah dalam “{source.title}” akan dipindahkan ke koleksi sasaran, dan koleksi ini
              akan dipadam.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="urus-gabung">Gabung Ke Dalam</FieldLabel>
              <Select value={targetId} onValueChange={setTargetId}>
                <SelectTrigger id="urus-gabung" className="w-full">
                  <SelectValue placeholder="Pilih koleksi sasaran" />
                </SelectTrigger>
                <SelectContent>
                  {targets.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.title} ({c.video_count} ceramah)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" disabled={saving || !targetId}>
              {saving && <Spinner data-icon="inline-start" />}
              Gabungkan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
