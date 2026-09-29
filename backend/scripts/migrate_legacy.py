"""
Migrates legacy lecture records from `ceramah-downloader` into Baitul Hikmah.

Source (read-only):
  DB:     /home/ahmadsalehuddin/code/personal/ceramah-downloader/ceramah.db
  Videos: /mnt/storage/media/ceramah/

Destination (2TB HDD only, never the SSD):
  Videos:     VIDEOS_DIR      (/mnt/storage/media/baitul-hikmah/videos)
  Audio:      AUDIO_DIR       (/mnt/storage/media/baitul-hikmah/audio)
  Thumbnails: THUMBNAILS_DIR  (/mnt/storage/media/baitul-hikmah/thumbnails)
  DB:         baitul_hikmah.db (via app.core.database.engine)

Usage (run from `backend/`):
  ./venv/bin/python scripts/migrate_legacy.py --dry-run
  ./venv/bin/python scripts/migrate_legacy.py --limit 3
  ./venv/bin/python scripts/migrate_legacy.py
"""
import sys
import os
import argparse
import shutil
import sqlite3
import subprocess
import logging
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlmodel import Session, select
from app.core.database import engine, init_db
from app.core.config import VIDEOS_DIR, THUMBNAILS_DIR, AUDIO_DIR
from app.models.schema import User, Role, Speaker, Collection, Video, VideoStatus

LEGACY_DB_PATH = Path("/home/ahmadsalehuddin/code/personal/ceramah-downloader/ceramah.db")
LEGACY_MEDIA_DIR = Path("/mnt/storage/media/ceramah")
DEFAULT_SPEAKER_NAME = "Ustaz Mohd Nidzam Bin Haji Omar"

logging.basicConfig(level=logging.INFO, format="%(message)s")
log = logging.getLogger("migrate_legacy")


def parse_legacy_title(title: str):
    """Parse `Kitab | Speaker | Channel | Siri N [| Khatam]` style legacy titles."""
    parts = [p.strip() for p in (title or "").replace("｜", "|").split("|") if p.strip()]

    if len(parts) < 2:
        collection_title = parts[0] if parts else (title or "Ceramah Tanpa Tajuk").strip()
        return collection_title, DEFAULT_SPEAKER_NAME, None

    collection_title = parts[0]
    speaker_name = parts[1]
    channel_name = parts[2] if len(parts) >= 4 else None
    return collection_title, speaker_name, channel_name


def fetch_legacy_rows(limit=None):
    conn = sqlite3.connect(f"file:{LEGACY_DB_PATH}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    try:
        cur = conn.cursor()
        cur.execute("SELECT video_id, url, title, duration, file_path FROM videos ORDER BY video_id")
        rows = cur.fetchall()
    finally:
        conn.close()
    return rows[:limit] if limit else rows


def run_ffmpeg(args, label):
    result = subprocess.run(["ffmpeg", "-y", *args], capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"{label} gagal: {result.stderr.strip()[-500:]}")


def copy_or_link_mp4(src: Path, dest: Path):
    try:
        os.link(src, dest)
    except OSError:
        shutil.copy2(src, dest)


def get_video_codec(path: Path) -> str:
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=codec_name", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True,
    )
    return result.stdout.strip().lower()


def remux_to_mp4(src: Path, dest: Path):
    # .mkv sources here are H.264 and can be stream-copied. .webm sources are
    # VP9, which iOS Safari cannot play even inside an .mp4 container, so those
    # must be transcoded to H.264 for byte-range streaming to work on iPad/iPhone.
    if get_video_codec(src) == "h264":
        run_ffmpeg(["-i", str(src), "-c:v", "copy", "-c:a", "aac", "-b:a", "128k", str(dest)], "Remux ke MP4")
    else:
        run_ffmpeg(
            ["-i", str(src), "-c:v", "libx264", "-preset", "veryfast", "-crf", "21",
             "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", str(dest)],
            "Transkod ke H.264",
        )


def extract_audio(dest_mp4: Path, dest_audio: Path):
    try:
        run_ffmpeg(["-i", str(dest_mp4), "-vn", "-c:a", "copy", str(dest_audio)], "Ekstrak audio")
    except RuntimeError:
        run_ffmpeg(["-i", str(dest_mp4), "-vn", "-c:a", "aac", "-b:a", "128k", str(dest_audio)], "Ekstrak audio (fallback AAC)")


