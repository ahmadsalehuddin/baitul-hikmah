from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlmodel import Session, select, update
from app.core.database import get_session
from app.core.auth import require_admin
from app.models.schema import (
    User, Video, Location,
    LocationCreateRequest, LocationUpdateRequest, LocationMergeRequest,
)
from app.services.locations import find_location

router = APIRouter(tags=["Locations"])

NAME_MAX_LENGTH = 200


def _clean_name(raw: str) -> str:
    name = raw.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Nama lokasi diperlukan.")
    if len(name) > NAME_MAX_LENGTH:
        raise HTTPException(status_code=400, detail=f"Nama lokasi terlalu panjang (maksimum {NAME_MAX_LENGTH} aksara).")
    return name


@router.get("/locations")
async def list_locations(session: Session = Depends(get_session)):
    counts = dict(session.exec(
        select(Video.location_id, func.count(Video.id)).where(Video.location_id.is_not(None)).group_by(Video.location_id)
    ).all())
    locations = session.exec(select(Location).order_by(Location.name)).all()
    return [
        {"id": loc.id, "name": loc.name, "video_count": counts.get(loc.id, 0)}
        for loc in locations
    ]


@router.post("/locations")
async def create_location(
    payload: LocationCreateRequest,
    current_user: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    name = _clean_name(payload.name)
    if find_location(session, name):
        raise HTTPException(status_code=409, detail="Lokasi dengan nama ini sudah wujud.")

    location = Location(name=name)
    session.add(location)
    session.commit()
    session.refresh(location)
    return location


@router.put("/locations/{location_id}")
async def update_location(
    location_id: int,
    payload: LocationUpdateRequest,
    current_user: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    location = session.get(Location, location_id)
    if not location:
        raise HTTPException(status_code=404, detail="Lokasi tidak ditemui")

    if payload.name is not None:
        name = _clean_name(payload.name)
        clash = find_location(session, name)
        if clash and clash.id != location.id:
            raise HTTPException(status_code=409, detail="Lokasi dengan nama ini sudah wujud.")
        location.name = name

    session.add(location)
    session.commit()
    session.refresh(location)
    return location


@router.delete("/locations/{location_id}")
async def delete_location(
    location_id: int,
    current_user: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    location = session.get(Location, location_id)
    if not location:
        raise HTTPException(status_code=404, detail="Lokasi tidak ditemui")

    video_count = session.exec(
        select(func.count(Video.id)).where(Video.location_id == location_id)
    ).one()
    if video_count:
        raise HTTPException(
            status_code=409,
            detail=f"Tidak boleh memadam lokasi ini kerana masih ada {video_count} ceramah terikat. Sila alihkan atau gabungkan lokasi terlebih dahulu."
        )

    session.delete(location)
    session.commit()
    return {"status": "success", "message": "Lokasi berjaya dipadam."}


@router.post("/locations/merge")
async def merge_locations(
    payload: LocationMergeRequest,
    current_user: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    if payload.source_location_id == payload.target_location_id:
        raise HTTPException(status_code=400, detail="Lokasi sumber dan sasaran tidak boleh sama.")

    source = session.get(Location, payload.source_location_id)
    target = session.get(Location, payload.target_location_id)
    if not source or not target:
        raise HTTPException(status_code=404, detail="Lokasi sumber atau sasaran tidak ditemui")

    # A bulk UPDATE, not per-video ORM changes: deleting `source` afterwards would otherwise
    # null the location_id of every video still listed in `source.videos`.
    moved_count = session.exec(
        update(Video).where(Video.location_id == source.id).values(location_id=target.id)
    ).rowcount

    session.delete(source)
    session.commit()
    session.refresh(target)

    return {
        "status": "success",
        "message": f"{moved_count} ceramah dipindahkan ke '{target.name}'.",
        "moved_count": moved_count,
        "target": target,
    }
