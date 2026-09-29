import React, { useState, useEffect, useRef } from "react";
import { Upload, RotateCw, Plus, Check, ChevronDown, X } from "lucide-react";
import { fetchSpeakers, fetchCollections, updateVideoDetails } from "../lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";

function Combobox({ label, placeholder, value, onSelect, onCreateLabel, items, getLabel }) {
  const [search, setSearch] = useState(value || "");
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    setSearch(value || "");
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = items.filter((item) =>
    getLabel(item).toLowerCase().includes(search.toLowerCase())
  );
  const exactMatch = items.some(
    (item) => getLabel(item).toLowerCase() === search.trim().toLowerCase()
  );

  return (
    <div className="relative" ref={wrapperRef}>
      <label className="block text-xs font-semibold text-foreground mb-1.5">{label}</label>
      <div className="relative">
        <input
          type="text"
          value={search}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setSearch(e.target.value);
            onSelect(null, e.target.value);
            setOpen(true);
          }}
          placeholder={placeholder}
          className="w-full px-3.5 py-2.5 pr-9 bg-white border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/60"
        />
        <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
      {open && (
        <div className="absolute left-0 right-0 mt-1.5 max-h-48 overflow-y-auto bg-white border border-border rounded-xl shadow-xl z-20 p-1.5">
          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelect(item.id, getLabel(item));
                setSearch(getLabel(item));
                setOpen(false);
              }}
              className="w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg hover:bg-muted text-left"
            >
              <span>{getLabel(item)}</span>
              {getLabel(item).toLowerCase() === search.toLowerCase() && (
                <Check className="w-3.5 h-3.5 text-brand-emerald" />
              )}
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">Tiada padanan ditemui</p>
          )}
          {search.trim() && !exactMatch && (
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg bg-brand-sage/40 text-brand-forest hover:bg-brand-sage text-left font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{onCreateLabel(search.trim())}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function EditCeramahModal({ video, onClose, onSaved }) {
  const [title, setTitle] = useState(video?.title || "");
  const [speakers, setSpeakers] = useState([]);
  const [collections, setCollections] = useState([]);

  const [selectedSpeakerId, setSelectedSpeakerId] = useState(video?.speaker_id ?? video?.speaker?.id ?? null);
  const [speakerName, setSpeakerName] = useState(video?.speaker?.name || "");

  const [selectedCollectionId, setSelectedCollectionId] = useState(video?.collection_id ?? video?.collection?.id ?? null);
  const [collectionTitle, setCollectionTitle] = useState(video?.collection?.title || "");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setTitle(video?.title || "");
    setSelectedSpeakerId(video?.speaker_id ?? video?.speaker?.id ?? null);
    setSpeakerName(video?.speaker?.name || "");
    setSelectedCollectionId(video?.collection_id ?? video?.collection?.id ?? null);
    setCollectionTitle(video?.collection?.title || "");
    loadLists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video?.id]);

  async function loadLists() {
    try {
      const [sData, cData] = await Promise.all([fetchSpeakers(), fetchCollections()]);
      setSpeakers(sData);
      setCollections(cData);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleSave() {
    if (!video) return;
    if (!title.trim()) {
      setError("Tajuk ceramah diperlukan.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await updateVideoDetails(video.id, {
        title: title.trim(),
        speaker_id: selectedSpeakerId,
        speaker_name: speakerName.trim() || null,
        collection_id: selectedCollectionId,
        collection_title: collectionTitle.trim() || null,
      });
      onSaved?.();
      onClose?.();
    } catch (e) {
      console.error(e);
      setError("Gagal mengemaskini maklumat video. Sila cuba lagi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!video} onOpenChange={(next) => !next && onClose?.()}>
      <DialogContent className="max-w-lg p-0" showClose={false}>
        <DialogHeader className="flex-row items-center justify-between px-6 py-4 border-b border-border">
          <DialogTitle>Sunting Butiran Ceramah</DialogTitle>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <X className="w-5 h-5" />
            <span className="sr-only">Tutup</span>
          </button>
        </DialogHeader>

        <div className="p-6 space-y-5">
          {/* Thumbnail Preview Area */}
          <div className="relative aspect-video rounded-xl overflow-hidden bg-neutral-200 border border-border flex items-center justify-center group">
            {video?.thumbnail_path ? (
              <img src={video.thumbnail_path} alt="Thumbnail" className="w-full h-full object-cover" />
            ) : (
              <div className="text-muted-foreground text-xs">Tiada Gambar</div>
            )}
            <div className="absolute top-3 right-3 flex items-center gap-2">
              <button
                type="button"
                className="p-2 bg-white/90 hover:bg-white rounded-lg shadow-sm text-foreground hover:text-brand-gold transition-colors"
                title="Muat naik gambar baru"
              >
                <Upload className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="p-2 bg-white/90 hover:bg-white rounded-lg shadow-sm text-foreground hover:text-brand-gold transition-colors"
                title="Jana semula gambar"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Tajuk Ceramah */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold text-foreground">Tajuk Ceramah</label>
              <span className="text-[11px] text-muted-foreground font-mono">{title.length}/200</span>
            </div>
            <input
              type="text"
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/60"
            />
          </div>

          <Combobox
            label="Nama Koleksi Kitab"
            placeholder="Pilih atau taip nama kitab baru..."
            value={collectionTitle}
            items={collections}
            getLabel={(c) => c.title}
            onSelect={(id, name) => {
              setSelectedCollectionId(id);
              setCollectionTitle(name);
            }}
            onCreateLabel={(text) => `Tambah '${text}'`}
          />

          <Combobox
            label="Penceramah"
            placeholder="Pilih atau taip nama ustaz baru..."
            value={speakerName}
            items={speakers}
            getLabel={(s) => s.name}
            onSelect={(id, name) => {
              setSelectedSpeakerId(id);
              setSpeakerName(name);
            }}
            onCreateLabel={(text) => `Tambah '${text}'`}
          />

          {error && <p className="text-xs text-destructive font-medium">{error}</p>}
        </div>

        <DialogFooter className="px-6 py-4 bg-muted/30 border-t border-border gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground rounded-lg transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="px-5 py-2 text-xs font-semibold text-white bg-brand-gold hover:bg-brand-gold/90 rounded-lg shadow-sm transition-all disabled:opacity-50"
          >
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
