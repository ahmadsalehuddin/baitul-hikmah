import logging
import re
from typing import List, Optional
from sqlalchemy import func
from sqlmodel import Session, select
from app.models.schema import Location

logger = logging.getLogger(__name__)

# A title segment that names a place starts with one of these (spec §8.5, rule b).
PLACE_KEYWORD_REGEX = re.compile(r"^(masjid|madrasah|surau|dewan)\b", re.IGNORECASE)
# Titles look like "Kitab | Penceramah | Lokasi | Siri N" (pipe or full-width pipe).
TITLE_SEPARATOR_REGEX = re.compile(r"[|｜]")
MIN_SEGMENTS_WITH_PLACE = 4
PLACE_SEGMENT_INDEX = 2


def find_location(session: Session, name: str) -> Optional[Location]:
    """Case-insensitive lookup, so "masjid as sobirin" finds "Masjid As Sobirin"."""
    return session.exec(select(Location).where(func.lower(Location.name) == name.strip().lower())).first()


def get_or_create_location(session: Session, name: str) -> Location:
    name = name.strip()
    location = find_location(session, name)
    if not location:
        location = Location(name=name)
        session.add(location)
        session.commit()
        session.refresh(location)
    return location


def title_segments(title: Optional[str]) -> List[str]:
    return [s.strip() for s in TITLE_SEPARATOR_REGEX.split(title or "") if s.strip()]


def place_from_title(title: Optional[str]) -> Optional[str]:
    """The place-keyword segment of a "Kitab | Penceramah | Lokasi | Siri N" title, if any (rule b)."""
    segments = title_segments(title)
    if len(segments) < MIN_SEGMENTS_WITH_PLACE:
        return None
    for segment in segments[PLACE_SEGMENT_INDEX:]:
        if PLACE_KEYWORD_REGEX.match(segment):
            return segment
    return None


def suggest_location(session: Session, title: Optional[str]) -> Optional[Location]:
    """
    Best-effort Lokasi for a title: (a) a segment equal to a known Lokasi, else (b) a place-keyword
    segment (created on the spot), else None. A suggestion only; the admin corrects it in Sunting Butiran.
    """
    for segment in title_segments(title):
        known = find_location(session, segment)
        if known:
            return known
    place = place_from_title(title)
    return get_or_create_location(session, place) if place else None


def suggest_location_safely(session: Session, title: Optional[str]) -> Optional[Location]:
    """`suggest_location` that can never raise: auto-fill must not block or fail a download."""
    try:
        return suggest_location(session, title)
    except Exception:
        session.rollback()
        logger.exception("Auto-isi Lokasi gagal untuk tajuk %r", title)
        return None
