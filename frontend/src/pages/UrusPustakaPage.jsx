import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { Plus } from "lucide-react";
import { AdminGate } from "@/components/AdminGate";
import { PageLayout } from "@/components/PageLayout";
import { SuntingButiranDialog } from "@/components/SuntingButiranDialog";
import { AddEntityDialog } from "@/components/urus/AddEntityDialog";
import { CollectionTab } from "@/components/urus/CollectionTab";
import { ConfirmDeleteDialog } from "@/components/urus/ConfirmDeleteDialog";
import { MergeDialog } from "@/components/urus/MergeDialog";
import { RenameDialog } from "@/components/urus/RenameDialog";
import { SpeakerTab } from "@/components/urus/SpeakerTab";
import { StorageCard } from "@/components/urus/StorageCard";
import { VideoTab } from "@/components/urus/VideoTab";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEntities } from "@/hooks/use-entities";
import { useLibrary } from "@/hooks/use-library";
import { deleteCollection, deleteVideo, fetchStorageMetrics, getDownloadTasks, retryVideoDownload } from "@/lib/api";

const TABS = ["ceramah", "koleksi", "penceramah"];

/** Urus Pustaka (spec §8.3.8): storage Card, Tabs (`?tab=`) with Tables / Card lists, dialogs for every action. */
function UrusPustaka() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.includes(params.get("tab")) ? params.get("tab") : "ceramah";

  const { library, loaded, refresh: refreshLibrary } = useLibrary();
  const { speakers, collections, reload: reloadEntities } = useEntities();
  const [storage, setStorage] = useState(null);
  const [failed, setFailed] = useState([]);

  const [adding, setAdding] = useState(false);
  const [editingVideo, setEditingVideo] = useState(null);
  const [deletingVideo, setDeletingVideo] = useState(null);
  const [renaming, setRenaming] = useState(null); // { entity, kind }
  const [merging, setMerging] = useState(null);
  const [deletingCollection, setDeletingCollection] = useState(null);

  const loadStorage = useCallback(() => {
    fetchStorageMetrics().then(setStorage).catch(console.error);
  }, []);
  const loadFailed = useCallback(() => {
    getDownloadTasks()
      .then((data) => setFailed(data.failed || []))
      .catch(console.error);
  }, []);

  useEffect(() => {
    loadStorage();
    loadFailed();
  }, [loadStorage, loadFailed]);

  // Everything a change can affect, refreshed together.
  const refreshAll = useCallback(() => {
    loadStorage();
    loadFailed();
    reloadEntities();
    refreshLibrary();
  }, [loadStorage, loadFailed, reloadEntities, refreshLibrary]);

  const videoHandlers = useMemo(
    () => ({
      onEdit: setEditingVideo,
      onDelete: setDeletingVideo,
      onRetry: async (id) => {
        try {
          await retryVideoDownload(id);
        } catch (err) {
          console.error(err);
        }
        loadFailed();
      },
    }),
    [loadFailed]
  );
  const collectionHandlers = useMemo(
    () => ({
      onRename: (entity) => setRenaming({ entity, kind: "collection" }),
      onMerge: setMerging,
      onDelete: setDeletingCollection,
    }),
    []
  );
  const speakerHandlers = useMemo(() => ({ onRename: (entity) => setRenaming({ entity, kind: "speaker" }) }), []);

  function selectTab(next) {
    setParams({ tab: next }, { replace: true });
  }

  return (
    <PageLayout title="Urus Pustaka" description="Urus semua koleksi kitab dan penceramah di satu tempat.">
      <StorageCard storage={storage} />

      <Tabs value={tab} onValueChange={selectTab} className="gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList className="max-w-full overflow-x-auto overflow-y-hidden">
            <TabsTrigger value="ceramah">Ceramah</TabsTrigger>
            <TabsTrigger value="koleksi">Koleksi Kitab</TabsTrigger>
            <TabsTrigger value="penceramah">Penceramah</TabsTrigger>
          </TabsList>
          <Button onClick={() => setAdding(true)}>
            <Plus data-icon="inline-start" />
            Tambah Penceramah atau Koleksi
          </Button>
        </div>

        <TabsContent value="ceramah" className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-200">
          <VideoTab
            loaded={loaded}
            videos={library.videoItems}
            failed={failed}
            speakers={speakers}
            collections={collections}
            handlers={videoHandlers}
          />
        </TabsContent>
        <TabsContent value="koleksi" className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-200">
          <CollectionTab collections={collections} handlers={collectionHandlers} />
        </TabsContent>
        <TabsContent value="penceramah" className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-200">
          <SpeakerTab speakers={speakers} handlers={speakerHandlers} />
        </TabsContent>
      </Tabs>

      {adding && (
        <AddEntityDialog
          speakers={speakers}
          initialKind={tab === "penceramah" ? "speaker" : "collection"}
          onClose={() => setAdding(false)}
          onCreated={reloadEntities}
        />
      )}
      {editingVideo && (
        <SuntingButiranDialog video={editingVideo} onClose={() => setEditingVideo(null)} onSaved={refreshAll} />
      )}
      {deletingVideo && (
        <ConfirmDeleteDialog
          title="Padam Ceramah Ini?"
          description={`“${deletingVideo.title}” akan dipadam secara kekal dari pustaka dan storan 2TB. Tindakan ini tidak boleh dibatalkan.`}
          onClose={() => setDeletingVideo(null)}
          onConfirm={async () => {
            await deleteVideo(deletingVideo.id);
            refreshAll();
          }}
        />
      )}
      {renaming && (
        <RenameDialog
          entity={renaming.entity}
          kind={renaming.kind}
          onClose={() => setRenaming(null)}
          onSaved={() => {
            reloadEntities();
            refreshLibrary();
          }}
        />
      )}
      {merging && (
        <MergeDialog
          source={merging}
          collections={collections}
          onClose={() => setMerging(null)}
          onMerged={() => {
            reloadEntities();
            refreshLibrary();
          }}
        />
      )}
      {deletingCollection && (
        <ConfirmDeleteDialog
          title="Padam Koleksi Kitab?"
          description={`Koleksi “${deletingCollection.title}” akan dipadam secara kekal. Tindakan ini hanya boleh dilakukan jika koleksi tidak mempunyai ceramah.`}
          onClose={() => setDeletingCollection(null)}
          onConfirm={async () => {
            await deleteCollection(deletingCollection.id);
            reloadEntities();
          }}
        />
      )}
    </PageLayout>
  );
}

export function UrusPustakaPage() {
  return (
    <AdminGate>
      <UrusPustaka />
    </AdminGate>
  );
}
