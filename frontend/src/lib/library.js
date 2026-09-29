// Pure helpers that turn the flat video list into the three card kinds of the
// Pustaka Ceramah grid (video / Koleksi Kitab / Penceramah) and filter, sort and
// search them client-side (spec §8.3.4: no backend paging this phase).
import { parseApiDate } from "@/lib/format";

export const KINDS = ["video", "collection", "speaker"];

export const SORT_OPTIONS = {
  date_desc: "Sekarang - Dulu",
  date_asc: "Dulu - Sekarang",
  title_asc: "A - Z",
  title_desc: "Z - A",
  series_asc: "Siri 1 - N",
  series_desc: "Siri N - 1",
};

function normalize(text) {
  return String(text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function unique(values) {
  return [...new Set(values)];
}

/** Group the flat API data into video, collection and speaker items. */
export function buildLibrary(videos, speakers) {
  const speakerRecords = new Map(speakers.map((s) => [s.id, s]));

  const videoItems = videos.map((v) => ({
    ...v,
    kind: "video",
    key: `v-${v.id}`,
    sortTitle: v.title,
    newestMs: parseApiDate(v.created_at),
    oldestMs: parseApiDate(v.created_at),
    searchText: normalize(`${v.title} ${v.collection?.title ?? ""} ${v.speaker?.name ?? ""}`),
  }));

  const byCollection = new Map();
  const bySpeaker = new Map();
  for (const v of videoItems) {
    if (v.collection) {
      if (!byCollection.has(v.collection.id)) byCollection.set(v.collection.id, []);
      byCollection.get(v.collection.id).push(v);
    }
    if (v.speaker) {
      if (!bySpeaker.has(v.speaker.id)) bySpeaker.set(v.speaker.id, []);
      bySpeaker.get(v.speaker.id).push(v);
    }
  }

  const collectionItems = [...byCollection.entries()].map(([id, vids]) => {
    // Speakers ordered by how much of the collection they cover, then by name.
    const counts = new Map();
    for (const v of vids) if (v.speaker) counts.set(v.speaker.id, (counts.get(v.speaker.id) ?? 0) + 1);
    const speakerIds = [...counts.keys()];
    const names = new Map(vids.filter((v) => v.speaker).map((v) => [v.speaker.id, v.speaker.name]));
    speakerIds.sort((a, b) => counts.get(b) - counts.get(a) || names.get(a).localeCompare(names.get(b), "ms"));
    const speakerNames = speakerIds.map((sid) => names.get(sid));

    // Cover = Siri 1 (lowest series number), else the oldest upload.
    const cover = [...vids].sort(
      (a, b) => (a.series_number ?? Infinity) - (b.series_number ?? Infinity) || a.oldestMs - b.oldestMs
    )[0];

    const title = vids[0].collection.title;
    return {
      kind: "collection",
      key: `c-${id}`,
      id,
      title,
      sortTitle: title,
      speakerIds,
      speakerNames,
      videoCount: vids.length,
      thumbnail_path: cover.thumbnail_path,
      newestMs: Math.max(...vids.map((v) => v.newestMs)),
      oldestMs: Math.min(...vids.map((v) => v.oldestMs)),
      searchText: normalize(`${title} ${speakerNames.join(" ")}`),
    };
  });

  const speakerItems = [...bySpeaker.entries()].map(([id, vids]) => {
    const name = vids[0].speaker.name;
    return {
      kind: "speaker",
      key: `s-${id}`,
      id,
      name,
      sortTitle: name,
      avatar_url: speakerRecords.get(id)?.avatar_url ?? null,
      videoCount: vids.length,
      collectionCount: unique(vids.filter((v) => v.collection).map((v) => v.collection.id)).length,
      newestMs: Math.max(...vids.map((v) => v.newestMs)),
      oldestMs: Math.min(...vids.map((v) => v.oldestMs)),
      searchText: normalize(name),
    };
  });

  return {
    videoItems,
    collectionItems,
    speakerItems,
    videosById: new Map(videoItems.map((v) => [v.id, v])),
    collectionsById: new Map(collectionItems.map((c) => [c.id, c])),
    speakersById: new Map(speakerItems.map((s) => [s.id, s])),
  };
}

/** Which card kinds a view can contain (drives the Tapis options). */
export function availableKinds(mode) {
  if (mode === "speaker") return ["video", "collection"];
  if (mode === "collection") return [];
  return KINDS;
}

/** The unfiltered items for a view: `mode` is home | speaker | collection | search. */
export function itemsForView(library, { mode, id, query }) {
  const { videoItems, collectionItems, speakerItems } = library;
  if (mode === "speaker") {
    return [
      ...videoItems.filter((v) => v.speaker?.id === id),
      ...collectionItems.filter((c) => c.speakerIds.includes(id)),
    ];
  }
  if (mode === "collection") {
    return videoItems.filter((v) => v.collection?.id === id);
  }
  const all = [...videoItems, ...collectionItems, ...speakerItems];
  if (mode === "search") {
    const tokens = normalize(query).split(/\s+/).filter(Boolean);
    return all.filter((item) => tokens.every((t) => item.searchText.includes(t)));
  }
  return all;
}

/** Keep only the ticked kinds; "Kegemaran Sahaja" keeps favourite videos only. */
export function filterItems(items, { kinds, favouritesOnly }) {
  return items.filter((item) => {
    if (!kinds.has(item.kind)) return false;
    if (favouritesOnly) return item.kind === "video" && Boolean(item.user_progress?.is_favorite);
    return true;
  });
}

const collator = new Intl.Collator("ms", { sensitivity: "base", numeric: true });

export function sortItems(items, sort) {
  const sorted = [...items];
  const byKey = (a, b) => collator.compare(a.key, b.key);
  switch (sort) {
    case "date_asc":
      return sorted.sort((a, b) => a.oldestMs - b.oldestMs || byKey(a, b));
    case "title_asc":
      return sorted.sort((a, b) => collator.compare(a.sortTitle, b.sortTitle) || byKey(a, b));
    case "title_desc":
      return sorted.sort((a, b) => collator.compare(b.sortTitle, a.sortTitle) || byKey(a, b));
    case "series_asc":
    case "series_desc": {
      const dir = sort === "series_asc" ? 1 : -1;
      // Videos without a series number always go last.
      return sorted.sort((a, b) => {
        const sa = a.series_number ?? null;
        const sb = b.series_number ?? null;
        if (sa === null && sb === null) return a.oldestMs - b.oldestMs || byKey(a, b);
        if (sa === null) return 1;
        if (sb === null) return -1;
        return (sa - sb) * dir || a.oldestMs - b.oldestMs;
      });
    }
    default:
      return sorted.sort((a, b) => b.newestMs - a.newestMs || byKey(a, b));
  }
}

/** "Ustaz A", "Ustaz A dan Ustaz B", "Ustaz A, Ustaz B dan lain". */
export function formatSpeakerNames(names) {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} dan ${names[1]}`;
  return `${names[0]}, ${names[1]} dan lain`;
}
