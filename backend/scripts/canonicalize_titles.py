"""
One-off backfill (spec §8.6): rewrite each video's title to "<Koleksi Kitab> | Siri <N>".
Only videos that have BOTH a Koleksi Kitab and a series number are touched; the rest keep their title.
Videos whose new title would be identical to another video's (same Koleksi Kitab + Siri) are skipped
and listed for manual review. Idempotent. Copies the database to `<db>.bak-<timestamp>` before
writing (skipped on --dry-run); that backup is the only copy of the original YouTube titles.

Run from `backend/` (uses STORAGE_DIR / the real DB unless env vars point elsewhere):
  ./venv/bin/python scripts/canonicalize_titles.py --dry-run
  ./venv/bin/python scripts/canonicalize_titles.py
"""
import sys
import argparse
import shutil
from collections import defaultdict
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlmodel import Session, select
from app.core.database import engine, init_db
from app.core.config import DATABASE_URL, STORAGE_DIR
from app.models.schema import Collection, Video
from app.services.titles import canonical_title

SAMPLE_SIZE = 8


def backup_database() -> Path:
    source = STORAGE_DIR / "baitul_hikmah.db"
    target = source.with_name(f"{source.name}.bak-{datetime.now():%Y%m%d-%H%M%S}")
    shutil.copy2(source, target)
    return target


def canonicalize(dry_run: bool):
    print(f"Pangkalan data: {DATABASE_URL}")
    if not dry_run:
        print(f"Sandaran dibuat: {backup_database()}")
    init_db()

    already = no_data = 0
    with Session(engine) as session:
        collections = {c.id: c.title for c in session.exec(select(Collection)).all()}
        videos = session.exec(select(Video)).all()

        planned = {}  # video.id -> new title
        for video in videos:
            new_title = canonical_title(collections.get(video.collection_id), video.series_number)
            if new_title is None:
                no_data += 1
            elif new_title == video.title:
                already += 1
            else:
                planned[video.id] = new_title

        # Two videos ending up with the same title (same Koleksi Kitab + Siri) cannot be told apart.
        final_title = {v.id: planned.get(v.id, v.title) for v in videos}
        by_title = defaultdict(list)
        for video_id, title in final_title.items():
            by_title[title].append(video_id)
        clashes = {vid for ids in by_title.values() if len(ids) > 1 for vid in ids if vid in planned}

        by_id = {v.id: v for v in videos}
        old_titles = {v.id: v.title for v in videos}  # plain values: the objects expire on commit
        sample = []
        for video_id, new_title in planned.items():
            if video_id in clashes:
                continue
            video = by_id[video_id]
            if len(sample) < SAMPLE_SIZE:
                sample.append((video.title, new_title))
            if not dry_run:
                video.title = new_title
                session.add(video)
        if not dry_run:
            session.commit()

    for before, after in sample:
        print(f"  {before}\n    -> {after}")
    if clashes:
        print("Dilangkau (tajuk baharu sama dengan ceramah lain, semak secara manual):")
        for video_id in sorted(clashes):
            print(f"  id={video_id}: {old_titles[video_id]!r} -> {planned[video_id]!r}")
    rewritten = len(planned) - len(clashes)
    mode = "DRY-RUN (tiada perubahan disimpan)" if dry_run else "Selesai"
    print(f"{mode}: ditulis semula={rewritten}, sudah betul={already}, "
          f"tiada koleksi/siri={no_data}, dilangkau (bertindih)={len(clashes)}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dry-run", action="store_true", help="Papar sahaja, jangan simpan.")
    args = parser.parse_args()
    canonicalize(args.dry_run)