def generate_thumbnail(dest_mp4: Path, dest_thumb: Path, duration_seconds: int):
    offset = "00:00:05" if duration_seconds and duration_seconds < 60 else "00:01:00"
    run_ffmpeg(
        ["-ss", offset, "-i", str(dest_mp4), "-vframes", "1", "-vf", "scale=640:-1",
         "-c:v", "libwebp", "-quality", "80", str(dest_thumb)],
        "Jana thumbnail",
    )


def get_or_create_speaker(session, cache, name):
    name = name.strip()
    if name in cache["speakers"]:
        return cache["speakers"][name]
    speaker = session.exec(select(Speaker).where(Speaker.name == name)).first()
    if not speaker:
        speaker = Speaker(name=name)
        session.add(speaker)
        session.commit()
        session.refresh(speaker)
        cache["speakers_created"] += 1
    cache["speakers"][name] = speaker
    return speaker


def get_or_create_collection(session, cache, title, speaker_id):
    title = title.strip()
    key = (title, speaker_id)
    if key in cache["collections"]:
        return cache["collections"][key]
    collection = session.exec(
        select(Collection).where(Collection.title == title, Collection.speaker_id == speaker_id)
    ).first()
    if not collection:
        collection = Collection(title=title, speaker_id=speaker_id)
        session.add(collection)
        session.commit()
        session.refresh(collection)
        cache["collections_created"] += 1
    cache["collections"][key] = collection
    return collection


def dry_run_preview(rows):
    log.info(f"[DRY RUN] {len(rows)} rekod ceramah legasi ditemui.\n")

    speakers_seen, collections_seen = set(), set()
    missing, mp4_count, remux_count = 0, 0, 0

    for i, row in enumerate(rows, 1):
        collection_title, speaker_name, channel_name = parse_legacy_title(row["title"])
        speakers_seen.add(speaker_name)
        collections_seen.add((collection_title, speaker_name))

        src = LEGACY_MEDIA_DIR / row["file_path"] if row["file_path"] else None
        if not src or not src.exists():
            missing += 1
            log.warning(f"  [{i}/{len(rows)}] HILANG: {row['video_id']} -> {row['file_path']}")
            continue

        ext = src.suffix.lower()
        if ext == ".mp4":
            mp4_count += 1
        else:
            remux_count += 1
        log.info(
            f"  [{i}/{len(rows)}] {row['video_id']} | Koleksi='{collection_title}' | "
            f"Penceramah='{speaker_name}' | Saluran='{channel_name}' | ext={ext}"
        )

    log.info("\n=== Ringkasan Dry-Run ===")
    log.info(f"Jumlah video: {len(rows)}")
    log.info(f"Fail sedia ada (akan diproses): {len(rows) - missing}")
    log.info(f"Fail hilang: {missing}")
    log.info(f"Akan hardlink/copy (.mp4): {mp4_count}")
    log.info(f"Akan remux (.mkv/.webm): {remux_count}")
    log.info(f"Penceramah unik: {len(speakers_seen)}")
    log.info(f"Koleksi unik: {len(collections_seen)}")


