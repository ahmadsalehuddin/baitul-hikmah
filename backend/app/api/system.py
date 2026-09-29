import shutil
from pathlib import Path
from fastapi import APIRouter, Depends
from app.core.auth import require_admin
from app.models.schema import User
from app.core.config import STORAGE_DIR, VIDEOS_DIR, AUDIO_DIR, THUMBNAILS_DIR

router = APIRouter(prefix="/system", tags=["System"])


def _dir_size_bytes(path: Path) -> int:
    if not path.exists():
        return 0
    total = 0
    for f in path.rglob("*"):
        if f.is_file():
            total += f.stat().st_size
    return total


@router.get("/storage")
async def get_storage_metrics(current_user: User = Depends(require_admin)):
    usage = shutil.disk_usage(STORAGE_DIR)
    return {
        "total_bytes": usage.total,
        "used_bytes": usage.used,
        "free_bytes": usage.free,
        "percent_used": round((usage.used / usage.total) * 100, 2) if usage.total else 0,
        "videos_bytes": _dir_size_bytes(VIDEOS_DIR),
        "audio_bytes": _dir_size_bytes(AUDIO_DIR),
        "thumbnails_bytes": _dir_size_bytes(THUMBNAILS_DIR),
    }
