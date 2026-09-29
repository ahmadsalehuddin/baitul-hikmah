"""
One-off backfill: parse "Siri N" from existing video titles into Video.series_number.
Only fills videos whose series_number is still empty; never overwrites a value.

Run from `backend/` (uses STORAGE_DIR / the real DB unless env vars point elsewhere):
  ./venv/bin/python scripts/backfill_series_number.py --dry-run
  ./venv/bin/python scripts/backfill_series_number.py
"""
import sys
import argparse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlmodel import Session, select
from app.core.database import engine, init_db
from app.core.config import DATABASE_URL
from app.models.schema import Video
from app.services.series import parse_series_number


def backfill(dry_run: bool):
    init_db()  # applies the additive series_number column on an older DB
    print(f"Pangkalan data: {DATABASE_URL}")
    updated = no_match = already_set = 0
    with Session(engine) as session:
        for video in session.exec(select(Video)).all():
            if video.series_number is not None:
                already_set += 1
                continue
            number = parse_series_number(video.title)
            if number is None:
                no_match += 1
                print(f"  Tiada 'Siri N': #{video.id} {video.title}")
                continue
            updated += 1
            if not dry_run:
                video.series_number = number
                session.add(video)
        if not dry_run:
            session.commit()
    mode = "DRY-RUN (tiada perubahan disimpan)" if dry_run else "Selesai"
    print(f"{mode}: dikemas kini={updated}, tiada padanan={no_match}, sudah ada={already_set}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dry-run", action="store_true", help="Papar sahaja, jangan simpan.")
    args = parser.parse_args()
    backfill(args.dry_run)
