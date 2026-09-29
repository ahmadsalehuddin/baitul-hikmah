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

# Runtime environment. Anything other than "production" is local development, where the
# X-Dev-User-Email header and the admin fallback are allowed (docs/architecture-specs.md §6.2, §7.2).
# docker-compose.yml sets ENVIRONMENT=production.
ENVIRONMENT = os.getenv("ENVIRONMENT", "development").strip().lower()
IS_PRODUCTION = ENVIRONMENT == "production"

# Cloudflare Access JWT verification (production). Both come from the Zero Trust dashboard:
# team domain = "<team>.cloudflareaccess.com", AUD = the Access application's "Application Audience (AUD) Tag".
# When both are set, every request must carry a valid Cf-Access-Jwt-Assertion; when unset, production
# falls back to trusting Cf-Access-Authenticated-User-Email alone (see app/core/auth.py).
_team = os.getenv("CF_ACCESS_TEAM_DOMAIN", "").strip().lower().removeprefix("https://").strip("/")
if _team and "." not in _team:
    _team = f"{_team}.cloudflareaccess.com"
CF_ACCESS_TEAM_DOMAIN = _team
CF_ACCESS_AUD = os.getenv("CF_ACCESS_AUD", "").strip()
# Extra accepted token issuers (comma-separated URLs). Needed after renaming the Zero Trust team: tokens can
# keep carrying the old team's issuer. The signature (checked against CF_ACCESS_TEAM_DOMAIN's keys) and the AUD
# tag are still verified, so this only relaxes the name check.
CF_ACCESS_EXTRA_ISSUERS = [i.strip().rstrip("/") for i in os.getenv("CF_ACCESS_EXTRA_ISSUERS", "").split(",") if i.strip()]

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
