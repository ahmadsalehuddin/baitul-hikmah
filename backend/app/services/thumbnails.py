import secrets
import subprocess
import tempfile
from pathlib import Path
from typing import Optional

from fastapi import HTTPException

from app.core.config import THUMBNAILS_DIR
from app.services.streamer import verify_safe_path

THUMBNAIL_URL_PREFIX = "/storage/thumbnails/"

MAX_UPLOAD_BYTES = 5 * 1024 * 1024   # 5 MB
MAX_SOURCE_DIMENSION = 8000          # px per side; guards against decompression bombs
OUTPUT_MAX_WIDTH = 1280              # YouTube's maxres thumbnail width
OUTPUT_QUALITY = "85"
FFMPEG_TIMEOUT_SECONDS = 30


def sniff_image_extension(head: bytes) -> Optional[str]:
    """Identify JPEG/PNG/WebP from magic bytes. The client's filename and Content-Type are ignored."""
    if head.startswith(b"\xff\xd8\xff"):
        return ".jpg"
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return ".webp"
    return None


def convert_image_to_webp(source_bytes: bytes, source_ext: str, dest: Path) -> None:
    """Re-encode the upload as a downscaled WebP via ffmpeg (no shell, fixed argv, timeout).

    Raises ValueError when the bytes are not a decodable image within the size limits.
    """
    with tempfile.TemporaryDirectory(prefix="thumb_") as tmp:
        src = Path(tmp) / f"source{source_ext}"   # extension is server-chosen from the sniffed type
        src.write_bytes(source_bytes)

        try:
            probe = subprocess.run(
                ["ffprobe", "-v", "error", "-select_streams", "v:0",
                 "-show_entries", "stream=width,height", "-of", "csv=p=0", str(src)],
                capture_output=True, text=True, timeout=FFMPEG_TIMEOUT_SECONDS, check=True,
            )
            width, height = (int(v) for v in probe.stdout.strip().split(",")[:2])
        except (subprocess.SubprocessError, ValueError):
            raise ValueError("Imej tidak sah atau rosak.")
        if width <= 0 or height <= 0 or max(width, height) > MAX_SOURCE_DIMENSION:
            raise ValueError("Dimensi imej terlalu besar.")

        out = Path(tmp) / "out.webp"
        try:
            subprocess.run(
                ["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", str(src), "-frames:v", "1",
                 "-vf", f"scale='min({OUTPUT_MAX_WIDTH},iw)':-2",
                 "-c:v", "libwebp", "-quality", OUTPUT_QUALITY, str(out)],
                capture_output=True, timeout=FFMPEG_TIMEOUT_SECONDS, check=True,
            )
        except subprocess.SubprocessError:
            raise ValueError("Imej tidak sah atau rosak.")
        if not out.is_file() or out.stat().st_size == 0:
            raise ValueError("Imej tidak sah atau rosak.")

        dest.write_bytes(out.read_bytes())  # small file; avoids cross-device rename issues


def new_custom_thumbnail_target(video_id: int) -> tuple[Path, str]:
    """Server-generated filename (int id + random token): never derived from client input.

    A fresh name per upload also busts browser caches when a thumbnail is replaced.
    """
    filename = f"custom_{video_id}_{secrets.token_hex(4)}.webp"
    path = verify_safe_path(THUMBNAILS_DIR / filename, THUMBNAILS_DIR, must_exist=False)
    return path, f"{THUMBNAIL_URL_PREFIX}{filename}"


def thumbnail_fs_path(url: Optional[str]) -> Optional[Path]:
    """Map a stored `/storage/thumbnails/...` URL to a file inside THUMBNAILS_DIR, else None.

    Anything that escapes THUMBNAILS_DIR (e.g. a tampered DB value with `..`) yields None.
    """
    if not url or not url.startswith(THUMBNAIL_URL_PREFIX):
        return None
    try:
        return verify_safe_path(THUMBNAILS_DIR / url[len(THUMBNAIL_URL_PREFIX):], THUMBNAILS_DIR, must_exist=False)
    except HTTPException:
        return None


def delete_thumbnail_file(url: Optional[str], custom_only: bool = False) -> None:
    """Delete a stored thumbnail. `custom_only` refuses anything but our own `custom_*` uploads."""
    path = thumbnail_fs_path(url)
    if path and custom_only and not path.name.startswith("custom_"):
        return
    if path and path.is_file():
        try:
            path.unlink()
        except OSError:
            pass
