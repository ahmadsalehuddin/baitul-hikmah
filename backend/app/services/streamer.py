import os
import mimetypes
from pathlib import Path
from typing import Generator
from fastapi import HTTPException, status
from fastapi.responses import StreamingResponse

CHUNK_SIZE = 1024 * 1024  # 1MB chunks

MIME_TYPE_OVERRIDES = {
    ".mp4": "video/mp4",
    ".m4a": "audio/mp4",
}

def verify_safe_path(target_path: Path, allowed_root: Path) -> Path:
    resolved_target = target_path.resolve()
    resolved_root = allowed_root.resolve()
    if not resolved_target.is_relative_to(resolved_root):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Akses ditolak: Laluan fail tidak sah.")
    if not resolved_target.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fail tidak dijumpai.")
    return resolved_target

def range_stream_generator(file_path: str, start: int, end: int) -> Generator[bytes, None, None]:
    with open(file_path, "rb") as f:
        f.seek(start)
        remaining = (end - start) + 1
        while remaining > 0:
            chunk_bytes = min(remaining, CHUNK_SIZE)
            data = f.read(chunk_bytes)
            if not data:
                break
            remaining -= len(data)
            yield data

def create_video_streaming_response(file_path: str, range_header: str | None = None) -> StreamingResponse:
    if not os.path.exists(file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video file not found")

    file_size = os.path.getsize(file_path)
    ext = os.path.splitext(file_path)[1].lower()
    mime_type = MIME_TYPE_OVERRIDES.get(ext)
    if not mime_type:
        mime_type, _ = mimetypes.guess_type(file_path)
    if not mime_type:
        mime_type = "video/mp4"

    # Standard headers
    headers = {
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Content-Type": mime_type,
    }

    if range_header:
        # Range header format: "bytes=start-end"
        try:
            range_unit, range_spec = range_header.strip().split("=")
            if range_unit != "bytes":
                raise ValueError()

            ranges = range_spec.split("-")
            start = int(ranges[0]) if ranges[0] else 0
            end = int(ranges[1]) if ranges[1] else file_size - 1

            if start >= file_size or end >= file_size or start > end:
                raise HTTPException(
                    status_code=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE,
                    headers={"Content-Range": f"bytes */{file_size}"}
                )

            content_length = (end - start) + 1
            headers["Content-Range"] = f"bytes {start}-{end}/{file_size}"
            headers["Content-Length"] = str(content_length)

            return StreamingResponse(
                range_stream_generator(file_path, start, end),
                status_code=status.HTTP_206_PARTIAL_CONTENT,
                headers=headers
            )
        except (ValueError, IndexError):
            # Fall back to full file if range header is malformed
            pass

    # Full file stream
    headers["Content-Length"] = str(file_size)
    return StreamingResponse(
        range_stream_generator(file_path, 0, file_size - 1),
        status_code=status.HTTP_200_OK,
        headers=headers
    )
