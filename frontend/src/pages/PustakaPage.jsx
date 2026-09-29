import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { Search, X, SlidersHorizontal, ArrowUpDown, Clock, Check, User } from "lucide-react";
import { fetchVideos, fetchSpeakers, fetchContinueWatching } from "../lib/api";
import { VideoModal } from "../components/video/VideoModal";

export function PustakaPage() {
  const [videos, setVideos] = useState([]);
  const [speakers, setSpeakers] = useState([]);
  const [continueWatching, setContinueWatching] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSpeaker, setActiveSpeaker] = useState(null);
  const [sortOption, setSortOption] = useState("date_desc"); // date_desc, date_asc, title_asc, title_desc
  const [filterType, setFilterType] = useState("all"); // all, videos, speakers, collections

  const [tapisOpen, setTapisOpen] = useState(false);
  const [susunOpen, setSusunOpen] = useState(false);

  // The player dialog is driven by the ?tonton=<id> query param (spec §8.3.1):
  // refresh/share reopens it, browser Back closes it.
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const tontonId = Number(searchParams.get("tonton")) || null;
  const lastVideoRef = useRef(null);

  // Load videos from backend
  useEffect(() => {
    loadData();
  }, [searchQuery, activeSpeaker, sortOption]);

  async function loadData() {
    setLoading(true);
    try {
      const [vData, sData, cwData] = await Promise.all([
        fetchVideos({
          search: searchQuery,
          speaker_id: activeSpeaker?.id,
          sort: sortOption,
        }),
        fetchSpeakers(),
        fetchContinueWatching(),
      ]);
      setVideos(vData);
      setSpeakers(sData);
      setContinueWatching(cwData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function openVideo(video) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("tonton", String(video.id));
        return next;
      },
      { state: { tontonPushed: true } }
    );
  }

  function continueWatchingToVideo(item) {
    return {
      id: item.id,
      title: item.title,
      duration_seconds: item.duration_seconds,
      thumbnail_path: item.thumbnail_path,
      speaker: item.speaker,
      collection: item.collection,
      user_progress: {
        watch_progress_seconds: item.watch_progress_seconds,
        is_watched: false,
        is_favorite: false,
      },
    };
  }

  const selectedVideo = tontonId
    ? videos.find((v) => v.id === tontonId) ||
      (() => {
        const item = continueWatching.find((c) => c.id === tontonId);
        return item ? continueWatchingToVideo(item) : null;
      })()
    : null;

  useEffect(() => {
    if (selectedVideo) lastVideoRef.current = selectedVideo;
  }, [selectedVideo]);

  // Unknown or removed video id in the URL: drop the param once data has loaded.
  useEffect(() => {
    if (tontonId && !loading && !selectedVideo) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("tonton");
          return next;
        },
        { replace: true }
      );
    }
  }, [tontonId, loading, selectedVideo, setSearchParams]);

  function handleCloseModal() {
    if (location.state?.tontonPushed) {
      navigate(-1);
    } else {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("tonton");
          return next;
        },
        { replace: true }
      );
    }
    loadData();
  }

  function formatDuration(sec) {
    if (!sec) return "00:00";
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  }

  function formatRelativeDate(dateStr) {
    if (!dateStr) return "Baru sahaja";
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days <= 0) return "Hari ini";
    if (days === 1) return "Semalam";
    if (days < 7) return `${days} hari lalu`;
    const weeks = Math.floor(days / 7);
    return `${weeks} minggu lalu`;
  }

  return (
    <div className="w-full relative min-h-screen pb-24">
      {/* Background Decorative Arabesque Pattern */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.035] bg-repeat"
        style={{ backgroundImage: `url('/background-pattern.svg')`, backgroundSize: '400px' }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 pt-12">
        {/* Hero Section */}
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h1 className="font-heading text-4xl sm:text-5xl font-bold text-foreground mb-3 tracking-tight">
            Pustaka Ceramah
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
            Cari dan tonton kesemua koleksi ceramah secara terus dari dalam pustaka.
          </p>

          {/* Search Bar */}
          <div className="mt-8 relative max-w-2xl mx-auto">
            <div className="relative flex items-center">
              <Search className="w-5 h-5 text-muted-foreground absolute left-4 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Taip tajuk ceramah, koleksi kitab atau penceramah untuk memulakan carian"
                className="w-full pl-12 pr-10 py-3.5 bg-white border border-border rounded-xl text-sm placeholder:text-muted-foreground/80 focus:outline-hidden focus:ring-2 focus:ring-brand-gold/60 shadow-xs transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Sambung Tonton (Continue Watching) Shelf */}
        {continueWatching.length > 0 && !searchQuery && !activeSpeaker && (
          <div className="mb-8">
            <h2 className="font-heading text-lg sm:text-xl font-bold text-foreground mb-3">
              Sambung Tonton
            </h2>
            <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
              {continueWatching.map((item) => (
                <div
                  key={`cw-${item.id}`}
                  onClick={() => openVideo(item)}
                  className="group cursor-pointer bg-white rounded-xl overflow-hidden border border-border hover:shadow-lg hover:border-brand-gold/40 transition-all shrink-0 w-64 snap-start"
                >
                  <div className="relative w-full aspect-video bg-muted overflow-hidden">
                    {item.thumbnail_path ? (
                      <img
                        src={item.thumbnail_path}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full bg-neutral-300 flex items-center justify-center text-muted-foreground">
                        <Clock className="w-8 h-8 opacity-40" />
                      </div>
                    )}
                    <div className="absolute bottom-2 right-2 bg-black/80 text-white font-mono text-[11px] px-1.5 py-0.5 rounded">
                      {formatDuration(item.duration_seconds)}
                    </div>
                    {item.duration_seconds > 0 && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
                        <div
                          className="h-full bg-brand-gold"
                          style={{
                            width: `${Math.min(
                              100,
                              (item.watch_progress_seconds / item.duration_seconds) * 100
                            )}%`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <h3 className="font-heading font-semibold text-sm text-foreground line-clamp-2 leading-snug group-hover:text-brand-emerald transition-colors">
                      {item.title}
                    </h3>
                    {item.speaker && (
                      <p className="text-xs text-muted-foreground/80 mt-1.5">{item.speaker.name}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Breadcrumb & Filter/Sort Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4 mb-6 border-b border-border/50">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
            <button
              onClick={() => setActiveSpeaker(null)}
              className="hover:text-brand-emerald transition-colors"
            >
              Laman Utama
            </button>
            {activeSpeaker && (
              <>
                <span>&gt;</span>
                <span className="font-semibold text-foreground">{activeSpeaker.name}</span>
              </>
            )}
            {searchQuery && (
              <>
                <span>&gt;</span>
                <span className="font-semibold text-foreground">Mencari "{searchQuery}"</span>
              </>
            )}
          </nav>

          {/* Filter & Sort Popovers */}
          <div className="flex items-center gap-3 relative">
            {/* Tapis (Filter) Button */}
            <div className="relative">
              <button
                onClick={() => { setTapisOpen(!tapisOpen); setSusunOpen(false); }}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg border text-xs sm:text-sm font-medium transition-all ${
                  tapisOpen ? "bg-muted border-foreground/30 shadow-inner" : "bg-white border-border hover:bg-muted/50"
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Tapis</span>
              </button>

              {tapisOpen && (
                <div className="absolute right-0 sm:left-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-border p-2 z-30 animate-in fade-in zoom-in-95">
                  <p className="text-[11px] font-bold text-muted-foreground px-2 py-1 uppercase tracking-wider">Tapis Carian</p>
                  <button
                    onClick={() => { setFilterType("all"); setTapisOpen(false); }}
                    className="w-full flex items-center justify-between px-2.5 py-2 text-xs rounded-lg hover:bg-muted text-left"
                  >
                    <span>Semua Kandungan</span>
                    {filterType === "all" && <Check className="w-3.5 h-3.5 text-brand-emerald" />}
                  </button>
                  <button
                    onClick={() => { setFilterType("videos"); setTapisOpen(false); }}
                    className="w-full flex items-center justify-between px-2.5 py-2 text-xs rounded-lg hover:bg-muted text-left"
                  >
                    <span>Video Ceramah</span>
                    {filterType === "videos" && <Check className="w-3.5 h-3.5 text-brand-emerald" />}
                  </button>
                  <button
                    onClick={() => { setFilterType("speakers"); setTapisOpen(false); }}
                    className="w-full flex items-center justify-between px-2.5 py-2 text-xs rounded-lg hover:bg-muted text-left"
                  >
                    <span>Penceramah</span>
                    {filterType === "speakers" && <Check className="w-3.5 h-3.5 text-brand-emerald" />}
                  </button>
                </div>
              )}
            </div>

            {/* Susun (Sort) Button */}
            <div className="relative">
              <button
                onClick={() => { setSusunOpen(!susunOpen); setTapisOpen(false); }}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg border text-xs sm:text-sm font-medium transition-all ${
                  susunOpen ? "bg-muted border-foreground/30 shadow-inner" : "bg-white border-border hover:bg-muted/50"
                }`}
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                <span>Susun</span>
              </button>

              {susunOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-border p-2 z-30 animate-in fade-in zoom-in-95">
                  <p className="text-[11px] font-bold text-muted-foreground px-2 py-1 uppercase tracking-wider">Mengikut Abjad</p>
                  <button
                    onClick={() => { setSortOption("title_asc"); setSusunOpen(false); }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg hover:bg-muted text-left"
                  >
                    <span>A - Z</span>
                    {sortOption === "title_asc" && <Check className="w-3.5 h-3.5 text-brand-emerald" />}
                  </button>
                  <button
                    onClick={() => { setSortOption("title_desc"); setSusunOpen(false); }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg hover:bg-muted text-left"
                  >
                    <span>Z - A</span>
                    {sortOption === "title_desc" && <Check className="w-3.5 h-3.5 text-brand-emerald" />}
                  </button>

                  <div className="my-1 border-t border-border" />
                  <p className="text-[11px] font-bold text-muted-foreground px-2 py-1 uppercase tracking-wider">Mengikut Tarikh Muat Naik</p>
                  <button
                    onClick={() => { setSortOption("date_desc"); setSusunOpen(false); }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg hover:bg-muted text-left"
                  >
                    <span>Sekarang - Dulu</span>
                    {sortOption === "date_desc" && <Check className="w-3.5 h-3.5 text-brand-emerald" />}
                  </button>
                  <button
                    onClick={() => { setSortOption("date_asc"); setSusunOpen(false); }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg hover:bg-muted text-left"
                  >
                    <span>Dulu - Sekarang</span>
                    {sortOption === "date_asc" && <Check className="w-3.5 h-3.5 text-brand-emerald" />}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Video & Speaker Grid (4 columns) */}
        {loading ? (
          <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-3 border-brand-gold border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Memuatkan ceramah...</p>
          </div>
        ) : videos.length === 0 && speakers.length === 0 ? (
          <div className="py-20 text-center max-w-sm mx-auto">
            <p className="text-lg font-heading font-semibold text-foreground mb-1">Pustaka Masih Kosong</p>
            <p className="text-xs text-muted-foreground mb-6">Belum ada video ceramah yang dimuat turun.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {/* Show speakers cards if not filtered out */}
            {filterType !== "videos" && !activeSpeaker && speakers.map((speaker) => (
              <div
                key={`speaker-${speaker.id}`}
                onClick={() => setActiveSpeaker(speaker)}
                className="group cursor-pointer bg-white rounded-xl overflow-hidden border border-border hover:shadow-md hover:border-brand-emerald/30 transition-all flex flex-col"
              >
                <div className="w-full aspect-video bg-muted/60 flex items-center justify-center relative group-hover:bg-brand-sage/40 transition-colors">
                  <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-xs border border-border">
                    <User className="w-8 h-8 text-brand-emerald" />
                  </div>
                </div>
                <div className="p-3.5 flex flex-col">
                  <h3 className="font-heading font-bold text-base text-foreground group-hover:text-brand-emerald transition-colors line-clamp-1">
                    {speaker.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {speaker.video_count || 0} ceramah {speaker.collection_count ? `dan ${speaker.collection_count} koleksi kitab` : ""}
                  </p>
                </div>
              </div>
            ))}

            {/* Video Cards */}
            {filterType !== "speakers" && videos.map((video) => (
              <div
                key={video.id}
                onClick={() => openVideo(video)}
                className="group cursor-pointer bg-white rounded-xl overflow-hidden border border-border hover:shadow-lg hover:border-brand-gold/40 transition-all flex flex-col"
              >
                {/* Thumbnail with duration overlay */}
                <div className="relative w-full aspect-video bg-muted overflow-hidden">
                  {video.thumbnail_path ? (
                    <img
                      src={video.thumbnail_path}
                      alt={video.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full bg-neutral-300 flex items-center justify-center text-muted-foreground">
                      <Clock className="w-8 h-8 opacity-40" />
                    </div>
                  )}

                  {/* Duration Badge */}
                  <div className="absolute bottom-2 right-2 bg-black/80 text-white font-mono text-[11px] px-1.5 py-0.5 rounded">
                    {formatDuration(video.duration_seconds)}
                  </div>

                  {/* Watch Progress Bar (if partially watched) */}
                  {video.watch_progress_seconds > 0 && video.duration_seconds > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
                      <div
                        className="h-full bg-brand-gold"
                        style={{
                          width: `${Math.min(
                            100,
                            (video.watch_progress_seconds / video.duration_seconds) * 100
                          )}%`,
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Card Info */}
                <div className="p-3.5 flex flex-col flex-1">
                  <h3 className="font-heading font-semibold text-sm text-foreground line-clamp-2 leading-snug group-hover:text-brand-emerald transition-colors">
                    {video.title}
                  </h3>
                  {video.collection && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                      {video.collection.title}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground/80 mt-auto pt-2">
                    {video.speaker ? `${video.speaker.name} • ` : ""}
                    {formatRelativeDate(video.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <VideoModal video={selectedVideo ?? lastVideoRef.current} open={Boolean(selectedVideo)} onClose={handleCloseModal} />
    </div>
  );
}
