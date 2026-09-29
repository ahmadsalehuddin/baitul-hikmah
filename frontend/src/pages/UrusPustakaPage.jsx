import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Plus } from "lucide-react";
import { AdminGate } from "@/components/AdminGate";
import { PageLayout } from "@/components/PageLayout";
import { SuntingButiranDialog } from "@/components/SuntingButiranDialog";
import { AddEntityDialog } from "@/components/urus/AddEntityDialog";
import { CollectionTab } from "@/components/urus/CollectionTab";
import { ConfirmDeleteDialog } from "@/components/urus/ConfirmDeleteDialog";
import { LocationTab } from "@/components/urus/LocationTab";
import { MergeDialog } from "@/components/urus/MergeDialog";
import { RenameDialog } from "@/components/urus/RenameDialog";
import { SpeakerTab } from "@/components/urus/SpeakerTab";
import { StorageCard } from "@/components/urus/StorageCard";
import { VideoTab } from "@/components/urus/VideoTab";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEntities } from "@/hooks/use-entities";
import { useLibrary } from "@/hooks/use-library";
import {
  deleteCollection,
  deleteLocation,
  deleteSpeaker,
  deleteVideo,
  fetchStorageMetrics,
  getDownloadTasks,
  retryVideoDownload,
} from "@/lib/api";

const TABS = ["ceramah", "koleksi", "penceramah", "lokasi"];

// The add button follows the active tab: it adds exactly what that tab lists (Ceramah goes to /tambah).
const ADD_BUTTONS = {
  koleksi: { kind: "collection", label: "Tambah Koleksi Kitab" },
  penceramah: { kind: "speaker", label: "Tambah Penceramah" },
  lokasi: { kind: "location", label: "Tambah Lokasi" },
};

const DELETE_CONFIRMATIONS = {
  collection: {
    title: "Padam Koleksi Kitab?",
    description: (c) => `Koleksi “${c.title}” akan dipadam secara kekal. Tindakan ini hanya boleh dilakukan jika koleksi tidak mempunyai ceramah.`,
    remove: deleteCollection,
  },
  speaker: {
    title: "Padam Penceramah?",
    description: (s) => `Penceramah “${s.name}” akan dipadam secara kekal. Tindakan ini hanya boleh dilakukan jika penceramah tidak mempunyai ceramah atau koleksi kitab.`,
    remove: deleteSpeaker,
  },
  location: {
    title: "Padam Lokasi?",
    description: (l) => `Lokasi “${l.name}” akan dipadam secara kekal. Tindakan ini hanya boleh dilakukan jika lokasi tidak mempunyai ceramah.`,
    remove: deleteLocation,
  },
};

/** Urus Pustaka (spec §8.3.8): storage Card, Tabs (`?tab=`) with Tables / Card lists, dialogs for every action. */
function UrusPustaka() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.includes(params.get("tab")) ? params.get("tab") : "ceramah";

  const { library, loaded, refresh: refreshLibrary } = useLibrary();
  const { speakers, collections, locations, reload: reloadEntities } = useEntities();
  const [storage, setStorage] = useState(null);
  const [failed, setFailed] = useState([]);

  const [adding, setAdding] = useState(null); // entity kind being added, or null
  const [editingVideo, setEditingVideo] = useState(null);
  const [deletingVideo, setDeletingVideo] = useState(null);
  const [renaming, setRenaming] = useState(null); // { entity, kind }
  const [merging, setMerging] = useState(null); // { entity, kind }
  const [deletingEntity, setDeletingEntity] = useState(null); // { entity, kind }

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
      onMerge: (entity) => setMerging({ entity, kind: "collection" }),
      onDelete: (entity) => setDeletingEntity({ entity, kind: "collection" }),
    }),
    []
  );
  const locationHandlers = useMemo(
    () => ({
      onRename: (entity) => setRenaming({ entity, kind: "location" }),
      onMerge: (entity) => setMerging({ entity, kind: "location" }),
      onDelete: (entity) => setDeletingEntity({ entity, kind: "location" }),
    }),
    []
  );
  const speakerHandlers = useMemo(
    () => ({
      onRename: (entity) => setRenaming({ entity, kind: "speaker" }),
      onMerge: (entity) => setMerging({ entity, kind: "speaker" }),
      onDelete: (entity) => setDeletingEntity({ entity, kind: "speaker" }),
    }),
    []
  );

  const addButton = ADD_BUTTONS[tab];
  const mergeLists = { collection: collections, speaker: speakers, location: locations };

  function selectTab(next) {
    setParams({ tab: next }, { replace: true });
  }

  return (
    <PageLayout title="Urus Pustaka" description="Urus semua koleksi kitab, penceramah dan lokasi di satu tempat.">
      <StorageCard storage={storage} />

      <Tabs value={tab} onValueChange={selectTab} className="gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList className="max-w-full overflow-x-auto overflow-y-hidden">
            <TabsTrigger value="ceramah">Ceramah</TabsTrigger>
            <TabsTrigger value="koleksi">Koleksi Kitab</TabsTrigger>
            <TabsTrigger value="penceramah">Penceramah</TabsTrigger>
            <TabsTrigger value="lokasi">Lokasi</TabsTrigger>
          </TabsList>
          {addButton ? (
            <Button onClick={() => setAdding(addButton.kind)}>
              <Plus data-icon="inline-start" />
              {addButton.label}
            </Button>
          ) : (
            <Button asChild>
              <Link to="/tambah">
                <Plus data-icon="inline-start" />
                Tambah Ceramah
              </Link>
            </Button>
          )}
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
        <TabsContent value="lokasi" className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-200">
          <LocationTab locations={locations} handlers={locationHandlers} />
        </TabsContent>
      </Tabs>

      {adding && (
        <AddEntityDialog
          kind={adding}
          speakers={speakers}
          onClose={() => setAdding(null)}
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
          source={merging.entity}
          kind={merging.kind}
          entities={mergeLists[merging.kind]}
          onClose={() => setMerging(null)}
          onMerged={() => {
            reloadEntities();
            refreshLibrary();
          }}
        />
      )}
      {deletingEntity && (
        <ConfirmDeleteDialog
          title={DELETE_CONFIRMATIONS[deletingEntity.kind].title}
          description={DELETE_CONFIRMATIONS[deletingEntity.kind].description(deletingEntity.entity)}
          onClose={() => setDeletingEntity(null)}
          onConfirm={async () => {
            await DELETE_CONFIRMATIONS[deletingEntity.kind].remove(deletingEntity.entity.id);
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
