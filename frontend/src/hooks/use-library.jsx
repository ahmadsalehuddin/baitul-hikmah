import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { fetchContinueWatching, fetchSpeakers, fetchVideos, onDevUserChange } from "@/lib/api";
import { buildLibrary } from "@/lib/library";

const EMPTY = { videos: [], speakers: [], continueWatching: [] };

const LibraryContext = createContext({
  library: buildLibrary([], []),
  continueWatching: [],
  loaded: false,
  error: null,
  refresh: () => Promise.resolve(),
});

/**
 * Loads the whole library once (223 videos: client-side search/filter/sort per spec §8.3.4)
 * so the pages and the app-level player dialog share one copy. `refresh()` reloads quietly
 * (no loading flash), e.g. after the player closes so progress bars are current.
 */
export function LibraryProvider({ children }) {
  const [data, setData] = useState(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const [videos, speakers, continueWatching] = await Promise.all([
        fetchVideos(),
        fetchSpeakers(),
        fetchContinueWatching().catch(() => []),
      ]);
      setData({ videos, speakers, continueWatching });
      setError(null);
    } catch (err) {
      console.error(err);
      setError(err);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    refresh();
    // Progress and favourites are per user, so a switched dev user needs a fresh copy.
    return onDevUserChange(refresh);
  }, [refresh]);

  const library = useMemo(() => buildLibrary(data.videos, data.speakers), [data.videos, data.speakers]);

  const value = useMemo(
    () => ({ library, continueWatching: data.continueWatching, loaded, error, refresh }),
    [library, data.continueWatching, loaded, error, refresh]
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary() {
  return useContext(LibraryContext);
}
