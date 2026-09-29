import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchCollections, fetchLocations, fetchSpeakers } from "@/lib/api";

/**
 * Speakers, Koleksi Kitab and Lokasi straight from the API (`GET /speakers`, `/collections`, `/locations`), including
 * entries that have no completed video yet — unlike `useLibrary()`, which derives them from videos.
 * Used by the admin pages and the Sunting Butiran dialog. `reload()` refetches all three lists.
 */
export function useEntities() {
  const [speakers, setSpeakers] = useState([]);
  const [collections, setCollections] = useState([]);
  const [locations, setLocations] = useState([]);

  const reload = useCallback(async () => {
    try {
      const [s, c, l] = await Promise.all([fetchSpeakers(), fetchCollections(), fetchLocations()]);
      setSpeakers(s);
      setCollections(c);
      setLocations(l);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const speakersById = useMemo(() => new Map(speakers.map((s) => [s.id, s])), [speakers]);
  const collectionsById = useMemo(() => new Map(collections.map((c) => [c.id, c])), [collections]);

  const locationsById = useMemo(() => new Map(locations.map((l) => [l.id, l])), [locations]);

  return { speakers, collections, locations, speakersById, collectionsById, locationsById, reload };
}
