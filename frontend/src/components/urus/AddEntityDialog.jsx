import React, { useState } from "react";
import { DialogCloseButton } from "@/components/DialogCloseButton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { createCollection, createSpeaker } from "@/lib/api";

const NO_SPEAKER = "none";

/** "Tambah Penceramah atau Koleksi": type Radio Group + Field. Render while open. */
export function AddEntityDialog({ speakers, initialKind = "collection", onClose, onCreated }) {
  const [kind, setKind] = useState(initialKind);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [speakerId, setSpeakerId] = useState(NO_SPEAKER);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isCollection = kind === "collection";
  const empty = name.trim() === "";

  async function handleSubmit(event) {
    event.preventDefault();
    if (empty || saving) return;
    setSaving(true);
    setError("");
    try {
      if (isCollection) {
        await createCollection({
          title: name.trim(),
          description: description.trim() || null,
          speaker_id: speakerId === NO_SPEAKER ? null : Number(speakerId),
        });
      } else {
        await createSpeaker({ name: name.trim(), bio: description.trim() || null });
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
            <DialogTitle>Tambah Penceramah atau Koleksi</DialogTitle>
            <DialogDescription className="sr-only">Tambah penceramah atau koleksi kitab baharu ke dalam pustaka.</DialogDescription>
          </DialogHeader>

          <FieldGroup>
            <FieldSet>
              <FieldLegend variant="label">Jenis</FieldLegend>
              <RadioGroup value={kind} onValueChange={setKind} className="flex gap-6">
                <Field orientation="horizontal" className="w-auto">
                  <RadioGroupItem value="collection" id="urus-jenis-koleksi" />
                  <FieldLabel htmlFor="urus-jenis-koleksi">Koleksi Kitab</FieldLabel>
                </Field>
                <Field orientation="horizontal" className="w-auto">
                  <RadioGroupItem value="speaker" id="urus-jenis-penceramah" />
                  <FieldLabel htmlFor="urus-jenis-penceramah">Penceramah</FieldLabel>
                </Field>
              </RadioGroup>
            </FieldSet>

            <Field>
              <FieldLabel htmlFor="urus-tambah-nama">{isCollection ? "Tajuk Koleksi Kitab" : "Nama Penceramah"}</FieldLabel>
              <Input
                id="urus-tambah-nama"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={isCollection ? "cth. Riyadhus Solihin" : "cth. Ustaz Azhar Idrus"}
                autoComplete="off"
              />
            </Field>

            {isCollection && (
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

            <Field>
              <FieldLabel htmlFor="urus-tambah-huraian">{isCollection ? "Penerangan (pilihan)" : "Bio Ringkas (pilihan)"}</FieldLabel>
              <Textarea id="urus-tambah-huraian" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
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
