from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.auth import get_current_user
from app.models.schema import User, Video, Speaker, UserVideoProgress, UserFavoriteSpeaker

router = APIRouter(prefix="/favorites", tags=["Favorites"])


@router.post("/video/{video_id}")
async def toggle_video_favorite(
    video_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    video = session.get(Video, video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video tidak ditemui")

    statement = select(UserVideoProgress).where(
        UserVideoProgress.user_id == current_user.id,
        UserVideoProgress.video_id == video_id,
    )
    progress = session.exec(statement).first()
    if not progress:
        progress = UserVideoProgress(user_id=current_user.id, video_id=video_id)

    progress.is_favorite = not progress.is_favorite

    session.add(progress)
    session.commit()
    session.refresh(progress)
    return {"video_id": video_id, "is_favorite": progress.is_favorite}


@router.post("/speaker/{speaker_id}")
async def toggle_speaker_favorite(
    speaker_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    speaker = session.get(Speaker, speaker_id)
    if not speaker:
        raise HTTPException(status_code=404, detail="Penceramah tidak ditemui")

    statement = select(UserFavoriteSpeaker).where(
        UserFavoriteSpeaker.user_id == current_user.id,
        UserFavoriteSpeaker.speaker_id == speaker_id,
    )
    favorite = session.exec(statement).first()

    if favorite:
        session.delete(favorite)
        session.commit()
        return {"speaker_id": speaker_id, "is_favorite": False}

    favorite = UserFavoriteSpeaker(user_id=current_user.id, speaker_id=speaker_id)
    session.add(favorite)
    session.commit()
    return {"speaker_id": speaker_id, "is_favorite": True}


@router.get("/speakers")
async def list_favorite_speakers(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    statement = select(UserFavoriteSpeaker.speaker_id).where(
        UserFavoriteSpeaker.user_id == current_user.id
    )
    return session.exec(statement).all()
