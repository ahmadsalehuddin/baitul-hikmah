import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrushCleaning, HardDriveDownload, Link2, TriangleAlert, Upload, VideoOff } from "lucide-react";
import { AdminGate } from "@/components/AdminGate";
import { EmptyState } from "@/components/EmptyState";
import { PageLayout } from "@/components/PageLayout";
import { DownloadCard } from "@/components/tambah/DownloadCard";
import { FailedDownloads } from "@/components/tambah/FailedDownloads";
import { SuntingButiranDialog } from "@/components/SuntingButiranDialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { useEntities } from "@/hooks/use-entities";
import { useLibrary } from "@/hooks/use-library";
import { batchFetchUrls, fetchStorageMetrics, getDownloadTasks, retryVideoDownload } from "@/lib/api";
import { formatFileSize } from "@/lib/format";
import { MIN_FREE_BYTES } from "@/lib/storage";

const MAX_LINKS = 5;
const POLL_MS = 3000;

function splitUrls(raw) {
  return raw
    .split(/[\s,]+/)
    .map((u) => u.trim())
    .filter(Boolean);
}

/**
 * Tambah Ceramah (spec §8.3.6). Cards show what this visit queued or saw downloading — not the
 * whole recent history — so the page starts with the "Tiada Ceramah Untuk Ditambah" Empty state.
 */
