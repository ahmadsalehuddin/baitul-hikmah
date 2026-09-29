import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { fetchCurrentUser, onDevUserChange, updateUserPreferences } from "@/lib/api";
import { applyTextSize, isValidTextSize, loadStoredTextSize, storeTextSize } from "@/lib/text-size";

const SAVE_DELAY_MS = 400;

const CurrentUserContext = createContext({
  user: null,
  isAdmin: false,
  loading: true,
  refresh: () => {},
  textSize: "biasa",
  setTextSize: () => {},
  textSizeError: false,
});

/**
 * Loads GET /api/auth/me once for the whole app and reloads it when the local-dev
 * user switcher changes the active account. Read it with `useCurrentUser()`.
 *
 * Also owns the Saiz Teks preference (spec §8.3.9): `textSize` is applied to the root font-size
 * at once, follows the user's saved value when it loads, and `setTextSize()` applies the change
 * immediately, then saves it (`PUT /auth/me/preferences`, debounced) and reverts if that fails.
 */
export function CurrentUserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [textSize, setTextSizeState] = useState(loadStoredTextSize);
  const [textSizeError, setTextSizeError] = useState(false);
  const savedSize = useRef(textSize);
  const saveTimer = useRef(null);

  const refresh = useCallback(() => {
    return fetchCurrentUser()
      .then(setUser)
      .catch((err) => {
        console.error(err);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
    return onDevUserChange(refresh);
  }, [refresh]);

  useEffect(() => {
    applyTextSize(textSize);
  }, [textSize]);

  // The saved value follows the person across devices, so it overrides the device mirror.
  useEffect(() => {
    if (!user || !isValidTextSize(user.text_size)) return;
    clearTimeout(saveTimer.current);
    savedSize.current = user.text_size;
    storeTextSize(user.text_size);
    setTextSizeState(user.text_size);
    setTextSizeError(false);
  }, [user]);

  useEffect(() => () => clearTimeout(saveTimer.current), []);

  const setTextSize = useCallback((next) => {
    if (!isValidTextSize(next)) return;
    setTextSizeState(next);
    setTextSizeError(false);
    storeTextSize(next);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await updateUserPreferences({ text_size: next });
        savedSize.current = next;
      } catch (err) {
        console.error(err);
        setTextSizeState(savedSize.current);
        storeTextSize(savedSize.current);
        setTextSizeError(true);
      }
    }, SAVE_DELAY_MS);
  }, []);

  const value = useMemo(
    () => ({ user, isAdmin: user?.role === "admin", loading, refresh, textSize, setTextSize, textSizeError }),
    [user, loading, refresh, textSize, setTextSize, textSizeError]
  );

  return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>;
}

export function useCurrentUser() {
  return useContext(CurrentUserContext);
}
