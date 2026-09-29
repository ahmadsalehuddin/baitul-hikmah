"""
One-off backfill: link existing videos to a Lokasi taken from the 3rd segment of their title
("Kitab | Penceramah | Lokasi | Siri N", only when the title has 4+ segments). Titles without a
place segment are left empty. Only fills videos whose location_id is still empty; never overwrites.
Idempotent. Copies the database to `<db>.bak-<timestamp>` before writing (skipped on --dry-run).

Run from `backend/` (uses STORAGE_DIR / the real DB unless env vars point elsewhere):
  ./venv/bin/python scripts/backfill_location.py --dry-run
  ./venv/bin/python scripts/backfill_location.py
"""
import sys
import argparse
import shutil
from collections import Counter
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlmodel import Session, select
from app.core.database import engine, init_db
from app.core.config import DATABASE_URL, STORAGE_DIR
from app.models.schema import Video
from app.services.locations import (
    MIN_SEGMENTS_WITH_PLACE, PLACE_SEGMENT_INDEX, get_or_create_location, title_segments,
)


def backup_database() -> Path:
    source = STORAGE_DIR / "baitul_hikmah.db"
    target = source.with_name(f"{source.name}.bak-{datetime.now():%Y%m%d-%H%M%S}")
    shutil.copy2(source, target)
    return target


def backfill(dry_run: bool):
    print(f"Pangkalan data: {DATABASE_URL}")
    if not dry_run:
        print(f"Sandaran dibuat: {backup_database()}")
    init_db()  # creates the location table and video.location_id on an older DB

    linked = Counter()
    no_place = already_set = 0
    with Session(engine) as session:
        for video in session.exec(select(Video)).all():
            if video.location_id is not None:
                already_set += 1
                continue
            segments = title_segments(video.title)
            if len(segments) < MIN_SEGMENTS_WITH_PLACE:
                no_place += 1
                continue
            place = segments[PLACE_SEGMENT_INDEX]
            linked[place] += 1
            if not dry_run:
                video.location_id = get_or_create_location(session, place).id
                session.add(video)
        if not dry_run:
            session.commit()

    for place, count in linked.most_common():
        print(f"  {place}: {count} ceramah")
    mode = "DRY-RUN (tiada perubahan disimpan)" if dry_run else "Selesai"
    print(f"{mode}: dipautkan={sum(linked.values())}, tiada lokasi dalam tajuk={no_place}, sudah ada={already_set}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dry-run", action="store_true", help="Papar sahaja, jangan simpan.")
    args = parser.parse_args()
    backfill(args.dry_run)
