from pathlib import Path
import os

# Project root directory
APP_ROOT = Path(__file__).resolve().parent.parent.parent
WORKSPACE_ROOT = APP_ROOT.parent

# Storage paths on HP Z240 2TB Server (Dedicated folder for Baitul Hikmah)
DEDICATED_2TB_STORAGE = Path("/mnt/storage/media/baitul-hikmah")

if DEDICATED_2TB_STORAGE.exists():
    STORAGE_DIR = Path(os.getenv("STORAGE_DIR", str(DEDICATED_2TB_STORAGE)))
    VIDEOS_DIR = Path(os.getenv("VIDEOS_DIR", str(STORAGE_DIR / "videos")))
    THUMBNAILS_DIR = Path(os.getenv("THUMBNAILS_DIR", str(STORAGE_DIR / "thumbnails")))
    AUDIO_DIR = Path(os.getenv("AUDIO_DIR", str(STORAGE_DIR / "audio")))
else:
    STORAGE_DIR = Path(os.getenv("STORAGE_DIR", str(WORKSPACE_ROOT / "storage")))
    VIDEOS_DIR = Path(os.getenv("VIDEOS_DIR", str(STORAGE_DIR / "videos")))
    THUMBNAILS_DIR = Path(os.getenv("THUMBNAILS_DIR", str(STORAGE_DIR / "thumbnails")))
    AUDIO_DIR = Path(os.getenv("AUDIO_DIR", str(STORAGE_DIR / "audio")))

# Ensure directories exist
VIDEOS_DIR.mkdir(parents=True, exist_ok=True)
THUMBNAILS_DIR.mkdir(parents=True, exist_ok=True)
AUDIO_DIR.mkdir(parents=True, exist_ok=True)

# Database file location
DATABASE_URL = f"sqlite:///{STORAGE_DIR / 'baitul_hikmah.db'}"

# Application settings
APP_TITLE = "Baitul Hikmah API"
APP_DESCRIPTION = "Islamic Lecture Archival & Streaming Portal for Home Server"
VERSION = "1.0.0"

# CORS Allowed Origins
CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]
