# Baitul Hikmah — Master Task Tracker

This living document tracks the status of all activities across the project, clearly dividing responsibilities between **Gemini (Lead Architect & Planner)**, **Claude Code (Technical Implementer & Coder)**, and **User (System Owner & Reviewer)**.

---

## Progress Overview

| Phase | Description | Owner | Status |
| :--- | :--- | :--- | :---: |
| **Phase 0** | Architecture, Requirements & Rules Alignment | Gemini & User | **COMPLETED** |
| **Phase 1** | Database Foundation & Seed Data | Claude Code | **COMPLETED** |
| **Phase 2** | Cloudflare Auth Middleware & Progress APIs | Claude Code | **COMPLETED** |
| **Phase 3** | Video.js Player Component & Shadcn Popup Modal | Claude Code | **COMPLETED** |
| **Phase 4** | Legacy Migration (223 Videos from Ceramah Downloader) | Claude Code | **COMPLETED** |
| **Phase 5** | Total Frontend Rework & Admin Suite (Urus & Tambah) | Claude Code | **COMPLETED** |
| **Phase 6** | Containerization, Cloudflare Tunnel & HP Z240 Deployment | Claude / Gemini / User | **COMPLETED** |
| **Phase 7** | Frontend Redesign — Obra shadcn/ui ([spec §8](file:///home/ahmadsalehuddin/code/personal/baitul-hikmah/docs/architecture-specs.md)) | Claude & User | **IN PROGRESS** (7.1–7.5 implemented & deployed; user device review pending) |
| **Phase 8** | Lokasi (place of the lecture) field ([spec §8.5](file:///home/ahmadsalehuddin/code/personal/baitul-hikmah/docs/architecture-specs.md)) | Claude & User | **DEPLOYED 2026-09-29** — awaiting System Owner review |

---

## Detailed Activity Checklist

### Phase 0: Architecture, Requirements & Rules Alignment
- [x] **Gemini:** Formalize agent division of labor & constraints in [`GEMINI.md`](file:///home/ahmadsalehuddin/code/personal/baitul-hikmah/GEMINI.md).
- [x] **Gemini:** Inspect existing backend models & local storage layout.
- [x] **Gemini:** Investigate legacy `ceramah-downloader` system (`ceramah.db`, 223 videos, storage paths).
- [x] **Gemini:** Design decoupled multi-user architecture & Cloudflare Zero Trust authentication strategy.
- [x] **Gemini:** Design isolated per-user playback tracking (`UserVideoProgress`) and favorites model.
- [x] **Gemini:** Define strict hardware boundary (256GB SSD for code only, 2TB HDD for media & DB).
- [x] **Gemini:** Create and finalize [`docs/architecture-specs.md`](file:///home/ahmadsalehuddin/code/personal/baitul-hikmah/docs/architecture-specs.md).
- [x] **Gemini:** Update [`CLAUDE.md`](file:///home/ahmadsalehuddin/code/personal/baitul-hikmah/CLAUDE.md) with design token and architecture references.
- [x] **Gemini:** Formulate Threat Model & Hardening Guidelines in [`docs/architecture-specs.md#7-security-architecture--threat-model`](file:///home/ahmadsalehuddin/code/personal/baitul-hikmah/docs/architecture-specs.md).
- [x] **Gemini:** Establish living task tracker in [`docs/TASK_TRACKER.md`](file:///home/ahmadsalehuddin/code/personal/baitul-hikmah/docs/TASK_TRACKER.md).

---

### Phase 1: Database Foundation & Seed Data
*Target Implementer: Claude Code*
- [x] **Claude:** Read [`CLAUDE.md`](file:///home/ahmadsalehuddin/code/personal/baitul-hikmah/CLAUDE.md) and [`docs/architecture-specs.md`](file:///home/ahmadsalehuddin/code/personal/baitul-hikmah/docs/architecture-specs.md).
- [x] **Claude:** Update `backend/app/models/schema.py`:
  - [x] Add `Role` enum (`admin`, `viewer`).
  - [x] Add `User` model (`id`, `email`, `display_name`, `role`, `avatar_url`, `created_at`).
  - [x] Add `UserVideoProgress` model (`user_id`, `video_id`, `watch_progress_seconds`, `is_watched`, `is_favorite`, `last_watched_at`).
  - [x] Add `UserFavoriteSpeaker` model (`user_id`, `speaker_id`).
  - [x] Update `Video` model (add `channel_name`, `channel_id`, `added_by_user_id`, `audio_path`, `resolution_height`, `is_max_quality`; deprecate direct watch progress).
  - [x] Update `Collection` model (make `speaker_id` optional for multi-speaker playlists).
- [x] **Claude:** Ensure storage directory & DB path in `backend/app/core/config.py` strictly targets `/mnt/storage/media/baitul-hikmah` (with `audio/` subfolder).
- [x] **Claude:** Create `backend/scripts/seed_users.py` to seed Ahmad (Admin) and Ayah (Viewer).
- [x] **Claude:** Run verification command to test table creation and user seeding.
- [x] **Gemini:** Review code diffs and database integrity.

---

### Phase 2: Cloudflare Auth Middleware & Progress APIs
*Target Implementer: Claude Code*
- [x] **Claude:** Implement authentication middleware in `backend/app/core/auth.py`:
  - [x] Read `Cf-Access-Authenticated-User-Email` header.
  - [x] Read `X-Dev-User-Email` / local fallback when developing without Cloudflare.
  - [x] Match or auto-provision user from DB and attach to `request.state.user`.
- [x] **Claude:** Create `GET /api/auth/me` endpoint returning active user profile & role.
- [x] **Claude:** Create `POST /api/progress/{video_id}` heartbeat endpoint to save playback seconds & watched status.
- [x] **Claude:** Create `POST /api/favorites/video/{video_id}` and `POST /api/favorites/speaker/{speaker_id}` toggles.
- [x] **Claude:** Verify video streaming endpoint (`/api/stream/{video_id}`) maintains HTTP 206 Partial Content byte ranges for both `.mp4` and `.m4a` audio.
- [x] **Gemini:** Review API endpoints, permission guarding, and byte-range logic.

---

### Phase 3: Video.js Player Component & Shadcn Popup Modal
*Target Implementer: Claude Code*
- [x] **Claude:** Install `video.js` in `frontend/package.json`.
- [x] **Claude:** Create `frontend/src/components/video/VideoPlayer.jsx`:
  - [x] HTTP 206 streaming support for Video (`.mp4`) and Audio (`.m4a`).
  - [x] Mode Switcher: Video vs. Spotify-style Audio-Only mode.
  - [x] Auto-resume from `watch_progress_seconds` (seamless when switching modes).
  - [x] 5-second throttled progress heartbeat to `/api/progress/{video_id}`.
  - [x] Senior-friendly controls (big buttons, 10s skip backward/forward, speed 1x/1.25x/1.5x).
  - [x] HTML5 `navigator.mediaSession` integration for lock-screen & car Bluetooth controls.
- [x] **Claude:** Modify `frontend/src/pages/PustakaPage.jsx`:
  - [x] Clicking a video card opens Shadcn `Dialog`.
  - [x] Auto-starts `VideoPlayer`.
  - [x] Displays Title (`font-heading`), Speaker badge, Channel tag, Date, and Description.
  - [x] Action buttons: Mode Toggle, "Tandai Telah Ditonton" and "Kegemaran".
  - [x] Saving progress on dialog close.
- [x] **Claude:** Add active user profile badge and dev switcher in top navigation.
- [x] **Gemini:** Verify frontend aesthetic against Figma tokens and senior usability.

---

### Phase 4: Legacy Data Migration (223 Videos)
*Target Implementer: Claude Code*
- [x] **Claude:** Create migration script `backend/scripts/migrate_legacy.py`:
  - [x] Connect read-only to `/home/ahmadsalehuddin/code/personal/ceramah-downloader/ceramah.db`.
  - [x] Parse title structure (`Kitab | Speaker | Channel | Series`).
  - [x] Fast-remux `.mkv` / `.webm` to `.mp4` (H.264 stream-copy for `.mkv`; VP9 in `.webm` is transcoded to H.264 since iOS Safari cannot play VP9-in-MP4) into `/mnt/storage/media/baitul-hikmah/videos/`.
  - [x] Generate `.webp` thumbnails.
  - [x] Insert records into `baitul_hikmah.db` linked to Ahmad's admin ID.
- [x] **Claude:** Execute migration script on dry-run mode, then real run. Result: 221/223 migrated successfully, 2 flagged `failed` (source files missing from `/mnt/storage/media/ceramah/`: `8RXpQyysjZI`, `Rz0vVakgGXI` — can be re-downloaded via "Tambah Ceramah" using their preserved YouTube URLs). Zero writes to the SSD; ~46.5GB written to the 2TB HDD.
- [x] **Gemini:** Verify migration counts, zero storage leaks on SSD, and playback of legacy videos. (Verified: 221 completed, 2 failed on missing source, zero SSD leaks, 59GB on 2TB HDD, H.264/AAC verified, 206 streaming confirmed).

---

### Phase 5: Total Frontend Rework & Admin Suite (Urus & Tambah)
*Target Implementer: Claude Code*
- [x] **Claude:** Complete rewrite & polish of `frontend/src/pages/UrusPustakaPage.jsx`:
  - [x] Replace "Fungsi Baharu Sedang Dibangunkan" placeholder with full library management.
  - [x] Display real-time 2TB Server Storage Usage indicator (`shutil.disk_usage`).
  - [x] Manage Collections and Speakers (list, edit, delete, view video counts).
  - [x] Video management table (search, filter, edit metadata, delete/prune videos with confirmation).
  - [x] Create "Tambah Penceramah / Koleksi" modal (no detailed Figma mockup existed for this dialog — built to match the established design system/tokens instead).
- [x] **Claude:** Complete rework of `frontend/src/pages/TambahCeramahPage.jsx`:
  - [x] Real-time batch URL submission with YouTube validation.
  - [x] Active download queue with progress bar, download speed, and ETA polling.
  - [x] Refactor and polish `frontend/src/components/EditCeramahModal.jsx`.
  - [x] Low-disk warning indicator when free space on `/mnt/storage` is low.
- [x] **Claude:** Comprehensive Frontend Audit & Architecture Unification:
  - [x] Audit all remaining prototype code from Sep 24 to ensure 100% Claude-authored, production-grade quality.
  - [x] Verify responsive behavior on mobile/tablet (Dad's tablet interface) — audited via responsive Tailwind breakpoints (`sm:`/`lg:` grid collapses, `overflow-x-auto` table, stacked filters); not visually tested in a live browser since `/mnt/storage` isn't mounted in this dev sandbox.
  - [x] Ensure 100% adherence to Figma design tokens and strict RBAC guards across all pages (client-side admin gate added to both `UrusPustakaPage` and `TambahCeramahPage`, backed by existing `require_admin` server-side checks).
- [x] **Gemini:** Full UX & architectural review of the completed frontend suite. (Verified: Clean Vite build, strict backend & frontend RBAC gating on admin pages, storage usage metrics with low-disk guard, safe file unlinking within storage boundary, responsive layout and design token conformance confirmed).

**Supporting backend admin endpoints (implemented alongside the above, per brief Step 1):** `GET /api/system/storage`, `DELETE /api/videos/{id}`, `POST /api/videos/{id}/retry`, `POST`/`PUT /api/speakers`, `POST`/`PUT`/`DELETE /api/collections`, `POST /api/collections/merge`. `npm run build` verified passing with zero errors.

---

### Phase 6: Containerization, Cloudflare Tunnel & HP Z240 Deployment
*Collaborative: Claude / Gemini / User*
- [x] **Claude:** Create production `backend/Dockerfile` and `frontend/Dockerfile`.
- [x] **Claude:** Validate `docker-compose.yml` with `/mnt/storage` volume bindings.
- [x] **User & Gemini:** Configure Cloudflare Tunnel (`cloudflared`) and Zero Trust Access policy. (Verified: Tunnel `baitul-hikmah-z240` active, routing `baitulhikmah.example.com` to `frontend:80`, Zero Trust OTP policy enforced).
- [x] **Gemini & User:** Conduct end-to-end testing on Dad's tablet/device. (Verified: Live deployment active at `https://baitulhikmah.example.com`, Cloudflare Zero Trust OTP active, Ahmad Admin view verified, Dad's access ready for daily family use).

---

### Phase 7: Frontend Redesign — Obra shadcn/ui
*Target Implementer: Claude Code · Requirements reviewed with User (2026-09-28) · Spec: [`docs/architecture-specs.md` §8](file:///home/ahmadsalehuddin/code/personal/baitul-hikmah/docs/architecture-specs.md) · Coding starts only on User's go-ahead.*

**7.0 Planning**
- [x] **Claude & User:** Audit mockups vs live frontend; agree design rules (§8.1) and requirements (§8.3).
- [x] **Claude:** Record standing design rules in `architecture-specs.md` §8.1, `CLAUDE.md`, `GEMINI.md`.
- [x] **User:** Resolve open items O1–O5 (§8.3.12).
- [x] **User:** Give go-ahead to start coding. (2026-09-29; also approved React 19 upgrade and gold focus ring.)
- [ ] **Gemini (optional):** Review §8 for future tracking.

**7.1 Foundation**
- [x] **Claude:** Put repo under git; baseline commit `fd6cce0` before Phase 7.
- [x] **Claude:** Upgrade React 18 → 19 and Tailwind v3 → v4 (see §8.3.1 notes); initialise shadcn/ui CLI (`components.json`, JSX).
- [x] **Claude:** Port theme tokens (§8.2) unchanged; add approved `--warning` tokens.
- [x] **Claude:** Add React Router with routes from §8.3.1 (incl. `?tonton=<id>`).
- [x] **Claude:** Install required shadcn components (§8.3.2); add the approved `warning` variant to `alert.jsx` (§8.2 log).
- **7.1 implementation notes** (details in [`architecture-specs.md` §8.4](file:///home/ahmadsalehuddin/code/personal/baitul-hikmah/docs/architecture-specs.md)): `npm run build` passes; legacy pages still render on the new foundation and were smoke-tested in a headless browser with a mocked API (routes, `?tonton` open/Back/refresh/unknown-id). The legacy pages themselves are unchanged apart from mechanical Tailwind-v4 renames and are fully replaced in 7.3.

**7.2 Backend additions (§8.3.11)**
- [x] **Claude:** Thumbnail upload + reset-to-default endpoints (admin, validated, path-contained).
- [x] **Claude:** User text-size preference field + endpoint.
- [x] **Claude:** `Video.series_number` field, auto-parse on download, backfill existing videos.
- **7.2 implementation notes** (API shapes in [`architecture-specs.md` §8.4](file:///home/ahmadsalehuddin/code/personal/baitul-hikmah/docs/architecture-specs.md)): verified on a temp copy of the DB/media on port 8765 (live DB and media confirmed byte-identical afterwards). **Deployed to production 2026-09-29:** backend container rebuilt (columns added on startup), backfill run once (223 videos matched), DB backup at `~/baitul_hikmah.db.bak-before-7.2`. Future backend changes need `docker compose build backend && docker compose up -d --no-deps backend`.

**7.3 Pages & components**
- [x] **Claude:** Navbar + profile menu + phone Sheet (§8.3.3). *(7.3a)*
- [x] **Claude:** Pustaka Ceramah: cards, Tapis, Susun, Breadcrumb, search, Empty, progressive loading (§8.3.4). *(7.3a)*
- [x] **Claude:** Video Player Dialog + Audio mode with shared shadcn controls incl. fullscreen, auto-hide, buffering, keyboard (§8.3.5). *(7.3a)*
- [x] **Claude:** Tambah Ceramah (§8.3.6). *(7.3b)*
- [x] **Claude:** Sunting Butiran Ceramah dialog (§8.3.7).
- [x] **Claude:** Urus Pustaka redesign (§8.3.8).
- [x] **Claude:** Saiz Teks accessibility setting (§8.3.9).
- [x] **Claude:** Responsive layouts for phone/tablet/desktop (§8.3.10).

**Auth hardening (spec [§6](file:///home/ahmadsalehuddin/code/personal/baitul-hikmah/docs/architecture-specs.md) / §7.2)** — deployed 2026-09-29
- [x] **Claude:** `ENVIRONMENT` setting (default `development`, `docker-compose.yml` sets `production`). In production `_extract_email()` never reads `X-Dev-User-Email` and has no admin fallback: no identity → 401 (also on the optional-user `GET /videos`). Dev behaviour unchanged.
- [x] **Claude:** Cloudflare Access JWT verification (`Cf-Access-Jwt-Assertion`: RS256 signature via the team's JWKS, issuer, audience, expiry; identity is taken from the verified token; a mismatching `Cf-Access-Authenticated-User-Email` → 401). Active when `CF_ACCESS_TEAM_DOMAIN` and `CF_ACCESS_AUD` are set; if unset, production trusts the email header only and logs a warning.
- [x] **Claude:** nginx no longer forwards a client-supplied `X-Dev-User-Email`; the production frontend bundle no longer sends it. Verified with a throwaway backend+nginx stack (no header 401, spoofed `X-Dev-User-Email` 401, `Cf-…-Email` viewer + spoofed `X-Dev-User-Email` stays viewer) and a 15-case JWT test (wrong key/audience/issuer, expired, `alg:none`, mismatch, forged email header).
- [x] **User:** copy the **AUD tag** and **team domain** from Cloudflare Zero Trust into `.env` (`CF_ACCESS_AUD`, `CF_ACCESS_TEAM_DOMAIN`, see `.env.example`).
- [x] **Claude & User:** deploy and verify. Admin login and Log Keluar confirmed by the user in a fresh session; `curl http://127.0.0.1:3000/api/auth/me` with no headers, a spoofed `X-Dev-User-Email` or a forged email header all return 401. **Still to confirm: Ayah's login.** *Found in production:* after the Zero Trust team was renamed to `your-team`, Cloudflare kept issuing tokens with the old issuer `https://your-team.cloudflareaccess.com` and the old team name no longer resolves, so the backend accepts both issuers (`CF_ACCESS_EXTRA_ISSUERS`, defaulted in `docker-compose.yml`; the signature and AUD are still verified) and old sessions fail Log Keluar until the user logs in again. The login page heading still shows the old name: it is the Access "Organization name" (Zero Trust → Settings → Custom pages → Access login page), cosmetic.

**7.4 Verification**
- [x] **Claude:** Clean `npm run build`; audit for §8.1 compliance (no hand-rolled components, no arbitrary values). *(Findings and items needing a decision: `architecture-specs.md` §8.4, "7.3b items 5–7".)*
- [ ] **User:** Review on desktop, Dad's tablet and phone; compare against Figma mockups.
- [ ] **Gemini (optional):** Post-implementation review.

**7.5 Frontend polish & performance**
- [x] **Claude:** Unblock the backend event loop: `POST /videos/batch-fetch` now runs `fetch_video_metadata` (yt-dlp) via `run_in_threadpool`. UX unchanged: pasting URLs does nothing until "Muat Naik" is clicked.
- [x] **Claude:** Micro-animations using only built-in Tailwind utilities and `tw-animate-css` (no arbitrary values, no token changes; wrapped in `motion-safe:` so "reduce motion" disables them): hover lift + thumbnail/avatar zoom + soft shadow on `VideoCard`, `SpeakerCard`, `CollectionCard`; fade/slide-in on `TabsContent`. Dialogs already fade/zoom via shadcn, so unchanged.
- [x] **User (decision):** the tabs fade-in must not live in the generated `components/ui/tabs.jsx` (§8.1.2). Resolved: reverted `tabs.jsx` to generated state; the animation classes are `className` on the three `TabsContent` in `UrusPustakaPage.jsx` (spec §8.4 Phase 7.5).
- [x] **Claude:** `batch-fetch` multi-URL: metadata lookups now run in parallel (`asyncio.gather` over `run_in_threadpool`); duplicate videos in one paste (same YouTube id, any URL form) and repeated invalid links are collapsed; fixed a pre-existing bug where every queued video except the last serialized as `{}`. Tested with a mocked `yt-dlp` (3 lookups of 1s each returned in ~1.1s).
- [x] **Claude:** `npm run build` passes.
- [x] **Claude:** Deployed to production 2026-09-29 (`docker compose build backend frontend && docker compose up -d --no-deps backend frontend`; commits `7b53b85`, `0914551`). Implementation notes: [`architecture-specs.md` §8.4 Phase 7.5](file:///home/ahmadsalehuddin/code/personal/baitul-hikmah/docs/architecture-specs.md).
- [ ] **User:** Test on the live site (hard-refresh): paste 3–5 links incl. a duplicate on Tambah Ceramah (one card per unique video, site stays responsive during the fetch); check card hover and Urus Pustaka tab transitions.

### Phase 8: Lokasi (place of the lecture)
*Planned 2026-09-29, implemented and deployed 2026-09-29. Spec + implementation notes: [`architecture-specs.md` §8.5](file:///home/ahmadsalehuddin/code/personal/baitul-hikmah/docs/architecture-specs.md).*

- [x] **User:** Go-ahead to start, and open items L1–L3 all resolved 2026-09-29. Go-ahead given; **implement in a new session**. Name: **Lokasi**.
- [x] **Claude:** Backend: `Location` table + `Video.location_id`; `GET/POST/PUT/DELETE /locations` + `POST /locations/merge`; `PUT /videos/{id}` accepts `location_id` / `location_name`; nested `location` in video payloads.
- [x] **Claude:** Sunting Butiran: **Lokasi** picker (`EntityCombobox`).
- [x] **Claude:** Urus Pustaka: new **Lokasi** tab (Sunting / Gabung / Padam), like Koleksi Kitab (§8.5 item 7).
- [x] **Claude (System Owner request 2026-09-29):** the "Tambah Penceramah atau Koleksi" button is now **specific to the active tab**: *Tambah Koleksi Kitab* / *Tambah Penceramah* / *Tambah Lokasi*; on the Ceramah tab it is *Tambah Ceramah* (links to `/tambah`). The Radio Group in the add dialog is gone (one dialog per kind).
- [x] **Claude:** Player: Lokasi Badge from `video.location` with the **`MapPin`** icon (replaces the awkward `CirclePlay` channel Badge).
- [x] **Claude:** One-off backfill script `backend/scripts/backfill_location.py` (backs up the DB first; idempotent; `--dry-run`). Verified on a copy of the live DB: 66 linked (42 / 21 / 3), 156 left empty. **Not yet run on the live DB — runs at deploy.**
- [x] **Claude:** Best-effort auto-fill in `batch-fetch` (known-name match, then place-keyword segment); never blocks a download.
- [x] **Claude:** Spec implementation notes written (§8.5).
- [x] **Claude (bug found while testing, fixed):** *Gabung* on Koleksi Kitab silently orphaned the moved videos (their `collection_id` became empty). Same fix applied to the new Lokasi merge. Details in §8.5 notes. **The live library may already contain videos orphaned by past merges — see the note; needs a System Owner decision.**
- [x] **Claude:** Deployed 2026-09-29 (commits `23d1cb4` merge fix, `8af8820` Lokasi; no downloads were running; DB backed up first as `baitul_hikmah.db.bak-pre-lokasi-*`). Backfill run on the live DB: 66 videos linked (Masjid Al Ghaffar Jasin 42, Madrasah Al Ikhlas 21, Masjid As Sobirin 3), 156 left empty; its own backup is `baitul_hikmah.db.bak-20260929-180814`.
- [ ] **User:** Review on the live site.