function TambahCeramah() {
  const { refresh: refreshLibrary } = useLibrary();
  const { speakersById, collectionsById, reload: reloadEntities } = useEntities();

  const [urlsInput, setUrlsInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [problem, setProblem] = useState(null); // { title, urls: [] }
  const [tasks, setTasks] = useState({ active: [], recent: [], failed: [] });
  const [trackedIds, setTrackedIds] = useState([]); // newest batch first, pasted order inside a batch
  const [storage, setStorage] = useState(null);
  const [retryingId, setRetryingId] = useState(null);
  const [editingVideo, setEditingVideo] = useState(null);

  // Last known record per tracked id (a just-queued video is not in the poll result yet).
  const knownRef = useRef(new Map());
  const activeCountRef = useRef(0);

  const track = useCallback((videos) => {
    videos.forEach((v) => knownRef.current.set(v.id, v));
    setTrackedIds((prev) => {
      const fresh = videos.map((v) => v.id).filter((id) => !prev.includes(id));
      return fresh.length ? [...fresh, ...prev] : prev;
    });
  }, []);

  const loadTasks = useCallback(async () => {
    try {
      const data = await getDownloadTasks();
      const next = { active: data.active || [], recent: data.recent || [], failed: data.failed || [] };
      [...next.recent, ...next.failed, ...next.active].forEach((v) => {
        if (knownRef.current.has(v.id)) knownRef.current.set(v.id, v);
      });
      // Anything already downloading when the page opens belongs on it too.
      const seen = next.active.filter((v) => !knownRef.current.has(v.id));
      if (seen.length) track([...seen].reverse());
      setTasks(next);
      // A download finished: the library has a new video.
      if (next.active.length < activeCountRef.current) refreshLibrary();
      activeCountRef.current = next.active.length;
    } catch (err) {
      console.error(err);
    }
  }, [track, refreshLibrary]);

  const loadStorage = useCallback(() => {
    fetchStorageMetrics().then(setStorage).catch(console.error);
  }, []);

  useEffect(() => {
    loadTasks();
    loadStorage();
    const timer = setInterval(() => {
      if (!document.hidden) loadTasks();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [loadTasks, loadStorage]);

  const links = useMemo(() => splitUrls(urlsInput), [urlsInput]);
  const tooMany = links.length > MAX_LINKS;
  const lowDisk = storage ? storage.free_bytes < MIN_FREE_BYTES : false;
  const uploadDisabled = submitting || links.length === 0 || tooMany || lowDisk;

  const cards = trackedIds.map((id) => knownRef.current.get(id)).filter((v) => v && v.status !== "failed");

  async function handleSubmit(event) {
    event.preventDefault();
    if (uploadDisabled) return;
    setSubmitting(true);
    setProblem(null);
    try {
      const res = await batchFetchUrls(links);
      if (res.invalid_urls?.length) {
        setProblem({ title: `${res.invalid_urls.length} pautan tidak sah/ditemui`, urls: res.invalid_urls });
      }
      if (res.queued?.length) {
        track(res.queued);
        setUrlsInput("");
      }
      loadTasks();
      loadStorage();
    } catch (err) {
      console.error(err);
      if (err?.invalid_urls?.length) {
        setProblem({ title: `${err.invalid_urls.length} pautan tidak sah/ditemui`, urls: err.invalid_urls });
      } else {
        setProblem({ title: "Gagal memproses pautan. Sila cuba lagi.", urls: [] });
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleClear() {
    setUrlsInput("");
    setProblem(null);
  }

  async function handleRetry(videoId) {
    setRetryingId(videoId);
    try {
      const video = await retryVideoDownload(videoId);
      track([video]);
      await loadTasks();
    } catch (err) {
      console.error(err);
      setProblem({ title: "Gagal mencuba semula muat turun.", urls: [] });
    } finally {
      setRetryingId(null);
    }
  }

  function handleSaved() {
    loadTasks();
    reloadEntities();
    refreshLibrary();
  }

  const linkInput = (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <Field data-invalid={tooMany || undefined}>
        <InputGroup>
          <InputGroupAddon>
            <Link2 />
          </InputGroupAddon>
          <InputGroupInput
            type="text"
            value={urlsInput}
            onChange={(e) => setUrlsInput(e.target.value)}
            disabled={lowDisk}
            aria-invalid={tooMany}
            aria-label="Pautan YouTube"
            placeholder="Masukkan sehingga 5 pautan YouTube pada satu masa…"
            autoComplete="off"
          />
        </InputGroup>
        {tooMany && <FieldError>Maksimum 5 pautan pada satu masa.</FieldError>}
      </Field>
      <div className="flex flex-wrap justify-end gap-3">
        <Button type="button" variant="outline" onClick={handleClear}>
          <BrushCleaning data-icon="inline-start" />
          Kosongkan Pautan
        </Button>
        <Button type="submit" disabled={uploadDisabled}>
          {submitting ? <Spinner data-icon="inline-start" /> : <Upload data-icon="inline-start" />}
          Muat Naik
        </Button>
      </div>
    </form>
  );

  return (
    <PageLayout
      title="Tambah Ceramah"
      description="Muat naik video ceramah ke dalam pustaka anda menggunakan pautan YouTube."
      header={linkInput}
    >
      {(lowDisk || problem) && (
        <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
          {lowDisk && (
            <Alert variant="warning">
              <HardDriveDownload />
              <AlertTitle>Ruang storan pada cakera 2TB tidak mencukupi</AlertTitle>
              <AlertDescription>
                Hanya {formatFileSize(storage.free_bytes)} ruang kosong berbaki. Muat turun dilumpuhkan buat sementara
                waktu sehingga sekurang-kurangnya 20 GB ruang kosong tersedia. Sila padam ceramah lama di "Urus
                Pustaka" untuk membebaskan ruang.
              </AlertDescription>
            </Alert>
          )}
          {problem && (
            <Alert variant="warning">
              <TriangleAlert />
              <AlertTitle>{problem.title}</AlertTitle>
              {problem.urls.length > 0 && (
                <AlertDescription>
                  <p>Sila pastikan pautan berikut adalah dari YouTube dan sah/aktif:</p>
                  <ul className="mt-2 list-disc pl-5 break-all">
                    {problem.urls.map((url) => (
                      <li key={url}>{url}</li>
                    ))}
                  </ul>
                </AlertDescription>
              )}
            </Alert>
          )}
        </div>
      )}

      <FailedDownloads videos={tasks.failed} retryingId={retryingId} onRetry={handleRetry} />

      {cards.length === 0 ? (
        <EmptyState
          icon={VideoOff}
          title="Tiada Ceramah Untuk Ditambah"
          description="Masukkan pautan di atas dan klik butang 'Muat Naik' untuk mula menambah ceramah."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {cards.map((video) => (
            <DownloadCard
              key={video.id}
              video={video}
              speakerName={speakersById.get(video.speaker_id)?.name}
              collectionTitle={collectionsById.get(video.collection_id)?.title}
              onEdit={setEditingVideo}
            />
          ))}
        </div>
      )}

      {editingVideo && (
        <SuntingButiranDialog video={editingVideo} onClose={() => setEditingVideo(null)} onSaved={handleSaved} />
      )}
    </PageLayout>
  );
}

export function TambahCeramahPage() {
  return (
    <AdminGate>
      <TambahCeramah />
    </AdminGate>
  );
}
