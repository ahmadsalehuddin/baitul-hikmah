import os
import re
import asyncio
from pathlib import Path
from typing import Optional, Dict, Any, List
import yt_dlp
from sqlmodel import Session, select
from app.core.config import VIDEOS_DIR, THUMBNAILS_DIR
from app.core.database import engine
from app.models.schema import Video, VideoStatus, Speaker

YOUTUBE_REGEX = re.compile(
    r'^(https?://)?(www\.)?(youtube\.com/(watch\?v=|shorts/|live/)|youtu\.be/)([\w-]{11})'
)

def extract_youtube_id(url: str) -> Optional[str]:
    match = YOUTUBE_REGEX.search(url.strip())
    return match.group(5) if match else None

def is_valid_youtube_url(url: str) -> bool:
    return bool(extract_youtube_id(url))

def fetch_video_metadata(url: str) -> Optional[Dict[str, Any]]:
    ydl_opts = {
        'skip_download': True,
        'extract_flat': False,
        'quiet': True,
        'no_warnings': True,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            info = ydl.extract_info(url, download=False)
            return {
                'id': info.get('id'),
                'title': info.get('title', 'Ceramah'),
                'duration': info.get('duration', 0),
                'uploader': info.get('uploader') or info.get('channel') or 'Ustaz',
                'thumbnail': info.get('thumbnail'),
                'description': info.get('description', ''),
            }
        except Exception:
            return None

def download_video_sync(video_id_record: int, youtube_url: str):
    with Session(engine) as session:
        video = session.get(Video, video_id_record)
        if not video:
            return
        video.status = VideoStatus.downloading
        video.progress_percent = 5.0
        session.add(video)
        session.commit()

    def progress_hook(d):
        if d['status'] == 'downloading':
            total_bytes = d.get('total_bytes') or d.get('total_bytes_estimate') or 0
            downloaded = d.get('downloaded_bytes', 0)
            percent = (downloaded / total_bytes * 100) if total_bytes > 0 else 0
            speed = d.get('_speed_str', '')
            eta = d.get('eta', None)

            with Session(engine) as session:
                v = session.get(Video, video_id_record)
                if v:
                    v.progress_percent = round(percent, 1)
                    v.download_speed = speed
                    v.eta_seconds = eta
                    session.add(v)
                    session.commit()

        elif d['status'] == 'finished':
            with Session(engine) as session:
                v = session.get(Video, video_id_record)
                if v:
                    v.progress_percent = 100.0
                    v.download_speed = None
                    session.add(v)
                    session.commit()

    output_template = str(VIDEOS_DIR / f"{video_id_record}_%(id)s.%(ext)s")

    ydl_opts = {
        'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        'outtmpl': output_template,
        'progress_hooks': [progress_hook],
        'writethumbnail': True,
        'quiet': True,
        'no_warnings': True,
        'postprocessors': [
            {
                'key': 'FFmpegVideoConvertor',
                'preferedformat': 'mp4',
            }
        ]
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(youtube_url, download=True)
            video_filename = ydl.prepare_filename(info)
            # Ensure mp4 extension
            base, _ = os.path.splitext(video_filename)
            final_mp4 = f"{base}.mp4"
            if not os.path.exists(final_mp4) and os.path.exists(video_filename):
                final_mp4 = video_filename

            # Check thumbnail
            thumb_path = None
            for ext in ['.jpg', '.webp', '.png']:
                potential_thumb = f"{base}{ext}"
                if os.path.exists(potential_thumb):
                    # Move or link to THUMBNAILS_DIR
                    target_thumb = THUMBNAILS_DIR / f"{video_id_record}{ext}"
                    os.replace(potential_thumb, target_thumb)
                    thumb_path = f"/storage/thumbnails/{video_id_record}{ext}"
                    break

            file_size = os.path.getsize(final_mp4) if os.path.exists(final_mp4) else 0

            with Session(engine) as session:
                v = session.get(Video, video_id_record)
                if v:
                    v.status = VideoStatus.completed
                    v.progress_percent = 100.0
                    v.file_path = final_mp4
                    v.thumbnail_path = thumb_path
                    v.file_size_bytes = file_size
                    if not v.duration_seconds and info.get('duration'):
                        v.duration_seconds = int(info['duration'])
                    session.add(v)
                    session.commit()

    except Exception as e:
        with Session(engine) as session:
            v = session.get(Video, video_id_record)
            if v:
                v.status = VideoStatus.failed
                v.error_message = str(e)
                session.add(v)
                session.commit()

async def start_video_download(video_id_record: int, youtube_url: str):
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, download_video_sync, video_id_record, youtube_url)
