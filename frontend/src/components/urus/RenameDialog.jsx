import React, { useState } from "react";
import { DialogCloseButton } from "@/components/DialogCloseButton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { updateCollection, updateSpeaker } from "@/lib/api";

/** Rename a Koleksi Kitab (`kind="collection"`) or Penceramah (`kind="speaker"`). Render while editing. */
export function RenameDialog({ entity, kind, onClose, onSaved }) {
  const isCollection = kind === "collection";
  const [name, setName] = useState(isCollection ? entity.title : entity.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const empty = name.trim() === "";

  async function handleSubmit(event) {
    event.preventDefault();
    if (empty || saving) return;
    setSaving(true);
    setError("");
    try {
      if (isCollection) await updateCollection(entity.id, { title: name.trim() });
      else await updateSpeaker(entity.id, { name: name.trim() });
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
            <DialogTitle>{isCollection ? "Sunting Koleksi Kitab" : "Sunting Penceramah"}</DialogTitle>
            <DialogDescription className="sr-only">Tukar nama {isCollection ? "koleksi kitab" : "penceramah"}.</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field data-invalid={empty || undefined}>
              <FieldLabel htmlFor="urus-nama">{isCollection ? "Nama Koleksi Kitab" : "Nama Penceramah"}</FieldLabel>
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
