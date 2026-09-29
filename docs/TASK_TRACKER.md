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
| **Phase 7** | Frontend Redesign — Obra shadcn/ui ([spec §8](file:///home/ahmadsalehuddin/code/personal/baitul-hikmah/docs/architecture-specs.md)) | Claude & User | **IN PROGRESS** (7.1 done) |

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
- [ ] **Claude:** Thumbnail upload + reset-to-default endpoints (admin, validated, path-contained).
- [ ] **Claude:** User text-size preference field + endpoint.
- [ ] **Claude:** `Video.series_number` field, auto-parse on download, backfill existing videos.

**7.3 Pages & components**
- [ ] **Claude:** Navbar + profile menu + phone Sheet (§8.3.3).
- [ ] **Claude:** Pustaka Ceramah: cards, Tapis, Susun, Breadcrumb, search, Empty, progressive loading (§8.3.4).
- [ ] **Claude:** Video Player Dialog + Audio mode with shared shadcn controls incl. fullscreen, auto-hide, buffering, keyboard (§8.3.5).
- [ ] **Claude:** Tambah Ceramah (§8.3.6).
- [ ] **Claude:** Sunting Butiran Ceramah dialog (§8.3.7).
- [ ] **Claude:** Urus Pustaka redesign (§8.3.8).
- [ ] **Claude:** Saiz Teks accessibility setting (§8.3.9).
- [ ] **Claude:** Responsive layouts for phone/tablet/desktop (§8.3.10).

**7.4 Verification**
- [ ] **Claude:** Clean `npm run build`; audit for §8.1 compliance (no hand-rolled components, no arbitrary values).
- [ ] **User:** Review on desktop, Dad's tablet and phone; compare against Figma mockups.
- [ ] **Gemini (optional):** Post-implementation review.
