import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchCollections, fetchSpeakers } from "@/lib/api";

/**
 * Speakers and Koleksi Kitab straight from the API (`GET /speakers`, `GET /collections`), including
 * entries that have no completed video yet — unlike `useLibrary()`, which derives them from videos.
 * Used by the admin pages and the Sunting Butiran dialog. `reload()` refetches both lists.
 */
export function useEntities() {
  const [speakers, setSpeakers] = useState([]);
  const [collections, setCollections] = useState([]);

  const reload = useCallback(async () => {
    try {
      const [s, c] = await Promise.all([fetchSpeakers(), fetchCollections()]);
      setSpeakers(s);
      setCollections(c);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const speakersById = useMemo(() => new Map(speakers.map((s) => [s.id, s])), [speakers]);
  const collectionsById = useMemo(() => new Map(collections.map((c) => [c.id, c])), [collections]);

  return { speakers, collections, speakersById, collectionsById, reload };
}
