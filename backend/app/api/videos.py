from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request, status
from sqlmodel import Session, select, or_, desc, asc
from app.core.database import get_session
from app.core.auth import get_optional_user, require_admin
from app.models.schema import (
    User, Video, Speaker, Collection, VideoStatus, UserVideoProgress,
    BatchFetchRequest, VideoUpdateRequest,
    SpeakerCreateRequest, SpeakerUpdateRequest,
    CollectionCreateRequest, CollectionUpdateRequest, CollectionMergeRequest,
)
from app.services.downloader import (
    is_valid_youtube_url, extract_youtube_id,
    fetch_video_metadata, start_video_download
)
from pathlib import Path
import os
from app.core.config import VIDEOS_DIR, STORAGE_DIR, THUMBNAILS_DIR
from app.services.streamer import create_video_streaming_response, verify_safe_path

router = APIRouter(tags=["Videos"])

@router.post("/videos/batch-fetch")
async def batch_fetch_videos(
    payload: BatchFetchRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    raw_urls = payload.urls[:5] # Max 5 at a time
    valid_urls = []
    invalid_urls = []

    for u in raw_urls:
        url_clean = u.strip()
        if not url_clean:
            continue
        if is_valid_youtube_url(url_clean):
            valid_urls.append(url_clean)
        else:
            invalid_urls.append(url_clean)

    if not valid_urls and invalid_urls:
        return {
            "status": "warning",
            "message": "Tiada pautan YouTube yang sah ditemui.",
            "invalid_urls": invalid_urls,
            "queued": []
        }

    queued_videos = []
    for url in valid_urls:
        yt_id = extract_youtube_id(url)
        # Check if video exists
        statement = select(Video).where(Video.youtube_id == yt_id)
        existing = session.exec(statement).first()

        if existing and existing.status == VideoStatus.completed:
            queued_videos.append(existing)
            continue

        # Extract initial metadata
        meta = fetch_video_metadata(url) or {}
        title = meta.get("title", f"Ceramah YouTube ({yt_id})")
        duration = meta.get("duration", 0)
        uploader = meta.get("uploader", "Ustaz")

        # Find or create speaker
        speaker_stmt = select(Speaker).where(Speaker.name == uploader)
        speaker = session.exec(speaker_stmt).first()
        if not speaker and uploader:
            speaker = Speaker(name=uploader)
            session.add(speaker)
            session.commit()
            session.refresh(speaker)

        video = existing or Video(
            youtube_url=url,
            youtube_id=yt_id,
            title=title,
            duration_seconds=duration,
            speaker_id=speaker.id if speaker else None,
            added_by_user_id=current_user.id,
            status=VideoStatus.pending,
            progress_percent=0.0
        )
        session.add(video)
        session.commit()
        session.refresh(video)

        # Trigger background download
        background_tasks.add_task(start_video_download, video.id, url)
        queued_videos.append(video)

    return {
        "status": "success",
        "invalid_urls": invalid_urls,
        "queued": queued_videos
    }

@router.get("/videos/downloads")
async def get_download_status(session: Session = Depends(get_session)):
    stmt = (
        select(Video)
        .where(or_(Video.status == VideoStatus.downloading, Video.status == VideoStatus.pending))
        .order_by(desc(Video.created_at))
    )
    active = session.exec(stmt).all()

    # Also get recently completed (last 10)
    completed_stmt = (
        select(Video)
        .where(Video.status == VideoStatus.completed)
        .order_by(desc(Video.created_at))
        .limit(10)
    )
    completed = session.exec(completed_stmt).all()

    # Failed downloads (last 10)
    failed_stmt = (
        select(Video)
        .where(Video.status == VideoStatus.failed)
        .order_by(desc(Video.created_at))
        .limit(10)
    )
    failed = session.exec(failed_stmt).all()

    return {
        "active": active,
        "recent": completed,
        "failed": failed
    }


@router.post("/videos/{video_id}/retry")
async def retry_video_download(
    video_id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    video = session.get(Video, video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video tidak ditemui")

    video.status = VideoStatus.pending
    video.progress_percent = 0.0
    video.error_message = None
    video.download_speed = None
    video.eta_seconds = None
    session.add(video)
    session.commit()
    session.refresh(video)

    background_tasks.add_task(start_video_download, video.id, video.youtube_url)
    return video

@router.get("/videos")
async def list_videos(
    search: Optional[str] = None,
    speaker_id: Optional[int] = None,
    collection_id: Optional[int] = None,
    sort: Optional[str] = "date_desc", # date_desc, date_asc, title_asc, title_desc
    filter_type: Optional[str] = None, # continue_watching, favorites, watched
    current_user: Optional[User] = Depends(get_optional_user),
    session: Session = Depends(get_session)
):
    query = select(Video).where(Video.status == VideoStatus.completed)

    if search:
        search_fmt = f"%{search.strip()}%"
        query = query.where(
            or_(
                Video.title.ilike(search_fmt),
                Video.youtube_id.ilike(search_fmt)
            )
        )

    if speaker_id:
        query = query.where(Video.speaker_id == speaker_id)

    if collection_id:
        query = query.where(Video.collection_id == collection_id)

    if sort == "title_asc":
        query = query.order_by(asc(Video.title))
    elif sort == "title_desc":
        query = query.order_by(desc(Video.title))
    elif sort == "date_asc":
        query = query.order_by(asc(Video.created_at))
    else:
        query = query.order_by(desc(Video.created_at))

    videos = session.exec(query).all()

    # Batch-fetch this user's progress/favorite records for the returned videos
    progress_map = {}
    if current_user:
        video_ids = [v.id for v in videos]
        if video_ids:
            progress_stmt = select(UserVideoProgress).where(
                UserVideoProgress.user_id == current_user.id,
                UserVideoProgress.video_id.in_(video_ids),
            )
            for p in session.exec(progress_stmt).all():
                progress_map[p.video_id] = p

    # Enrich with speaker, collection, and per-user progress/favorite data
    result = []
    for v in videos:
        entry = {
            "id": v.id,
            "title": v.title,
            "youtube_url": v.youtube_url,
            "duration_seconds": v.duration_seconds,
            "file_size_bytes": v.file_size_bytes,
            "thumbnail_path": v.thumbnail_path,
            "created_at": v.created_at,
            "speaker": {
                "id": v.speaker.id,
                "name": v.speaker.name
            } if v.speaker else None,
            "collection": {
                "id": v.collection.id,
                "title": v.collection.title
            } if v.collection else None
        }

        user_progress = None
        if current_user:
            p = progress_map.get(v.id)
            user_progress = {
                "watch_progress_seconds": p.watch_progress_seconds if p else 0,
                "is_watched": p.is_watched if p else False,
                "is_favorite": p.is_favorite if p else False,
            }
            entry["user_progress"] = user_progress

        if filter_type == "continue_watching":
            if not user_progress or user_progress["is_watched"] or user_progress["watch_progress_seconds"] < 10:
                continue
        elif filter_type == "favorites":
            if not user_progress or not user_progress["is_favorite"]:
                continue
        elif filter_type == "watched":
            if not user_progress or not user_progress["is_watched"]:
                continue

        result.append(entry)

    return result

@router.get("/videos/{video_id}")
async def get_video(video_id: int, session: Session = Depends(get_session)):
    video = session.get(Video, video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video tidak ditemui")
    return video

@router.put("/videos/{video_id}")
async def update_video(
    video_id: int,
    payload: VideoUpdateRequest,
    current_user: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    video = session.get(Video, video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video tidak ditemui")

    if payload.title is not None:
        video.title = payload.title.strip()

    # Handle Speaker update or create on the fly
    if payload.speaker_name:
        s_name = payload.speaker_name.strip()
        speaker = session.exec(select(Speaker).where(Speaker.name == s_name)).first()
        if not speaker:
            speaker = Speaker(name=s_name)
            session.add(speaker)
            session.commit()
            session.refresh(speaker)
        video.speaker_id = speaker.id
    elif payload.speaker_id is not None:
        video.speaker_id = payload.speaker_id

    # Handle Collection update or create on the fly
    if payload.collection_title:
        c_title = payload.collection_title.strip()
        collection = session.exec(select(Collection).where(Collection.title == c_title)).first()
        if not collection:
            collection = Collection(title=c_title, speaker_id=video.speaker_id)
            session.add(collection)
            session.commit()
            session.refresh(collection)
        video.collection_id = collection.id
    elif payload.collection_id is not None:
        video.collection_id = payload.collection_id

    session.add(video)
    session.commit()
    session.refresh(video)
    return video

@router.delete("/videos/{video_id}")
async def delete_video(
    video_id: int,
    current_user: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    video = session.get(Video, video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video tidak ditemui")

    # Remove associated per-user progress/favorite records
    progress_stmt = select(UserVideoProgress).where(UserVideoProgress.video_id == video_id)
    for p in session.exec(progress_stmt).all():
        session.delete(p)

    # Remove media files from the 2TB storage
    thumb_fs_path = None
    if video.thumbnail_path and video.thumbnail_path.startswith("/storage/thumbnails/"):
        thumb_fs_path = str(THUMBNAILS_DIR / video.thumbnail_path.replace("/storage/thumbnails/", "", 1))

    for fs_path in [video.file_path, video.audio_path, thumb_fs_path]:
        if not fs_path:
            continue
        try:
            candidate = Path(fs_path).resolve()
            if candidate.is_relative_to(STORAGE_DIR.resolve()) and candidate.is_file():
                candidate.unlink()
        except OSError:
            pass

    session.delete(video)
    session.commit()
    return {"status": "success", "message": "Ceramah berjaya dipadam dari pustaka dan storan."}


@router.get("/stream/{video_id}")
async def stream_video(
    video_id: int,
    request: Request,
    mode: Optional[str] = "video",
    session: Session = Depends(get_session)
):
    video = session.get(Video, video_id)
    if not video or not video.file_path:
        raise HTTPException(status_code=404, detail="Fail ceramah tidak ditemui")

    chosen_path = video.file_path
    if mode == "audio" and video.audio_path and os.path.exists(video.audio_path):
        chosen_path = video.audio_path

    verify_safe_path(Path(chosen_path), STORAGE_DIR)

    range_header = request.headers.get("range")
    return create_video_streaming_response(chosen_path, range_header)

@router.get("/speakers")
async def list_speakers(session: Session = Depends(get_session)):
    speakers = session.exec(select(Speaker)).all()
    results = []
    for s in speakers:
        results.append({
            "id": s.id,
            "name": s.name,
            "avatar_url": s.avatar_url,
            "video_count": len(s.videos),
            "collection_count": len(s.collections)
        })
    return results

@router.get("/collections")
async def list_collections(
    speaker_id: Optional[int] = None,
    session: Session = Depends(get_session)
):
    stmt = select(Collection)
    if speaker_id:
        stmt = stmt.where(Collection.speaker_id == speaker_id)
    collections = session.exec(stmt).all()
    results = []
    for c in collections:
        results.append({
            "id": c.id,
            "title": c.title,
            "speaker_id": c.speaker_id,
            "speaker_name": c.speaker.name if c.speaker else None,
            "video_count": len(c.videos)
        })
    return results

@router.post("/speakers")
async def create_speaker(
    payload: SpeakerCreateRequest,
    current_user: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Nama penceramah diperlukan.")

    existing = session.exec(select(Speaker).where(Speaker.name == name)).first()
    if existing:
        raise HTTPException(status_code=409, detail="Penceramah dengan nama ini sudah wujud.")

    speaker = Speaker(name=name, bio=payload.bio, avatar_url=payload.avatar_url)
    session.add(speaker)
    session.commit()
    session.refresh(speaker)
    return speaker


@router.put("/speakers/{speaker_id}")
async def update_speaker(
    speaker_id: int,
    payload: SpeakerUpdateRequest,
    current_user: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    speaker = session.get(Speaker, speaker_id)
    if not speaker:
        raise HTTPException(status_code=404, detail="Penceramah tidak ditemui")

    if payload.name is not None:
        speaker.name = payload.name.strip()
    if payload.bio is not None:
        speaker.bio = payload.bio
    if payload.avatar_url is not None:
        speaker.avatar_url = payload.avatar_url

    session.add(speaker)
    session.commit()
    session.refresh(speaker)
    return speaker


@router.post("/collections")
async def create_collection(
    payload: CollectionCreateRequest,
    current_user: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    title = payload.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Tajuk koleksi diperlukan.")

    existing = session.exec(select(Collection).where(Collection.title == title)).first()
    if existing:
        raise HTTPException(status_code=409, detail="Koleksi dengan tajuk ini sudah wujud.")

    collection = Collection(title=title, description=payload.description, speaker_id=payload.speaker_id)
    session.add(collection)
    session.commit()
    session.refresh(collection)
    return collection


@router.put("/collections/{collection_id}")
async def update_collection(
    collection_id: int,
    payload: CollectionUpdateRequest,
    current_user: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    collection = session.get(Collection, collection_id)
    if not collection:
        raise HTTPException(status_code=404, detail="Koleksi tidak ditemui")

    if payload.title is not None:
        collection.title = payload.title.strip()
    if payload.description is not None:
        collection.description = payload.description
    if payload.speaker_id is not None:
        collection.speaker_id = payload.speaker_id

    session.add(collection)
    session.commit()
    session.refresh(collection)
    return collection


@router.delete("/collections/{collection_id}")
async def delete_collection(
    collection_id: int,
    current_user: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    collection = session.get(Collection, collection_id)
    if not collection:
        raise HTTPException(status_code=404, detail="Koleksi tidak ditemui")

    video_count = session.exec(
        select(Video).where(Video.collection_id == collection_id)
    ).all()
    if video_count:
        raise HTTPException(
            status_code=409,
            detail=f"Tidak boleh memadam koleksi ini kerana masih ada {len(video_count)} ceramah terikat. Sila alihkan atau gabungkan koleksi terlebih dahulu."
        )

    session.delete(collection)
    session.commit()
    return {"status": "success", "message": "Koleksi berjaya dipadam."}


@router.post("/collections/merge")
async def merge_collections(
    payload: CollectionMergeRequest,
    current_user: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    if payload.source_collection_id == payload.target_collection_id:
        raise HTTPException(status_code=400, detail="Koleksi sumber dan sasaran tidak boleh sama.")

    source = session.get(Collection, payload.source_collection_id)
    target = session.get(Collection, payload.target_collection_id)
    if not source or not target:
        raise HTTPException(status_code=404, detail="Koleksi sumber atau sasaran tidak ditemui")

    videos_to_move = session.exec(
        select(Video).where(Video.collection_id == source.id)
    ).all()
    for v in videos_to_move:
        v.collection_id = target.id
        session.add(v)

    session.delete(source)
    session.commit()
    session.refresh(target)

    return {
        "status": "success",
        "message": f"{len(videos_to_move)} ceramah dipindahkan ke '{target.title}'.",
        "moved_count": len(videos_to_move),
        "target": target,
    }


@router.post("/videos/scan-existing")
async def scan_existing_media(
    current_user: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    """
    Scans the 2TB HDD (/mnt/storage/media/ceramah) for any existing videos 
    and automatically indexes them with parsed Speaker and Collection names.
    """
    if not VIDEOS_DIR.exists():
        return {"status": "error", "message": f"Direktori {VIDEOS_DIR} tidak wujud."}

    supported_exts = {".mp4", ".webm", ".mkv"}
    imported_count = 0

    for file_path in VIDEOS_DIR.iterdir():
        if file_path.is_file() and file_path.suffix.lower() in supported_exts:
            # Check if already indexed
            existing = session.exec(select(Video).where(Video.file_path == str(file_path))).first()
            if existing:
                continue

            stem = file_path.stem
            size_bytes = file_path.stat().st_size

            # Parse title, speaker, collection from filename pattern:
            # e.g.: "Risalah Misbahul Munir ｜ Ustaz Mohd Nidzam Bin Haji Omar ｜ Masjid Al Ghaffar Jasin ｜ Siri 03"
            parts = [p.strip() for p in stem.replace("|", "｜").split("｜") if p.strip()]
            
            speaker_obj = None
            collection_obj = None
            title = stem

            if len(parts) >= 2:
                collection_name = parts[0]
                speaker_name = parts[1]

                # Find or create speaker
                speaker_obj = session.exec(select(Speaker).where(Speaker.name == speaker_name)).first()
                if not speaker_obj:
                    speaker_obj = Speaker(name=speaker_name)
                    session.add(speaker_obj)
                    session.commit()
                    session.refresh(speaker_obj)

                # Find or create collection
                collection_obj = session.exec(select(Collection).where(Collection.title == collection_name)).first()
                if not collection_obj:
                    collection_obj = Collection(title=collection_name, speaker_id=speaker_obj.id)
                    session.add(collection_obj)
                    session.commit()
                    session.refresh(collection_obj)

                title = stem

            new_vid = Video(
                youtube_url="local://" + file_path.name,
                youtube_id=file_path.stem[:30],
                title=title,
                duration_seconds=0,
                file_size_bytes=size_bytes,
                file_path=str(file_path),
                speaker_id=speaker_obj.id if speaker_obj else None,
                collection_id=collection_obj.id if collection_obj else None,
                status=VideoStatus.completed,
                progress_percent=100.0,
            )
            session.add(new_vid)
            imported_count += 1

    session.commit()
    return {
        "status": "success",
        "imported_videos": imported_count,
        "message": f"{imported_count} video ceramah berjaya diindeks dari cakera keras 2TB."
    }

