"""
Canonical ceramah title: "<Koleksi Kitab> | Siri <N>" (spec §8.6).

A title is only ever generated when both the collection and the series number are known.
Titles are a hint, never the source of truth: a collection is never guessed or created from a
YouTube title, only matched against the names that already exist.
"""
import re
from typing import List, Optional, Tuple
from sqlmodel import Session, select, update
from app.models.schema import Collection, Video
from app.services.series import parse_series_number

TITLE_SEPARATOR = " | "


def canonical_title(collection_title: Optional[str], series_number: Optional[int]) -> Optional[str]:
    """"Kitab X | Siri 20", or None when the collection or the series number is missing."""
    name = (collection_title or "").strip()
    if not name or series_number is None:
        return None
    return f"{name}{TITLE_SEPARATOR}Siri {series_number}"


def _normalize(text: str) -> str:
    """Case-, spacing- and punctuation-insensitive form: "Sakit- Mati" == "sakit mati"."""
    return re.sub(r"[\W_]+", " ", text.casefold()).strip()


def match_collection_by_title(session: Session, title: str) -> Optional[Collection]:
    """The existing Koleksi Kitab whose name the title starts with (longest name wins), else None."""
    normalized = _normalize(title)
    best: Optional[Collection] = None
    best_len = 0
    for collection in session.exec(select(Collection)).all():
        name = _normalize(collection.title)
        if not name or len(name) <= best_len:
            continue
        if normalized == name or normalized.startswith(name + " "):
            best, best_len = collection, len(name)
    return best


def link_from_title(session: Session, title: str) -> Tuple[Optional[Collection], Optional[int], Optional[str]]:
    """
    For a video whose title is not canonical yet: (collection, series_number, canonical title) when
    the title starts with an existing Koleksi Kitab AND has a "Siri N"; otherwise (None, None, None).
    """
    series_number = parse_series_number(title)
    if series_number is None:
        return None, None, None
    collection = match_collection_by_title(session, title)
    if collection is None:
        return None, None, None
    return collection, series_number, canonical_title(collection.title, series_number)


def retitle_collection_videos(session: Session, collection_id: int, old_name: str, new_name: str) -> int:
    """
    When a Koleksi Kitab is renamed, or merged into another (call it before the videos are moved):
    regenerate the title of each of its videos **only if it still equals the old canonical title**. Hand-edited
    titles are never touched. Uses bulk UPDATEs so nothing is left half-loaded for the caller
    (see the Gabung note in spec §8.5). Does not commit. Returns the number of titles changed.
    """
    rows: List[Tuple[int, str, Optional[int]]] = session.exec(
        select(Video.id, Video.title, Video.series_number).where(Video.collection_id == collection_id)
    ).all()
    changed = 0
    for video_id, title, series_number in rows:
        if canonical_title(old_name, series_number) != title:
            continue
        new_title = canonical_title(new_name, series_number)
        if new_title and new_title != title:
            session.exec(update(Video).where(Video.id == video_id).values(title=new_title))
            changed += 1
    return changed
