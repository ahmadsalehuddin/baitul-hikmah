from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import SQLModel, Session, select, desc

from app.core.database import get_session
from app.core.auth import get_current_user
from app.models.schema import User, Video, UserVideoProgress

router = APIRouter(prefix="/progress", tags=["Progress"])


class ProgressHeartbeat(SQLModel):
    watch_progress_seconds: int = 0
    duration_seconds: Optional[int] = None
    is_watched: Optional[bool] = None


def _get_progress(session: Session, user_id: int, video_id: int) -> Optional[UserVideoProgress]:
    statement = select(UserVideoProgress).where(
        UserVideoProgress.user_id == user_id,
        UserVideoProgress.video_id == video_id,
    )
    return session.exec(statement).first()


@router.get("/continue-watching")
async def get_continue_watching(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    statement = (
        select(UserVideoProgress)
        .where(
            UserVideoProgress.user_id == current_user.id,
            UserVideoProgress.is_watched == False,  # noqa: E712
            UserVideoProgress.watch_progress_seconds >= 10,
        )
        .order_by(desc(UserVideoProgress.last_watched_at))
        .limit(10)
    )
    records = session.exec(statement).all()

    result = []
    for record in records:
        video = record.video
        if not video:
            continue
        result.append({
            "id": video.id,
            "title": video.title,
            "duration_seconds": video.duration_seconds,
            "thumbnail_path": video.thumbnail_path,
            "watch_progress_seconds": record.watch_progress_seconds,
            "speaker": {
                "id": video.speaker.id,
                "name": video.speaker.name,
            } if video.speaker else None,
            "collection": {
                "id": video.collection.id,
                "title": video.collection.title,
            } if video.collection else None,
            "location": {
                "id": video.location.id,
                "name": video.location.name,
            } if video.location else None,
        })
    return result


@router.post("/{video_id}")
async def update_progress(
    video_id: int,
    payload: ProgressHeartbeat,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    video = session.get(Video, video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video tidak ditemui")

    progress = _get_progress(session, current_user.id, video_id)
    if not progress:
        progress = UserVideoProgress(user_id=current_user.id, video_id=video_id)

    progress.watch_progress_seconds = payload.watch_progress_seconds

    if payload.is_watched is not None:
        progress.is_watched = payload.is_watched
    else:
        duration = payload.duration_seconds or video.duration_seconds
        if duration and payload.watch_progress_seconds / duration >= 0.90:
            progress.is_watched = True

    progress.last_watched_at = datetime.now(timezone.utc)

    session.add(progress)
    session.commit()
    session.refresh(progress)
    return progress


@router.get("/{video_id}")
async def get_progress(
    video_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    progress = _get_progress(session, current_user.id, video_id)
    if not progress:
        return {"watch_progress_seconds": 0, "is_watched": False, "is_favorite": False}
    return progress
