import React, { useState } from "react";
import { DialogCloseButton } from "@/components/DialogCloseButton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { mergeCollections, mergeLocations } from "@/lib/api";

const KINDS = {
  collection: {
    title: "Gabungkan Koleksi", noun: "koleksi", placeholder: "Pilih koleksi sasaran", failure: "Gagal menggabungkan koleksi.",
    read: (e) => e.title, merge: mergeCollections,
  },
  location: {
    title: "Gabungkan Lokasi", noun: "lokasi", placeholder: "Pilih lokasi sasaran", failure: "Gagal menggabungkan lokasi.",
    read: (e) => e.name, merge: mergeLocations,
  },
};

/**
 * Gabung: move every ceramah of `source` into another entry of the same `kind` (`"collection"` or
 * `"location"`), then delete `source`. `entities` is the full list of that kind. Render while merging.
 */
export function MergeDialog({ source, kind, entities, onClose, onMerged }) {
  const config = KINDS[kind];
  const [targetId, setTargetId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const targets = entities.filter((e) => e.id !== source.id);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!targetId || saving) return;
    setSaving(true);
    setError("");
    try {
      await config.merge(source.id, Number(targetId));
      onMerged();
      onClose();
    } catch (err) {
      setError(err?.detail || config.failure);
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false}>
        <DialogCloseButton />
        <form onSubmit={handleSubmit} className="contents">
          <DialogHeader>
            <DialogTitle>{config.title}</DialogTitle>
            <DialogDescription>
              Semua {source.video_count} ceramah dalam “{config.read(source)}” akan dipindahkan ke {config.noun} sasaran, dan{" "}
              {config.noun} ini akan dipadam.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="urus-gabung">Gabung Ke Dalam</FieldLabel>
              <Select value={targetId} onValueChange={setTargetId}>
                <SelectTrigger id="urus-gabung" className="w-full">
                  <SelectValue placeholder={config.placeholder} />
                </SelectTrigger>
                <SelectContent>
                  {targets.map((e) => (
                    <SelectItem key={e.id} value={String(e.id)}>
                      {config.read(e)} ({e.video_count} ceramah)
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
