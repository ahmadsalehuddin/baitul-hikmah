import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { fetchCurrentUser, onDevUserChange } from "@/lib/api";

const CurrentUserContext = createContext({
  user: null,
  isAdmin: false,
  loading: true,
  refresh: () => {},
});

/**
 * Loads GET /api/auth/me once for the whole app and reloads it when the local-dev
 * user switcher changes the active account. Read it with `useCurrentUser()`.
 */
export function CurrentUserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

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

  const value = useMemo(
    () => ({ user, isAdmin: user?.role === "admin", loading, refresh }),
    [user, loading, refresh]
  );

  return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>;
}

export function useCurrentUser() {
  return useContext(CurrentUserContext);
}
