import React, { useState, useEffect, useMemo } from "react";
import {
  Link2,
  Trash2,
  Upload,
  AlertTriangle,
  VideoOff,
  Pencil,
  Clock,
  HardDrive,
  RotateCcw,
  XCircle,
  HardDriveDownload,
  ShieldAlert,
  Loader2,
} from "lucide-react";
import {
  batchFetchUrls,
  getDownloadTasks,
  retryVideoDownload,
  fetchStorageMetrics,
  fetchCurrentUser,
} from "../lib/api";
import { EditCeramahModal } from "../components/EditCeramahModal";

const YOUTUBE_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/;
const MIN_FREE_BYTES = 20 * 1024 * 1024 * 1024; // 20GB low-disk safeguard

function splitUrls(raw) {
  return raw
    .split(/[\n,\s]+/)
    .map((u) => u.trim())
    .filter((u) => u.length > 0);
}

function formatBytes(bytes) {
  if (!bytes) return "0 GB";
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb < 1) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  return `${gb.toFixed(1)} GB`;
}

export function TambahCeramahPage({ onGoHome }) {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [urlsInput, setUrlsInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [invalidUrls, setInvalidUrls] = useState([]);
  const [warningMessage, setWarningMessage] = useState("");
  const [downloadTasks, setDownloadTasks] = useState({ active: [], recent: [], failed: [] });
  const [editingVideo, setEditingVideo] = useState(null);
  const [storage, setStorage] = useState(null);
  const [retryingId, setRetryingId] = useState(null);

  useEffect(() => {
    fetchCurrentUser()
      .then((u) => setIsAdmin(u?.role === "admin"))
      .catch(() => setIsAdmin(false))
      .finally(() => setAuthChecked(true));
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    loadTasks();
    loadStorage();
    const interval = setInterval(loadTasks, 3000); // Poll status every 3s
    return () => clearInterval(interval);
  }, [isAdmin]);

  async function loadTasks() {
    try {
      const data = await getDownloadTasks();
      setDownloadTasks({ active: data.active || [], recent: data.recent || [], failed: data.failed || [] });
    } catch (e) {
      console.error(e);
    }
  }

  async function loadStorage() {
    try {
      const data = await fetchStorageMetrics();
      setStorage(data);
    } catch (e) {
      console.error(e);
    }
  }

  const candidateUrls = useMemo(() => splitUrls(urlsInput), [urlsInput]);
  const inputInvalidUrls = useMemo(
    () => candidateUrls.filter((u) => !YOUTUBE_REGEX.test(u)),
    [candidateUrls]
  );
  const tooManyUrls = candidateUrls.length > 5;
  const lowDiskSpace = storage ? storage.free_bytes < MIN_FREE_BYTES : false;

  async function handleUpload() {
    if (!urlsInput.trim() || tooManyUrls || lowDiskSpace) return;
    setLoading(true);
    setInvalidUrls([]);
    setWarningMessage("");

    try {
      const res = await batchFetchUrls(candidateUrls);
      if (res.invalid_urls && res.invalid_urls.length > 0) {
        setInvalidUrls(res.invalid_urls);
        setWarningMessage(res.message || `${res.invalid_urls.length} pautan tidak sah/ditemui`);
      }
      if (res.queued && res.queued.length > 0) {
        setUrlsInput("");
      }
      loadTasks();
      loadStorage();
    } catch (err) {
      console.error(err);
      if (err.invalid_urls) {
        setInvalidUrls(err.invalid_urls);
        setWarningMessage(err.message || "Pautan yang dimasukkan tidak sah.");
      } else {
        setWarningMessage("Gagal memproses pautan. Sila cuba lagi.");
      }
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setUrlsInput("");
    setInvalidUrls([]);
    setWarningMessage("");
  }

  async function handleRetry(videoId) {
    setRetryingId(videoId);
    try {
      await retryVideoDownload(videoId);
      loadTasks();
    } catch (e) {
      console.error(e);
      alert("Gagal mencuba semula muat turun.");
    } finally {
      setRetryingId(null);
    }
  }

  function formatDuration(sec) {
    if (!sec) return "00m 00s";
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s < 10 ? "0" : ""}${s}s`;
  }

  function formatFileSize(bytes) {
    if (!bytes) return "0 MB";
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(0)} MB`;
  }

  function formatEta(sec) {
    if (!sec && sec !== 0) return "";
    if (sec < 60) return `${sec}s lagi`;
    const m = Math.floor(sec / 60);
    return `${m}m lagi`;
  }

  const uploadDisabled = loading || !urlsInput.trim() || tooManyUrls || lowDiskSpace;
  const hasContent = downloadTasks.active.length > 0 || downloadTasks.recent.length > 0 || downloadTasks.failed.length > 0;

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
            Hanya pentadbir dibenarkan menambah ceramah baharu. Sila hubungi pentadbir jika anda memerlukan akses.
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
      {/* Background Decorative Arabesque Pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.035] bg-repeat"
        style={{ backgroundImage: `url('/background-pattern.svg')`, backgroundSize: "400px" }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 pt-12">
        {/* Title Section */}
        <div className="text-center max-w-2xl mx-auto mb-8">
          <h1 className="font-heading text-4xl sm:text-5xl font-bold text-foreground mb-3 tracking-tight">
            Tambah Ceramah
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
            Muat naik video ceramah ke dalam pustaka anda menggunakan pautan YouTube.
          </p>

          {/* Low disk space warning banner */}
          {lowDiskSpace && (
            <div className="mt-6 max-w-2xl mx-auto p-4 bg-red-50 border border-red-300 rounded-xl text-red-900 flex items-start gap-3 text-left animate-in fade-in">
              <HardDriveDownload className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-xs sm:text-sm">Ruang storan pada cakera 2TB tidak mencukupi</p>
                <p className="text-xs text-red-800/90 mt-0.5">
                  Hanya {formatBytes(storage?.free_bytes)} ruang kosong berbaki. Muat turun dilumpuhkan buat sementara
                  waktu sehingga sekurang-kurangnya 20 GB ruang kosong tersedia. Sila padam ceramah lama di "Urus
                  Pustaka" untuk membebaskan ruang.
                </p>
              </div>
            </div>
          )}

          {/* URL Input Box */}
          <div className="mt-8 relative max-w-2xl mx-auto">
            <div className="relative flex items-start">
              <Link2 className="w-5 h-5 text-muted-foreground absolute left-4 top-4 pointer-events-none" />
              <textarea
                rows={3}
                value={urlsInput}
                onChange={(e) => setUrlsInput(e.target.value)}
                disabled={lowDiskSpace}
                placeholder="Tampal sehingga 5 pautan YouTube, setiap satu pada baris baharu..."
                className="w-full pl-12 pr-4 py-3.5 bg-white border border-border rounded-xl text-sm placeholder:text-muted-foreground/80 focus:outline-hidden focus:ring-2 focus:ring-brand-gold/60 shadow-xs resize-none disabled:opacity-60 disabled:bg-muted"
              />
            </div>

            {/* Live validation hints */}
            <div className="flex items-center justify-between mt-2 px-1 text-[11px] text-muted-foreground">
              <span>
                {candidateUrls.length > 0 &&
                  `${candidateUrls.length} pautan dimasukkan${tooManyUrls ? " (maksimum 5)" : ""}`}
              </span>
              {inputInvalidUrls.length > 0 && (
                <span className="text-amber-700 font-medium">
                  {inputInvalidUrls.length} pautan kelihatan tidak sah
                </span>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 mt-4">
              <button
                type="button"
                onClick={handleClear}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-border hover:bg-muted text-foreground rounded-lg text-xs font-semibold shadow-xs transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5 opacity-70" />
                <span>Kosongkan Pautan</span>
              </button>

              <button
                type="button"
                disabled={uploadDisabled}
                onClick={handleUpload}
                className="flex items-center gap-2 px-5 py-2 bg-brand-gold hover:bg-brand-gold/90 text-white rounded-lg text-xs font-semibold shadow-xs transition-all disabled:opacity-50"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{loading ? "Memproses..." : "Muat Naik"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Warning Alert Box (matching Pautan Masalah.png) */}
        {invalidUrls.length > 0 && (
          <div className="max-w-2xl mx-auto mb-10 p-4 bg-amber-50/70 border border-amber-300 rounded-xl text-amber-900 animate-in fade-in">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-xs sm:text-sm">
                  {invalidUrls.length} pautan tidak sah/ditemui
                </p>
                <p className="text-xs text-amber-800/90 mt-0.5">
                  Sila pastikan pautan berikut adalah dari YouTube dan sah/aktif:
                </p>
                <ul className="mt-2 space-y-1 list-disc list-inside text-xs text-amber-900 font-mono">
                  {invalidUrls.map((u, i) => (
                    <li key={i} className="truncate">{u}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {warningMessage && invalidUrls.length === 0 && (
          <div className="max-w-2xl mx-auto mb-10 p-4 bg-amber-50/70 border border-amber-300 rounded-xl text-amber-900 text-xs sm:text-sm font-medium animate-in fade-in">
            {warningMessage}
          </div>
        )}

        {/* Failed Downloads Section */}
        {downloadTasks.failed.length > 0 && (
          <div className="mb-8">
            <h2 className="font-heading text-lg font-bold text-foreground mb-3 flex items-center gap-2">
              <XCircle className="w-4 h-4 text-destructive" />
              Muat Turun Gagal
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {downloadTasks.failed.map((video) => (
                <div
                  key={video.id}
                  className="bg-white rounded-xl border border-red-200 p-4 flex flex-col gap-2 shadow-xs"
                >
                  <h4 className="font-heading font-semibold text-sm text-foreground line-clamp-1">{video.title}</h4>
                  <p className="text-xs text-red-700/90 line-clamp-2 font-mono">
                    {video.error_message || "Ralat tidak diketahui semasa muat turun."}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleRetry(video.id)}
                    disabled={retryingId === video.id}
                    className="mt-2 w-full py-2 px-3 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{retryingId === video.id ? "Mencuba semula..." : "Cuba Semula"}</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active & Recent Download Cards */}
        {!hasContent ? (
          /* Empty State (matching Tiada Pautan.png) */
          <div className="py-24 text-center max-w-sm mx-auto">
            <div className="w-12 h-12 rounded-full bg-brand-sage/40 flex items-center justify-center mx-auto mb-4 text-brand-emerald">
              <VideoOff className="w-6 h-6" />
            </div>
            <h3 className="font-heading font-semibold text-base text-foreground mb-1">
              Tiada Ceramah Untuk Ditambah
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Masukkan pautan di atas dan klik butang 'Muat Naik' untuk mula menambah ceramah.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
            {[...downloadTasks.active, ...downloadTasks.recent].map((video) => (
              <div
                key={video.id}
                className="bg-white rounded-2xl overflow-hidden border border-border shadow-xs flex flex-col hover:border-border/80 transition-all"
              >
                {/* Thumbnail Preview Area */}
                <div className="relative w-full aspect-video bg-neutral-200">
                  {video.thumbnail_path ? (
                    <img src={video.thumbnail_path} alt={video.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-neutral-200 flex items-center justify-center text-muted-foreground">
                      <Clock className="w-6 h-6 opacity-30" />
                    </div>
                  )}
                </div>

                {/* Card Content */}
                <div className="p-3.5 flex flex-col flex-1">
                  <h4 className="font-heading font-bold text-sm text-foreground line-clamp-1">{video.title}</h4>

                  <div className="mt-2 space-y-1 text-xs">
                    <div>
                      <span className="text-[10px] text-muted-foreground block uppercase font-medium">Koleksi Kitab</span>
                      <span className="text-foreground line-clamp-1 font-medium">
                        {video.collection?.title || "Belum ditentukan"}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-muted-foreground block uppercase font-medium">Penceramah</span>
                      <span className="text-foreground line-clamp-1 font-medium">
                        {video.speaker?.name || "Ustaz"}
                      </span>
                    </div>
                  </div>

                  {/* Badges for duration and size */}
                  <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{formatDuration(video.duration_seconds)}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <HardDrive className="w-3.5 h-3.5" />
                      <span>{formatFileSize(video.file_size_bytes)}</span>
                    </span>
                  </div>

                  {/* Sunting Butiran Button */}
                  {video.status === "completed" && (
                    <button
                      type="button"
                      onClick={() => setEditingVideo(video)}
                      className="w-full mt-3 py-2 px-3 bg-brand-sage/50 hover:bg-brand-sage text-brand-forest rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Sunting Butiran</span>
                    </button>
                  )}
                </div>

                {/* Progress Bar & Status (bottom) */}
                <div className="px-3.5 pb-3.5 pt-1 border-t border-border/50">
                  <div className="w-full bg-neutral-200 h-1.5 rounded-full overflow-hidden mb-2">
                    <div
                      className="bg-brand-gold h-full rounded-full transition-all duration-300"
                      style={{ width: `${video.progress_percent || 0}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-muted-foreground">
                    <span>
                      {video.status === "completed"
                        ? "Muat naik selesai."
                        : video.status === "downloading"
                        ? `${video.download_speed || "Memuat turun"}${
                            video.eta_seconds ? ` • ${formatEta(video.eta_seconds)}` : ""
                          }`
                        : "Dalam giliran..."}
                    </span>
                    <span className="font-mono font-medium">{Math.round(video.progress_percent || 0)}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingVideo && (
        <EditCeramahModal
          video={editingVideo}
          onClose={() => setEditingVideo(null)}
          onSaved={loadTasks}
        />
      )}
    </div>
  );
}
