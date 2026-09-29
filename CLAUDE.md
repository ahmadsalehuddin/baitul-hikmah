# Baitul Hikmah - Claude Development Guide

## Project Overview
**Baitul Hikmah** is a personal, self-hosted Islamic lecture ("Ceramah") archival and streaming portal built for the user's father. It runs on an **HP Z240 home server (Ubuntu, 2TB storage)**.
The primary goal is to fetch YouTube lecture videos via URL before they are removed by uploaders, archive them locally on the server, and provide a clean, senior-friendly, YouTube-like viewing experience with zero friction.

---

## Tech Stack & Architecture

### Frontend (`/frontend`)
- **Framework:** React 18 + Vite
- **Styling:** Tailwind CSS + Shadcn UI custom tokens
- **Icons:** `lucide-react`
- **Language/Locale:** Bahasa Melayu (Malay)

### Backend (`/backend`)
- **Framework:** FastAPI (Python 3.11+) + Uvicorn
- **Database:** SQLite via SQLModel (`storage/baitul_hikmah.db`)
- **Downloader Engine:** `yt-dlp` with ffmpeg conversion to MP4 and WebP thumbnails
- **Streaming:** HTTP 206 Partial Content (HTTP Byte Range Requests) for instant video scrubbing on iOS Safari and modern browsers.

### Storage Layout (Dedicated folder on 2TB HDD at `/mnt/storage/media/baitul-hikmah`)
- `/mnt/storage/media/baitul-hikmah/videos/*.mp4` — Downloaded lecture videos.
- `/mnt/storage/media/baitul-hikmah/thumbnails/*.webp` — Extracted video thumbnails.
- `/mnt/storage/media/baitul-hikmah/baitul_hikmah.db` — SQLite database with `Video`, `Speaker`, `Collection` models.
- Note: The existing `/mnt/storage/media/ceramah` folder remains completely untouched and isolated.
- The app codebase is on the 256GB SSD, while media and DB live in `/mnt/storage/media/baitul-hikmah` on the 2TB drive.

---

## Architectural Source of Truth & Design References
- **Architecture Specifications:** [`docs/architecture-specs.md`](file:///home/ahmadsalehuddin/code/personal/baitul-hikmah/docs/architecture-specs.md) contains the authoritative data models (User, Role, UserVideoProgress, Video, Speaker, Collection), Cloudflare Zero Trust auth strategy, legacy migration plan, and storage rules.
- **Figma UI Mockups:** [`docs/design/figma-ui/`](file:///home/ahmadsalehuddin/code/personal/baitul-hikmah/docs/design/figma-ui/) contains visual screenshots of pages (`Pustaka Ceramah Page.png`, `Menu Profile.png`, `Sunting Butiran Ceramah.png`, etc.).
- **Figma Design Tokens:** [`docs/design/figma-variables/`](file:///home/ahmadsalehuddin/code/personal/baitul-hikmah/docs/design/figma-variables/) contains the exact JSON tokens for colors, shadows, typography, and spacing.
- **Master Task Tracker:** [`docs/TASK_TRACKER.md`](file:///home/ahmadsalehuddin/code/personal/baitul-hikmah/docs/TASK_TRACKER.md) tracks project progress and task checklists. When completing an assigned task, update its checkbox (`[x]`).

---

## Design System & Figma Tokens

### Typography (Google Fonts)
- **Headings (`font-heading`):** `'Reem Kufi', sans-serif`
- **Body (`font-sans`):** `'Lato', sans-serif`
- **Monospace (`font-mono`):** `'Geist Mono', monospace`

### Color Palette
- **Background:** `#FAFAF9` (Warm stone neutral)
- **Foreground:** `#022C22` (Deep Emerald 950)
- **Primary / Brand Accent:** `#96742B` (Islamic Antique Gold / Brass)
- **Secondary:** `#E6F4EA` (Soft Sage Green)
- **Secondary Foreground:** `#14532D` (Forest Green)
- **Muted / Border:** `#E5E5E5`
- **Card:** `#FFFFFF`
- **Base Border Radius:** `8px` (`0.5rem`)

### Assets
- **Logo:** `frontend/public/logo.png` and `frontend/src/assets/logo.png`
- **Arabesque Pattern:** `frontend/public/background-pattern.svg` and `frontend/src/assets/background-pattern.svg`

---

## Developer Commands

### Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py
# Server runs on http://127.0.0.1:8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# Dev server runs on http://127.0.0.1:3000 (proxies /api to 127.0.0.1:8000)
```

---

## Critical Development Guidelines
1. **Video Streaming:** Always ensure endpoints serving video (`/api/stream/{video_id}`) support **HTTP 206 Partial Content** using byte ranges so seeking/scrubbing works smoothly on mobile.
2. **Download Queue:** Never block the main FastAPI thread for `yt-dlp` downloads; use `BackgroundTasks` or async executor.
3. **Figma Fidelity:** Preserve the exact wording in Bahasa Melayu:
   - "Pustaka Ceramah" (Library)
   - "Tambah Ceramah" (Add/Download Videos)
   - "Sunting Butiran Ceramah" (Edit Video Details)
   - "Koleksi Kitab" (Book/Series Collection)
   - "Penceramah" (Speaker/Lecturer)
   - "Urus Pustaka" (Manage Library)
4. **Design System (Strict):** All frontend UI must use official shadcn/ui components (Obra shadcn/ui kit) styled only through the theme tokens. Never hand-roll components, use arbitrary values, or change the theme without the System Owner's explicit permission. Full rules: [`docs/architecture-specs.md` §8.1](file:///home/ahmadsalehuddin/code/personal/baitul-hikmah/docs/architecture-specs.md).
