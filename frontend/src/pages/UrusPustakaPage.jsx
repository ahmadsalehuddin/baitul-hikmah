import React, { useState, useEffect, useCallback } from "react";
import {
  HardDrive,
  Users,
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  Combine,
  Search,
  X,
  AlertTriangle,
  ShieldAlert,
  Loader2,
} from "lucide-react";
import {
  fetchStorageMetrics,
  fetchSpeakers,
  fetchCollections,
  fetchVideos,
  fetchCurrentUser,
  createSpeaker,
  updateSpeaker,
  createCollection,
  updateCollection,
  deleteCollection,
  mergeCollections,
  deleteVideo,
} from "../lib/api";
import { EditCeramahModal } from "../components/EditCeramahModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";

function formatBytes(bytes) {
  if (!bytes) return "0 GB";
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb < 1) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  if (gb < 1000) return `${gb.toFixed(1)} GB`;
  return `${(gb / 1024).toFixed(2)} TB`;
}

function formatDuration(sec) {
  if (!sec) return "00:00";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("ms-MY", { day: "2-digit", month: "short", year: "numeric" });
}

/* ---------------- Storage Health Card ---------------- */
function StorageHealthCard({ storage }) {
  if (!storage) {
    return (
      <div className="bg-white rounded-2xl border border-border p-6 flex items-center justify-center text-muted-foreground text-sm gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        Memuatkan status storan...
      </div>
    );
  }

  const percent = Math.min(100, storage.percent_used || 0);
  const barColor = percent > 90 ? "bg-destructive" : percent > 75 ? "bg-amber-500" : "bg-brand-gold";

  return (
    <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-brand-sage/60 flex items-center justify-center text-brand-emerald">
            <HardDrive className="w-4.5 h-4.5" />
          </div>
          <div>
            <h2 className="font-heading font-bold text-base text-foreground">Kesihatan Storan Pelayan</h2>
            <p className="text-xs text-muted-foreground">Cakera keras 2TB — HP Z240</p>
          </div>
        </div>
        <span className="font-mono text-sm font-semibold text-foreground">{percent.toFixed(1)}%</span>
      </div>

      <div className="w-full bg-neutral-200 h-2.5 rounded-full overflow-hidden mb-2">
        <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${percent}%` }} />
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        {formatBytes(storage.used_bytes)} digunakan daripada {formatBytes(storage.total_bytes)} &middot; {formatBytes(storage.free_bytes)} bebas
      </p>

      <div className="flex flex-wrap gap-2">
        <span className="px-3 py-1.5 bg-brand-sage/40 text-brand-forest rounded-full text-xs font-semibold">
          Video: {formatBytes(storage.videos_bytes)}
        </span>
        <span className="px-3 py-1.5 bg-brand-sage/40 text-brand-forest rounded-full text-xs font-semibold">
          Audio: {formatBytes(storage.audio_bytes)}
        </span>
        <span className="px-3 py-1.5 bg-muted text-foreground rounded-full text-xs font-semibold">
          Cache Thumbnail: {formatBytes(storage.thumbnails_bytes)}
        </span>
      </div>
    </div>
  );
}

/* ---------------- Add Speaker / Collection Dialog ---------------- */
function AddEntityDialog({ open, onClose, speakers, onCreated }) {
  const [kind, setKind] = useState("collection"); // collection | speaker
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [speakerId, setSpeakerId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setKind("collection");
      setTitle("");
      setDescription("");
      setSpeakerId("");
      setError("");
    }
  }, [open]);

  async function handleSubmit() {
    if (!title.trim()) {
      setError("Sila masukkan nama.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (kind === "collection") {
        await createCollection({
          title: title.trim(),
          description: description.trim() || null,
          speaker_id: speakerId ? Number(speakerId) : null,
        });
      } else {
        await createSpeaker({ name: title.trim(), bio: description.trim() || null });
      }
      onCreated();
      onClose();
    } catch (e) {
      setError(e?.detail || "Gagal menyimpan. Nama mungkin sudah wujud.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md p-0" showClose={false}>
        <DialogHeader className="flex-row items-center justify-between px-6 py-4 border-b border-border">
          <DialogTitle>Tambah Penceramah atau Koleksi</DialogTitle>
          <button onClick={onClose} className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted">
            <X className="w-5 h-5" />
          </button>
        </DialogHeader>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-2 bg-muted rounded-xl p-1">
            <button
              type="button"
              onClick={() => setKind("collection")}
              className={`py-2 rounded-lg text-xs font-semibold transition-colors ${
                kind === "collection" ? "bg-white shadow-sm text-brand-emerald" : "text-muted-foreground"
              }`}
            >
              Koleksi Kitab
            </button>
            <button
              type="button"
              onClick={() => setKind("speaker")}
              className={`py-2 rounded-lg text-xs font-semibold transition-colors ${
                kind === "speaker" ? "bg-white shadow-sm text-brand-emerald" : "text-muted-foreground"
              }`}
            >
              Penceramah
            </button>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              {kind === "collection" ? "Tajuk Koleksi Kitab" : "Nama Penceramah"}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={kind === "collection" ? "cth. Riyadhus Solihin" : "cth. Ustaz Azhar Idrus"}
              className="w-full px-3.5 py-2.5 bg-white border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/60"
            />
          </div>

          {kind === "collection" && (
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">Penceramah (pilihan)</label>
              <select
                value={speakerId}
                onChange={(e) => setSpeakerId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/60"
              >
                <option value="">Tiada / Pelbagai Penceramah</option>
                {speakers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              {kind === "collection" ? "Penerangan (pilihan)" : "Bio Ringkas (pilihan)"}
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-border rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-gold/60"
            />
          </div>

          {error && <p className="text-xs text-destructive font-medium">{error}</p>}
        </div>

        <DialogFooter className="px-6 py-4 bg-muted/30 border-t border-border gap-3">
          <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground rounded-lg">
            Batal
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-5 py-2 text-xs font-semibold text-white bg-brand-gold hover:bg-brand-gold/90 rounded-lg shadow-sm disabled:opacity-50"
          >
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Rename Dialog (Collection or Speaker) ---------------- */
function RenameDialog({ entity, kind, onClose, onSaved }) {
  const [name, setName] = useState(entity ? (kind === "collection" ? entity.title : entity.name) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setName(entity ? (kind === "collection" ? entity.title : entity.name) : "");
    setError("");
  }, [entity, kind]);

  async function handleSave() {
    if (!name.trim()) {
      setError("Nama diperlukan.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (kind === "collection") {
        await updateCollection(entity.id, { title: name.trim() });
      } else {
        await updateSpeaker(entity.id, { name: name.trim() });
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e?.detail || "Gagal mengemaskini nama.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!entity} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-sm p-0" showClose={false}>
        <DialogHeader className="flex-row items-center justify-between px-6 py-4 border-b border-border">
          <DialogTitle>{kind === "collection" ? "Sunting Koleksi Kitab" : "Sunting Penceramah"}</DialogTitle>
          <button onClick={onClose} className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted">
            <X className="w-5 h-5" />
          </button>
        </DialogHeader>
        <div className="p-6">
          <label className="block text-xs font-semibold text-foreground mb-1.5">Nama</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-white border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/60"
          />
          {error && <p className="text-xs text-destructive font-medium mt-2">{error}</p>}
        </div>
        <DialogFooter className="px-6 py-4 bg-muted/30 border-t border-border gap-3">
          <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground rounded-lg">
            Batal
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 text-xs font-semibold text-white bg-brand-gold hover:bg-brand-gold/90 rounded-lg shadow-sm disabled:opacity-50"
          >
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Merge Collections Dialog ---------------- */
function MergeCollectionDialog({ source, collections, onClose, onMerged }) {
  const [targetId, setTargetId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setTargetId("");
    setError("");
  }, [source]);

  const otherCollections = collections.filter((c) => c.id !== source?.id);

  async function handleMerge() {
    if (!targetId) {
      setError("Sila pilih koleksi sasaran.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await mergeCollections(source.id, Number(targetId));
      onMerged();
      onClose();
    } catch (e) {
      setError(e?.detail || "Gagal menggabungkan koleksi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!source} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-sm p-0" showClose={false}>
        <DialogHeader className="flex-row items-center justify-between px-6 py-4 border-b border-border">
          <DialogTitle>Gabungkan Koleksi</DialogTitle>
          <button onClick={onClose} className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted">
            <X className="w-5 h-5" />
          </button>
        </DialogHeader>
        <div className="p-6 space-y-3">
          <p className="text-xs text-muted-foreground">
            Semua {source?.video_count || 0} ceramah dalam <span className="font-semibold text-foreground">"{source?.title}"</span> akan
            dipindahkan ke koleksi sasaran, dan koleksi ini akan dipadam.
          </p>
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">Gabung Ke Dalam</label>
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/60"
            >
              <option value="">Pilih koleksi sasaran...</option>
              {otherCollections.map((c) => (
                <option key={c.id} value={c.id}>{c.title} ({c.video_count} ceramah)</option>
              ))}
            </select>
          </div>
          {error && <p className="text-xs text-destructive font-medium">{error}</p>}
        </div>
        <DialogFooter className="px-6 py-4 bg-muted/30 border-t border-border gap-3">
          <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground rounded-lg">
            Batal
          </button>
          <button
            onClick={handleMerge}
            disabled={saving}
            className="px-5 py-2 text-xs font-semibold text-white bg-brand-gold hover:bg-brand-gold/90 rounded-lg shadow-sm disabled:opacity-50"
          >
            {saving ? "Menggabungkan..." : "Gabungkan"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Generic Confirm Delete Dialog ---------------- */
function ConfirmDeleteDialog({ target, title, description, onClose, onConfirm }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setError(""), [target]);

  async function handleConfirm() {
    setBusy(true);
    setError("");
    try {
      await onConfirm();
      onClose();
    } catch (e) {
      setError(e?.detail || "Gagal memadam.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!target} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-sm p-0" showClose={false}>
        <div className="p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 text-destructive flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="font-heading font-bold text-base text-foreground mb-1.5">{title}</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
          {error && <p className="text-xs text-destructive font-medium mt-3">{error}</p>}
        </div>
        <DialogFooter className="px-6 py-4 bg-muted/30 border-t border-border gap-3">
          <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground rounded-lg">
            Batal
          </button>
          <button
            onClick={handleConfirm}
            disabled={busy}
            className="px-5 py-2 text-xs font-semibold text-white bg-destructive hover:bg-destructive/90 rounded-lg shadow-sm disabled:opacity-50"
          >
            {busy ? "Memadam..." : "Padam"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Main Page ---------------- */
export function UrusPustakaPage({ onGoHome }) {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [storage, setStorage] = useState(null);
  const [collections, setCollections] = useState([]);
  const [speakers, setSpeakers] = useState([]);
  const [videos, setVideos] = useState([]);
  const [loadingVideos, setLoadingVideos] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterSpeakerId, setFilterSpeakerId] = useState("");
  const [filterCollectionId, setFilterCollectionId] = useState("");

  const [addEntityOpen, setAddEntityOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState(null); // { entity, kind }
  const [mergeSource, setMergeSource] = useState(null);
  const [deleteCollectionTarget, setDeleteCollectionTarget] = useState(null);
  const [editingVideo, setEditingVideo] = useState(null);
  const [deleteVideoTarget, setDeleteVideoTarget] = useState(null);

  useEffect(() => {
    fetchCurrentUser()
      .then((u) => setIsAdmin(u?.role === "admin"))
      .catch(() => setIsAdmin(false))
      .finally(() => setAuthChecked(true));
  }, []);

  const loadStorage = useCallback(() => {
    fetchStorageMetrics().then(setStorage).catch(console.error);
  }, []);

  const loadCollectionsAndSpeakers = useCallback(() => {
    Promise.all([fetchCollections(), fetchSpeakers()])
      .then(([c, s]) => {
        setCollections(c);
        setSpeakers(s);
      })
      .catch(console.error);
  }, []);

  const loadVideos = useCallback(() => {
    setLoadingVideos(true);
    fetchVideos({
      search: searchQuery,
      speaker_id: filterSpeakerId || undefined,
      collection_id: filterCollectionId || undefined,
      sort: "date_desc",
    })
      .then(setVideos)
      .catch(console.error)
      .finally(() => setLoadingVideos(false));
  }, [searchQuery, filterSpeakerId, filterCollectionId]);

  useEffect(() => {
    if (!isAdmin) return;
    loadStorage();
    loadCollectionsAndSpeakers();
  }, [isAdmin, loadStorage, loadCollectionsAndSpeakers]);

  useEffect(() => {
    if (!isAdmin) return;
    loadVideos();
  }, [isAdmin, loadVideos]);

  function refreshAll() {
    loadStorage();
    loadCollectionsAndSpeakers();
    loadVideos();
  }

  async function handleDeleteVideo(video) {
    await deleteVideo(video.id);
    refreshAll();
  }

  async function handleDeleteCollection(collection) {
    await deleteCollection(collection.id);
    loadCollectionsAndSpeakers();
  }

  if (!authChecked) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-brand-gold animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="w-full relative min-h-screen pb-24">
        <div className="max-w-md mx-auto pt-24 px-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-100 text-destructive flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h1 className="font-heading text-2xl font-bold text-foreground mb-2">Akses Ditolak</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Hanya pentadbir dibenarkan mengurus pustaka ceramah. Sila hubungi pentadbir jika anda memerlukan akses.
          </p>
          <button onClick={onGoHome} className="text-xs font-semibold text-brand-emerald hover:underline">
            Kembali ke Laman Utama
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full relative min-h-screen pb-24">
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.035] bg-repeat"
        style={{ backgroundImage: `url('/background-pattern.svg')`, backgroundSize: "400px" }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 pt-12">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h1 className="font-heading text-4xl sm:text-5xl font-bold text-foreground mb-3 tracking-tight">
            Urus Pustaka
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
            Urus semua koleksi kitab dan penceramah di satu tempat.
          </p>
        </div>

        {/* Storage Health */}
        <div className="mb-10">
          <StorageHealthCard storage={storage} />
        </div>

        {/* Collections & Speakers */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-xl font-bold text-foreground">Koleksi Kitab & Penceramah</h2>
            <button
              onClick={() => setAddEntityOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-brand-gold hover:bg-brand-gold/90 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Penceramah atau Koleksi</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Collections */}
            <div className="bg-white rounded-2xl border border-border shadow-sm">
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
                <BookOpen className="w-4 h-4 text-brand-emerald" />
                <h3 className="font-heading font-semibold text-sm text-foreground">Koleksi Kitab ({collections.length})</h3>
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-border/60">
                {collections.length === 0 && (
                  <p className="px-5 py-6 text-xs text-muted-foreground text-center">Belum ada koleksi kitab.</p>
                )}
                {collections.map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-5 py-3 gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{c.title}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {c.video_count} ceramah{c.speaker_name ? ` • ${c.speaker_name}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setRenameTarget({ entity: c, kind: "collection" })}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                        title="Sunting"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setMergeSource(c)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                        title="Gabungkan dengan koleksi lain"
                      >
                        <Combine className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => c.video_count === 0 && setDeleteCollectionTarget(c)}
                        disabled={c.video_count > 0}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed"
                        title={c.video_count > 0 ? "Kosongkan koleksi sebelum memadam" : "Padam"}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Speakers */}
            <div className="bg-white rounded-2xl border border-border shadow-sm">
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
                <Users className="w-4 h-4 text-brand-emerald" />
                <h3 className="font-heading font-semibold text-sm text-foreground">Penceramah ({speakers.length})</h3>
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-border/60">
                {speakers.length === 0 && (
                  <p className="px-5 py-6 text-xs text-muted-foreground text-center">Belum ada penceramah.</p>
                )}
                {speakers.map((s) => (
                  <div key={s.id} className="flex items-center justify-between px-5 py-3 gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-8 h-8 rounded-full bg-brand-sage/60 text-brand-forest font-semibold text-[11px] flex items-center justify-center shrink-0">
                        {s.name?.slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {s.video_count} ceramah &middot; {s.collection_count} koleksi
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setRenameTarget({ entity: s, kind: "speaker" })}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"
                      title="Sunting"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Master Video Table */}
        <div className="mb-10">
          <h2 className="font-heading text-xl font-bold text-foreground mb-4">Senarai Pengurusan Ceramah</h2>

          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari tajuk ceramah..."
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/60"
              />
            </div>
            <select
              value={filterSpeakerId}
              onChange={(e) => setFilterSpeakerId(e.target.value)}
              className="px-3.5 py-2.5 bg-white border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/60"
            >
              <option value="">Semua Penceramah</option>
              {speakers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <select
              value={filterCollectionId}
              onChange={(e) => setFilterCollectionId(e.target.value)}
              className="px-3.5 py-2.5 bg-white border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/60"
            >
              <option value="">Semua Koleksi</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </div>

          <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="text-left font-semibold px-4 py-3">Ceramah</th>
                    <th className="text-left font-semibold px-4 py-3">Penceramah</th>
                    <th className="text-left font-semibold px-4 py-3">Koleksi</th>
                    <th className="text-left font-semibold px-4 py-3">Tempoh</th>
                    <th className="text-left font-semibold px-4 py-3">Saiz</th>
                    <th className="text-left font-semibold px-4 py-3">Tarikh</th>
                    <th className="text-right font-semibold px-4 py-3">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {loadingVideos && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground text-xs">
                        Memuatkan senarai ceramah...
                      </td>
                    </tr>
                  )}
                  {!loadingVideos && videos.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground text-xs">
                        Tiada ceramah ditemui.
                      </td>
                    </tr>
                  )}
                  {videos.map((v) => (
                    <tr key={v.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-3 max-w-xs">
                          <div className="w-16 h-10 rounded-md bg-neutral-200 overflow-hidden shrink-0">
                            {v.thumbnail_path && (
                              <img src={v.thumbnail_path} alt={v.title} className="w-full h-full object-cover" />
                            )}
                          </div>
                          <p className="text-xs font-medium text-foreground line-clamp-2">{v.title}</p>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{v.speaker?.name || "-"}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{v.collection?.title || "-"}</td>
                      <td className="px-4 py-2.5 text-xs font-mono text-muted-foreground">{formatDuration(v.duration_seconds)}</td>
                      <td className="px-4 py-2.5 text-xs font-mono text-muted-foreground">
                        {v.file_size_bytes ? formatBytes(v.file_size_bytes) : "-"}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{formatDate(v.created_at)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setEditingVideo(v)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-brand-emerald hover:bg-brand-sage/40"
                            title="Sunting"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteVideoTarget(v)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-red-50"
                            title="Padam"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <AddEntityDialog
        open={addEntityOpen}
        onClose={() => setAddEntityOpen(false)}
        speakers={speakers}
        onCreated={loadCollectionsAndSpeakers}
      />

      <RenameDialog
        entity={renameTarget?.entity}
        kind={renameTarget?.kind}
        onClose={() => setRenameTarget(null)}
        onSaved={loadCollectionsAndSpeakers}
      />

      <MergeCollectionDialog
        source={mergeSource}
        collections={collections}
        onClose={() => setMergeSource(null)}
        onMerged={() => {
          loadCollectionsAndSpeakers();
          loadVideos();
        }}
      />

      <ConfirmDeleteDialog
        target={deleteCollectionTarget}
        title="Padam Koleksi Kitab?"
        description={`Koleksi "${deleteCollectionTarget?.title || ""}" akan dipadam secara kekal. Tindakan ini hanya boleh dilakukan jika koleksi tidak mempunyai ceramah.`}
        onClose={() => setDeleteCollectionTarget(null)}
        onConfirm={() => handleDeleteCollection(deleteCollectionTarget)}
      />

      <ConfirmDeleteDialog
        target={deleteVideoTarget}
        title="Padam Ceramah Ini?"
        description={`"${deleteVideoTarget?.title || ""}" akan dipadam secara kekal dari pustaka dan storan 2TB. Tindakan ini tidak boleh dibatalkan.`}
        onClose={() => setDeleteVideoTarget(null)}
        onConfirm={() => handleDeleteVideo(deleteVideoTarget)}
      />

      {editingVideo && (
        <EditCeramahModal
          video={editingVideo}
          onClose={() => setEditingVideo(null)}
          onSaved={refreshAll}
        />
      )}
    </div>
  );
}
