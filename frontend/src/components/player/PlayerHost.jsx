import React, { useCallback, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { PlayerDialog } from "@/components/player/PlayerDialog";
import { useLibrary } from "@/hooks/use-library";
import { TONTON_PARAM, getTontonId } from "@/lib/tonton";

/**
 * App-level owner of the ?tonton=<id> player dialog (spec §8.3.1/§8.3.5): it lives outside the
 * routes so the dialog opens on top of any page. Opening pushes a history entry (see
 * `tontonTo`), so browser Back closes it; a direct or refreshed URL reopens it.
 */
export function PlayerHost() {
  const location = useLocation();
  const navigate = useNavigate();
  const { library, loaded, refresh } = useLibrary();

  const tontonId = getTontonId(location.search);
  const video = tontonId ? library.videosById.get(tontonId) ?? null : null;

  // Keep the last video mounted while the dialog animates closed.
  const lastVideoRef = useRef(null);
  if (video) lastVideoRef.current = video;

  function withoutTonton() {
    const params = new URLSearchParams(location.search);
    params.delete(TONTON_PARAM);
    const search = params.toString();
    return { pathname: location.pathname, search: search ? `?${search}` : "" };
  }

  // Unknown or removed video id in the URL: drop the param once the library has loaded.
  useEffect(() => {
    if (tontonId && loaded && !video) navigate(withoutTonton(), { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tontonId, loaded, video]);

  function handleRequestClose() {
    if (location.state?.tontonPushed) navigate(-1);
    else navigate(withoutTonton(), { replace: true });
  }

  // Refresh once the last position is saved, so progress bars and Sambung Tonton are current.
  const handleClosed = useCallback((saved) => void Promise.resolve(saved).finally(refresh), [refresh]);

  return (
    <PlayerDialog
      video={video ?? lastVideoRef.current}
      open={Boolean(video)}
      onRequestClose={handleRequestClose}
      onClosed={handleClosed}
    />
  );
}
