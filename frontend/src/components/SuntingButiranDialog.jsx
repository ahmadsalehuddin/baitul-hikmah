import React, { useMemo, useRef, useState } from "react";
import { RotateCw, Upload } from "lucide-react";
import { DialogCloseButton } from "@/components/DialogCloseButton";
import { EntityCombobox } from "@/components/EntityCombobox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useEntities } from "@/hooks/use-entities";
import { resetVideoThumbnail, updateVideoDetails, uploadVideoThumbnail } from "@/lib/api";

const TITLE_MAX = 200;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

function IconTooltipButton({ label, children, ...props }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" variant="secondary" size="icon-sm" aria-label={label} {...props}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** Works with both list items (`speaker: {id, name}`) and raw `Video` records (`speaker_id`). */
function initialEntity(video, key, entities, labelKey) {
  const id = video[`${key}_id`] ?? video[key]?.id ?? null;
  if (id === null) return null;
  const label = video[key]?.[labelKey] ?? entities.get(id)?.[labelKey];
  return label ? { id, label } : null;
}

function SuntingForm({ video, onClose, onSaved }) {
  const { speakers, collections, speakersById, collectionsById } = useEntities();
  const fileRef = useRef(null);

  const [title, setTitle] = useState(video.title ?? "");
  const [series, setSeries] = useState(video.series_number ? String(video.series_number) : "");
  const [collection, setCollection] = useState(() => initialEntity(video, "collection", collectionsById, "title"));
  const [speaker, setSpeaker] = useState(() => initialEntity(video, "speaker", speakersById, "name"));
  const [thumb, setThumb] = useState({ path: video.thumbnail_path, isCustom: !!video.is_custom_thumbnail });
  const [thumbBusy, setThumbBusy] = useState(false);
  const [thumbChanged, setThumbChanged] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // The lists may load after the dialog opens; fill in names that were only known by id.
  const collectionValue = collection ?? initialEntity(video, "collection", collectionsById, "title");
  const speakerValue = speaker ?? initialEntity(video, "speaker", speakersById, "name");

  const collectionOptions = useMemo(
    () => [...collections].sort((a, b) => a.title.localeCompare(b.title, "ms")).map((c) => ({ id: c.id, label: c.title })),
    [collections]
  );
  const speakerOptions = useMemo(
    () => [...speakers].sort((a, b) => a.name.localeCompare(b.name, "ms")).map((s) => ({ id: s.id, label: s.name })),
    [speakers]
  );

  const seriesNumber = series.trim() === "" ? null : Number(series);
  const seriesInvalid = seriesNumber !== null && !(Number.isInteger(seriesNumber) && seriesNumber >= 1 && seriesNumber <= 9999);
  const titleEmpty = title.trim() === "";
  const busy = saving || thumbBusy;

  function finish() {
    if (thumbChanged) onSaved?.();
    onClose();
  }

  async function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type) || file.size > IMAGE_MAX_BYTES) {
      setError("Gambar mesti berformat JPEG, PNG atau WebP dan tidak melebihi 5 MB.");
      return;
    }
    await changeThumbnail(() => uploadVideoThumbnail(video.id, file), "Gagal memuat naik gambar.");
  }

  async function changeThumbnail(action, failure) {
    setThumbBusy(true);
    setError("");
    try {
      const res = await action();
      setThumb({ path: res.thumbnail_path, isCustom: !!res.is_custom_thumbnail });
      setThumbChanged(true);
    } catch (err) {
      console.error(err);
      setError(err?.detail || failure);
    } finally {
      setThumbBusy(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (titleEmpty || seriesInvalid || busy) return;
    setSaving(true);
    setError("");
    const payload = { title: title.trim() };
    if (collectionValue) {
      if (collectionValue.id !== null) payload.collection_id = collectionValue.id;
      else payload.collection_title = collectionValue.label;
    }
    if (speakerValue) {
      if (speakerValue.id !== null) payload.speaker_id = speakerValue.id;
      else payload.speaker_name = speakerValue.label;
    }
    if (seriesNumber !== (video.series_number ?? null)) payload.series_number = seriesNumber;
    try {
      await updateVideoDetails(video.id, payload);
      onSaved?.();
      onClose();
    } catch (err) {
      console.error(err);
      setError("Gagal mengemaskini maklumat ceramah. Sila cuba lagi.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="contents">
      <DialogHeader>
        <DialogTitle>Sunting Butiran Ceramah</DialogTitle>
        <DialogDescription className="sr-only">Ubah gambar, tajuk, siri, koleksi kitab dan penceramah ceramah ini.</DialogDescription>
      </DialogHeader>

      <FieldGroup>
        <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
          {thumb.path && <img src={thumb.path} alt="" className="size-full object-cover" />}
          <div className="absolute top-2 right-2 flex gap-2">
            <IconTooltipButton label="Muat naik gambar sendiri" disabled={busy} onClick={() => fileRef.current?.click()}>
              {thumbBusy ? <Spinner /> : <Upload />}
            </IconTooltipButton>
            <IconTooltipButton
              label="Kembalikan gambar asal"
              disabled={busy || !thumb.isCustom}
              onClick={() => changeThumbnail(() => resetVideoThumbnail(video.id), "Gagal mengembalikan gambar asal.")}
            >
              <RotateCw />
            </IconTooltipButton>
          </div>
          <input ref={fileRef} type="file" accept={IMAGE_TYPES.join(",")} hidden onChange={handleFile} />
        </div>

        <Field data-invalid={titleEmpty || undefined}>
          <FieldLabel htmlFor="sunting-tajuk">Tajuk Ceramah</FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="sunting-tajuk"
              value={title}
              maxLength={TITLE_MAX}
              aria-invalid={titleEmpty}
              onChange={(e) => setTitle(e.target.value)}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupText>
                {title.length}/{TITLE_MAX}
              </InputGroupText>
            </InputGroupAddon>
          </InputGroup>
          {titleEmpty && <FieldError>Tajuk ceramah diperlukan.</FieldError>}
        </Field>

        <Field data-invalid={seriesInvalid || undefined}>
          <FieldLabel htmlFor="sunting-siri">Siri</FieldLabel>
          <Input
            id="sunting-siri"
            type="number"
            inputMode="numeric"
            min={1}
            max={9999}
            value={series}
            aria-invalid={seriesInvalid}
            placeholder="Nombor siri (pilihan)"
            onChange={(e) => setSeries(e.target.value)}
          />
          {seriesInvalid ? (
            <FieldError>Nombor siri mesti nombor bulat antara 1 dan 9999.</FieldError>
          ) : (
            <FieldDescription>Kosongkan jika ceramah ini bukan sebahagian daripada siri.</FieldDescription>
          )}
        </Field>

        <Field>
          <FieldLabel htmlFor="sunting-koleksi">Nama Koleksi Kitab</FieldLabel>
          <EntityCombobox
            id="sunting-koleksi"
            options={collectionOptions}
            value={collectionValue}
            onChange={setCollection}
            placeholder="Pilih koleksi kitab"
            searchPlaceholder="Cari atau taip nama koleksi kitab"
            createLabel={(text) => `Tambah ‘${text}’`}
            emptyLabel="Tiada koleksi kitab dijumpai."
          />
          {collectionValue?.id === null && <FieldDescription>Koleksi kitab baharu akan ditambah apabila anda menyimpan.</FieldDescription>}
        </Field>

        <Field>
          <FieldLabel htmlFor="sunting-penceramah">Penceramah</FieldLabel>
          <EntityCombobox
            id="sunting-penceramah"
            options={speakerOptions}
            value={speakerValue}
            onChange={setSpeaker}
            placeholder="Pilih penceramah"
            searchPlaceholder="Cari atau taip nama penceramah"
            createLabel={(text) => `Tambah ‘${text}’`}
            emptyLabel="Tiada penceramah dijumpai."
          />
          {speakerValue?.id === null && <FieldDescription>Penceramah baharu akan ditambah apabila anda menyimpan.</FieldDescription>}
        </Field>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </FieldGroup>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={finish}>
          Batal
        </Button>
        <Button type="submit" disabled={busy || titleEmpty || seriesInvalid}>
          {saving && <Spinner data-icon="inline-start" />}
          Simpan
        </Button>
      </DialogFooter>
    </form>
  );
}

/**
 * Sunting Butiran Ceramah (spec §8.3.7). Render it while a video is being edited:
 * `{editing && <SuntingButiranDialog video={editing} onClose=… onSaved=… />}`.
 * `onSaved` fires after Simpan, and on close if the thumbnail was changed (that saves at once).
 */
export function SuntingButiranDialog({ video, onClose, onSaved }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false} className="max-h-dvh overflow-y-auto">
        <DialogCloseButton />
        <SuntingForm video={video} onClose={onClose} onSaved={onSaved} />
      </DialogContent>
    </Dialog>
  );
}
