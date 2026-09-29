// The video player dialog is driven by the ?tonton=<id> query param (spec §8.3.1):
// it opens on top of any page, a refresh/share reopens it, browser Back closes it.

export const TONTON_PARAM = "tonton";

/** `to` for a <Link> that opens video `id` on top of the current page. Pair with `TONTON_LINK_STATE`. */
export function tontonTo(location, id) {
  const params = new URLSearchParams(location.search);
  params.set(TONTON_PARAM, String(id));
  return { pathname: location.pathname, search: `?${params.toString()}` };
}

/** Marks the history entry as pushed by us, so closing the dialog can go Back instead of stacking entries. */
export const TONTON_LINK_STATE = { tontonPushed: true };

export function getTontonId(search) {
  const value = Number(new URLSearchParams(search).get(TONTON_PARAM));
  return Number.isInteger(value) && value > 0 ? value : null;
}
