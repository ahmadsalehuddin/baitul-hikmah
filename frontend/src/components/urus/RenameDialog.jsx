import React, { useState } from "react";
import { DialogCloseButton } from "@/components/DialogCloseButton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { updateCollection, updateLocation, updateSpeaker } from "@/lib/api";

const KINDS = {
  collection: { title: "Sunting Koleksi Kitab", noun: "koleksi kitab", label: "Nama Koleksi Kitab", read: (e) => e.title, save: (id, name) => updateCollection(id, { title: name }) },
  speaker: { title: "Sunting Penceramah", noun: "penceramah", label: "Nama Penceramah", read: (e) => e.name, save: (id, name) => updateSpeaker(id, { name }) },
  location: { title: "Sunting Lokasi", noun: "lokasi", label: "Nama Lokasi", read: (e) => e.name, save: (id, name) => updateLocation(id, { name }) },
};

/** Rename a Koleksi Kitab (`kind="collection"`), Penceramah (`"speaker"`) or Lokasi (`"location"`). Render while editing. */
export function RenameDialog({ entity, kind, onClose, onSaved }) {
  const config = KINDS[kind];
  const [name, setName] = useState(config.read(entity));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const empty = name.trim() === "";

  async function handleSubmit(event) {
    event.preventDefault();
    if (empty || saving) return;
    setSaving(true);
    setError("");
    try {
      await config.save(entity.id, name.trim());
      onSaved();
      onClose();
    } catch (err) {
      setError(err?.detail || "Gagal mengemaskini nama.");
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
            <DialogDescription className="sr-only">Tukar nama {config.noun}.</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field data-invalid={empty || undefined}>
              <FieldLabel htmlFor="urus-nama">{config.label}</FieldLabel>
              <Input id="urus-nama" value={name} aria-invalid={empty} onChange={(e) => setName(e.target.value)} />
              {empty && <FieldError>Nama diperlukan.</FieldError>}
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
