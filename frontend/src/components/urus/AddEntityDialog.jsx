import React, { useState } from "react";
import { DialogCloseButton } from "@/components/DialogCloseButton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { createCollection, createLocation, createSpeaker } from "@/lib/api";

const NO_SPEAKER = "none";

const KINDS = {
  collection: {
    title: "Tambah Koleksi Kitab",
    description: "Tambah koleksi kitab baharu ke dalam pustaka.",
    nameLabel: "Tajuk Koleksi Kitab",
    placeholder: "cth. Riyadhus Solihin",
    detailLabel: "Penerangan (pilihan)",
  },
  speaker: {
    title: "Tambah Penceramah",
    description: "Tambah penceramah baharu ke dalam pustaka.",
    nameLabel: "Nama Penceramah",
    placeholder: "cth. Ustaz Azhar Idrus",
    detailLabel: "Bio Ringkas (pilihan)",
  },
  location: {
    title: "Tambah Lokasi",
    description: "Tambah lokasi ceramah baharu ke dalam pustaka.",
    nameLabel: "Nama Lokasi",
    placeholder: "cth. Masjid Al Ghaffar Jasin",
  },
};

/**
 * Add one Koleksi Kitab / Penceramah / Lokasi (`kind` = "collection" | "speaker" | "location"), chosen by
 * the active tab on Urus Pustaka. `speakers` is only needed for `kind="collection"`. Render while open.
 */
export function AddEntityDialog({ kind, speakers = [], onClose, onCreated }) {
  const config = KINDS[kind];
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [speakerId, setSpeakerId] = useState(NO_SPEAKER);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const empty = name.trim() === "";

  async function handleSubmit(event) {
    event.preventDefault();
    if (empty || saving) return;
    setSaving(true);
    setError("");
    try {
      if (kind === "collection") {
        await createCollection({
          title: name.trim(),
          description: description.trim() || null,
          speaker_id: speakerId === NO_SPEAKER ? null : Number(speakerId),
        });
      } else if (kind === "speaker") {
        await createSpeaker({ name: name.trim(), bio: description.trim() || null });
      } else {
        await createLocation({ name: name.trim() });
      }
      onCreated();
      onClose();
    } catch (err) {
      setError(err?.detail || "Gagal menyimpan. Nama mungkin sudah wujud.");
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false} className="max-h-dvh overflow-y-auto">
        <DialogCloseButton />
        <form onSubmit={handleSubmit} className="contents">
          <DialogHeader>
            <DialogTitle>{config.title}</DialogTitle>
            <DialogDescription className="sr-only">{config.description}</DialogDescription>
          </DialogHeader>

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="urus-tambah-nama">{config.nameLabel}</FieldLabel>
              <Input
                id="urus-tambah-nama"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={config.placeholder}
                autoComplete="off"
              />
            </Field>

            {kind === "collection" && (
              <Field>
                <FieldLabel htmlFor="urus-tambah-penceramah">Penceramah (pilihan)</FieldLabel>
                <Select value={speakerId} onValueChange={setSpeakerId}>
                  <SelectTrigger id="urus-tambah-penceramah" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_SPEAKER}>Tiada / Pelbagai Penceramah</SelectItem>
                    {speakers.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}

            {config.detailLabel && (
              <Field>
                <FieldLabel htmlFor="urus-tambah-huraian">{config.detailLabel}</FieldLabel>
                <Textarea id="urus-tambah-huraian" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
              </Field>
            )}

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
            <Button type="submit" disabled={saving || empty}>
              {saving && <Spinner data-icon="inline-start" />}
              Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