def run_migration(rows):
    init_db()
    stats = {
        "migrated": 0, "skipped_existing": 0, "missing_source": 0, "failed": 0,
        "mp4_linked": 0, "remuxed": 0, "speakers_created": 0, "collections_created": 0,
    }

    with Session(engine) as session:
        admin = session.exec(select(User).where(User.role == Role.admin)).first()
        if not admin:
            log.error("Tiada pengguna admin ditemui. Jalankan scripts/seed_users.py dahulu.")
            sys.exit(1)

        cache = {"speakers": {}, "collections": {}, "speakers_created": 0, "collections_created": 0}

        for i, row in enumerate(rows, 1):
            video_id = row["video_id"]
            existing = session.exec(select(Video).where(Video.youtube_id == video_id)).first()
            if existing and existing.status == VideoStatus.completed:
                log.info(f"[{i}/{len(rows)}] {video_id}: sudah dimigrasi, dilangkau.")
                stats["skipped_existing"] += 1
                continue

            collection_title, speaker_name, channel_name = parse_legacy_title(row["title"])
            speaker = get_or_create_speaker(session, cache, speaker_name)
            collection = get_or_create_collection(session, cache, collection_title, speaker.id)

            video = existing or Video(
                youtube_url=row["url"],
                youtube_id=video_id,
                title=row["title"],
                added_by_user_id=admin.id,
            )
            video.channel_name = channel_name
            video.duration_seconds = row["duration"] or 0
            video.speaker_id = speaker.id
            video.collection_id = collection.id

            src_name = row["file_path"]
            src_path = LEGACY_MEDIA_DIR / src_name if src_name else None

            if not src_path or not src_path.exists():
                log.warning(f"[{i}/{len(rows)}] {video_id}: fail sumber tiada ({src_name}).")
                video.status = VideoStatus.failed
                video.error_message = f"Fail sumber tiada di legasi: {src_name}"
                session.add(video)
                session.commit()
                stats["missing_source"] += 1
                continue

            dest_mp4 = VIDEOS_DIR / f"{video_id}.mp4"
            dest_audio = AUDIO_DIR / f"{video_id}.m4a"
            dest_thumb = THUMBNAILS_DIR / f"{video_id}.webp"

            try:
                ext = src_path.suffix.lower()
                if ext == ".mp4":
                    if not dest_mp4.exists():
                        copy_or_link_mp4(src_path, dest_mp4)
                    stats["mp4_linked"] += 1
                else:
                    if not dest_mp4.exists():
                        remux_to_mp4(src_path, dest_mp4)
                    stats["remuxed"] += 1

                if not dest_audio.exists():
                    extract_audio(dest_mp4, dest_audio)
                if not dest_thumb.exists():
                    generate_thumbnail(dest_mp4, dest_thumb, row["duration"] or 0)

                video.file_path = str(dest_mp4)
                video.audio_path = str(dest_audio)
                video.thumbnail_path = f"/storage/thumbnails/{video_id}.webp"
                video.file_size_bytes = dest_mp4.stat().st_size
                video.status = VideoStatus.completed
                video.progress_percent = 100.0
                video.error_message = None
                session.add(video)
                session.commit()
                stats["migrated"] += 1
                log.info(f"[{i}/{len(rows)}] {video_id}: berjaya dimigrasi ({ext}).")

            except Exception as e:
                session.rollback()
                video.status = VideoStatus.failed
                video.error_message = str(e)[:500]
                session.add(video)
                session.commit()
                stats["failed"] += 1
                log.error(f"[{i}/{len(rows)}] {video_id}: GAGAL - {e}")

        stats["speakers_created"] = cache["speakers_created"]
        stats["collections_created"] = cache["collections_created"]

    log.info("\n=== Ringkasan Migrasi ===")
    log.info(f"Jumlah rekod diproses: {len(rows)}")
    log.info(f"Berjaya dimigrasi: {stats['migrated']}")
    log.info(f"Dilangkau (sudah wujud): {stats['skipped_existing']}")
    log.info(f"Fail sumber hilang: {stats['missing_source']}")
    log.info(f"Gagal (ralat ffmpeg/lain): {stats['failed']}")
    log.info(f"Video di-hardlink/copy (.mp4): {stats['mp4_linked']}")
    log.info(f"Video di-remux (.mkv/.webm): {stats['remuxed']}")
    log.info(f"Penceramah baru dicipta: {stats['speakers_created']}")
    log.info(f"Koleksi baru dicipta: {stats['collections_created']}")


def main():
    parser = argparse.ArgumentParser(description="Migrasi data legasi ceramah-downloader ke Baitul Hikmah.")
    parser.add_argument("--dry-run", action="store_true", help="Pratonton migrasi tanpa menulis fail/DB.")
    parser.add_argument("--limit", type=int, default=None, help="Hadkan bilangan video untuk dimigrasi.")
    parser.add_argument("--execute", action="store_true", help="Jalankan migrasi sebenar (lalai jika --dry-run tiada).")
    args = parser.parse_args()

    if not LEGACY_DB_PATH.exists():
        log.error(f"DB legasi tidak ditemui: {LEGACY_DB_PATH}")
        sys.exit(1)
    if not LEGACY_MEDIA_DIR.exists():
        log.error(f"Direktori media legasi tidak ditemui: {LEGACY_MEDIA_DIR}")
        sys.exit(1)

    rows = fetch_legacy_rows(args.limit)

    if args.dry_run:
        dry_run_preview(rows)
    else:
        run_migration(rows)


if __name__ == "__main__":
    main()
