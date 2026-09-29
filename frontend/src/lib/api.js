const API_BASE = "/api";
const DEV_USER_STORAGE_KEY = "baitul_hikmah_dev_user";
const DEV_USER_CHANGE_EVENT = "baitul-hikmah:dev-user-changed";
const DEFAULT_DEV_USER_EMAIL = "admin@example.com";

export function getActiveDevUser() {
  try {
    return localStorage.getItem(DEV_USER_STORAGE_KEY) || DEFAULT_DEV_USER_EMAIL;
  } catch {
    return DEFAULT_DEV_USER_EMAIL;
  }
}

export function setActiveDevUser(email) {
  try {
    localStorage.setItem(DEV_USER_STORAGE_KEY, email);
  } catch {
    // localStorage unavailable (private browsing, etc.) - ignore
  }
  window.dispatchEvent(new CustomEvent(DEV_USER_CHANGE_EVENT, { detail: { email } }));
}

export function onDevUserChange(callback) {
  window.addEventListener(DEV_USER_CHANGE_EVENT, callback);
  return () => window.removeEventListener(DEV_USER_CHANGE_EVENT, callback);
}

async function apiFetch(path, options = {}) {
  const headers = {
    ...(options.headers || {}),
    "X-Dev-User-Email": getActiveDevUser(),
  };
  return fetch(`${API_BASE}${path}`, { ...options, headers });
}

export async function fetchVideos(params = {}) {
  const query = new URLSearchParams();
  if (params.search) query.append("search", params.search);
  if (params.speaker_id) query.append("speaker_id", params.speaker_id);
  if (params.collection_id) query.append("collection_id", params.collection_id);
  if (params.sort) query.append("sort", params.sort);
  if (params.filter_type) query.append("filter_type", params.filter_type);

  const res = await apiFetch(`/videos?${query.toString()}`);
  if (!res.ok) throw new Error("Gagal memuatkan senarai video");
  return res.json();
}

export async function batchFetchUrls(urls) {
  const res = await apiFetch(`/videos/batch-fetch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ urls }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw data;
  }
  return data;
}

export async function getDownloadTasks() {
  const res = await apiFetch(`/videos/downloads`);
  if (!res.ok) throw new Error("Gagal mendapatkan status muat turun");
  return res.json();
}

export async function updateVideoDetails(id, details) {
  const res = await apiFetch(`/videos/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(details),
  });
  if (!res.ok) throw new Error("Gagal mengemaskini butiran video");
  return res.json();
}

export async function fetchSpeakers() {
  const res = await apiFetch(`/speakers`);
  if (!res.ok) throw new Error("Gagal memuatkan senarai penceramah");
  return res.json();
}

export async function fetchCollections(speakerId = null) {
  const path = speakerId ? `/collections?speaker_id=${speakerId}` : `/collections`;
  const res = await apiFetch(path);
  if (!res.ok) throw new Error("Gagal memuatkan koleksi kitab");
  return res.json();
}

export async function fetchCurrentUser() {
  const res = await apiFetch(`/auth/me`);
  if (!res.ok) throw new Error("Gagal memuatkan profil pengguna");
  return res.json();
}

export async function fetchContinueWatching() {
  const res = await apiFetch(`/progress/continue-watching`);
  if (!res.ok) throw new Error("Gagal memuatkan senarai sambung tonton");
  return res.json();
}

export async function saveVideoProgress(videoId, payload) {
  const res = await apiFetch(`/progress/${videoId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Gagal menyimpan kemajuan tontonan");
  return res.json();
}

export async function getVideoProgress(videoId) {
  const res = await apiFetch(`/progress/${videoId}`);
  if (!res.ok) throw new Error("Gagal memuatkan kemajuan tontonan");
  return res.json();
}

export async function toggleFavoriteVideo(videoId) {
  const res = await apiFetch(`/favorites/video/${videoId}`, { method: "POST" });
  if (!res.ok) throw new Error("Gagal mengemaskini kegemaran");
  return res.json();
}

export async function toggleFavoriteSpeaker(speakerId) {
  const res = await apiFetch(`/favorites/speaker/${speakerId}`, { method: "POST" });
  if (!res.ok) throw new Error("Gagal mengemaskini penceramah kegemaran");
  return res.json();
}

export async function fetchFavoriteSpeakers() {
  const res = await apiFetch(`/favorites/speakers`);
  if (!res.ok) throw new Error("Gagal memuatkan penceramah kegemaran");
  return res.json();
}

export async function retryVideoDownload(videoId) {
  const res = await apiFetch(`/videos/${videoId}/retry`, { method: "POST" });
  if (!res.ok) throw new Error("Gagal mencuba semula muat turun");
  return res.json();
}

export async function deleteVideo(videoId) {
  const res = await apiFetch(`/videos/${videoId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Gagal memadam ceramah");
  return res.json();
}

export async function fetchStorageMetrics() {
  const res = await apiFetch(`/system/storage`);
  if (!res.ok) throw new Error("Gagal memuatkan status storan");
  return res.json();
}

export async function createSpeaker(payload) {
  const res = await apiFetch(`/speakers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw data;
  return data;
}

export async function updateSpeaker(speakerId, payload) {
  const res = await apiFetch(`/speakers/${speakerId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw data;
  return data;
}

export async function createCollection(payload) {
  const res = await apiFetch(`/collections`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw data;
  return data;
}

export async function updateCollection(collectionId, payload) {
  const res = await apiFetch(`/collections/${collectionId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw data;
  return data;
}

export async function deleteCollection(collectionId) {
  const res = await apiFetch(`/collections/${collectionId}`, { method: "DELETE" });
  const data = await res.json();
  if (!res.ok) throw data;
  return data;
}

export async function mergeCollections(sourceCollectionId, targetCollectionId) {
  const res = await apiFetch(`/collections/merge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source_collection_id: sourceCollectionId,
      target_collection_id: targetCollectionId,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw data;
  return data;
}
