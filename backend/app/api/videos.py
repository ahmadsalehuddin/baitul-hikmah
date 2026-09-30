import asyncio
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request, UploadFile, File, status
from fastapi.concurrency import run_in_threadpool
from sqlmodel import Session, select, update, delete, func, or_, desc, asc
from app.core.database import get_session
from app.core.auth import get_optional_user, require_admin
from app.models.schema import (
    User, Video, Speaker, Collection, Location, VideoStatus, UserVideoProgress, UserFavoriteSpeaker,
    BatchFetchRequest, VideoUpdateRequest,
    SpeakerCreateRequest, SpeakerUpdateRequest, SpeakerMergeRequest,
    CollectionCreateRequest, CollectionUpdateRequest, CollectionMergeRequest,
)
from app.services.downloader import (
    is_valid_youtube_url, extract_youtube_id,
    fetch_video_metadata, start_video_download
)
from pathlib import Path
import os
from app.core.config import VIDEOS_DIR, STORAGE_DIR
from app.services.streamer import create_video_streaming_response, verify_safe_path
from app.services.series import parse_series_number
from app.services.titles import canonical_title, link_from_title, retitle_collection_videos
from app.services.locations import get_or_create_location, suggest_location_safely
from app.services.thumbnails import (
    MAX_UPLOAD_BYTES, sniff_image_extension, convert_image_to_webp,
    new_custom_thumbnail_target, thumbnail_fs_path, delete_thumbnail_file,
)

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
    seen_ids = set()

    for u in raw_urls:
        url_clean = u.strip()
        if not url_clean:
            continue
        yt_id = extract_youtube_id(url_clean)
        if yt_id:
            # The same video pasted twice (even via different URL forms) is queued once.
            if yt_id not in seen_ids:
                seen_ids.add(yt_id)
                valid_urls.append(url_clean)
        elif url_clean not in invalid_urls:
            invalid_urls.append(url_clean)

    if not valid_urls and invalid_urls:
        return {
            "status": "warning",
            "message": "Tiada pautan YouTube yang sah ditemui.",
            "invalid_urls": invalid_urls,
            "queued": []
        }

    # Look up existing records first so completed videos skip the yt-dlp round trip.
    existing_by_url = {}
    for url in valid_urls:
        statement = select(Video).where(Video.youtube_id == extract_youtube_id(url))
        existing_by_url[url] = session.exec(statement).first()

    # Fetch metadata for all new/retried videos in parallel (yt-dlp is blocking network I/O,
    # so each lookup runs in its own worker thread, off the event loop).
    to_fetch = [
        url for url in valid_urls
        if not (existing_by_url[url] and existing_by_url[url].status == VideoStatus.completed)
    ]
    fetched = await asyncio.gather(*(run_in_threadpool(fetch_video_metadata, url) for url in to_fetch))
    meta_by_url = dict(zip(to_fetch, fetched))

    queued_videos = []
    for url in valid_urls:
        yt_id = extract_youtube_id(url)
        existing = existing_by_url[url]

        if existing and existing.status == VideoStatus.completed:
            queued_videos.append(existing)
            continue

        meta = meta_by_url.get(url) or {}
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

        # Best-effort Lokasi from the title (spec §8.5); never blocks or fails the download.
        location = suggest_location_safely(session, title) if not (existing and existing.location_id) else None

        # Koleksi Kitab + canonical title only for a name that already exists (spec §8.6 T1);
        # otherwise the YouTube title stays and the admin assigns the Koleksi Kitab later.
        linked_collection, linked_series, linked_title = (None, None, None) if existing else link_from_title(session, title)

        video = existing or Video(
            youtube_url=url,
            youtube_id=yt_id,
            title=linked_title or title,
            duration_seconds=duration,
            series_number=linked_series if linked_collection else parse_series_number(title),
            collection_id=linked_collection.id if linked_collection else None,
            speaker_id=speaker.id if speaker else None,
            added_by_user_id=current_user.id,
            status=VideoStatus.pending,
            progress_percent=0.0
        )
        if location:
            video.location_id = location.id
        session.add(video)
        session.commit()
        session.refresh(video)

        # Trigger background download
        background_tasks.add_task(start_video_download, video.id, url)
        queued_videos.append(video)

    # Each later commit expires the earlier videos; reload them so they serialize in full.
    for video in queued_videos:
        session.refresh(video)

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

    # Enrich with speaker, collection, location, and per-user progress/favorite data
    result = []
    for v in videos:
        entry = {
            "id": v.id,
            "title": v.title,
            "youtube_url": v.youtube_url,
            "duration_seconds": v.duration_seconds,
            "file_size_bytes": v.file_size_bytes,
            "thumbnail_path": v.thumbnail_path,
            "is_custom_thumbnail": v.is_custom_thumbnail,
            "series_number": v.series_number,
            "created_at": v.created_at,
            "speaker": {
                "id": v.speaker.id,
                "name": v.speaker.name
            } if v.speaker else None,
            "collection": {
                "id": v.collection.id,
                "title": v.collection.title
            } if v.collection else None,
            "location": {
                "id": v.location.id,
                "name": v.location.name
            } if v.location else None
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

    # Remember whether the title may be regenerated (spec §8.6 T2): it is still the auto-generated
    # one, or the video had no Koleksi Kitab / Siri yet, so its raw title is a placeholder.
    old_title = video.title
    old_collection = session.get(Collection, video.collection_id) if video.collection_id else None
    old_canonical = canonical_title(old_collection.title if old_collection else None, video.series_number)
    title_regenerable = old_canonical is None or old_title == old_canonical

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

    # Handle Lokasi update or create on the fly
    if payload.location_name:
        video.location_id = get_or_create_location(session, payload.location_name).id
    elif payload.location_id is not None:
        if not session.get(Location, payload.location_id):
            raise HTTPException(status_code=404, detail="Lokasi tidak ditemui")
        video.location_id = payload.location_id

    # series_number is nullable, so "absent" (leave alone) must differ from null (clear it)
    if "series_number" in payload.model_fields_set:
        video.series_number = payload.series_number

    # Koleksi Kitab / Siri changed and Tajuk was not edited: regenerate, but never a hand-edited title.
    if title_regenerable and video.title == old_title:
        new_collection = session.get(Collection, video.collection_id) if video.collection_id else None
        new_title = canonical_title(new_collection.title if new_collection else None, video.series_number)
        if new_title:
            video.title = new_title

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

    # Remove media files from the 2TB storage (incl. the YouTube original kept behind a custom thumbnail)
    thumb_fs_paths = [thumbnail_fs_path(video.thumbnail_path), thumbnail_fs_path(video.original_thumbnail_path)]

    for fs_path in [video.file_path, video.audio_path, *thumb_fs_paths]:
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


def _thumbnail_state(video: Video):
    return {
        "id": video.id,
        "thumbnail_path": video.thumbnail_path,
        "is_custom_thumbnail": video.is_custom_thumbnail,
    }


async def _read_upload_limited(file: UploadFile, limit: int) -> bytes:
    chunks = []
    total = 0
    while chunk := await file.read(1024 * 1024):
        total += len(chunk)
        if total > limit:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Imej terlalu besar (maksimum {limit // (1024 * 1024)} MB).",
            )
        chunks.append(chunk)
    return b"".join(chunks)


@router.post("/videos/{video_id}/thumbnail")
async def upload_video_thumbnail(
    video_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    video = session.get(Video, video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video tidak ditemui")

    data = await _read_upload_limited(file, MAX_UPLOAD_BYTES)
    source_ext = sniff_image_extension(data[:16])
    if not source_ext:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Jenis fail tidak disokong. Sila gunakan imej JPEG, PNG atau WebP.",
        )

    new_path, new_url = new_custom_thumbnail_target(video.id)
    try:
        await run_in_threadpool(convert_image_to_webp, data, source_ext, new_path)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    previous_custom = video.thumbnail_path if video.is_custom_thumbnail else None
    if not video.is_custom_thumbnail:
        video.original_thumbnail_path = video.thumbnail_path
    video.thumbnail_path = new_url
    video.is_custom_thumbnail = True
    session.add(video)
    try:
        session.commit()
    except Exception:
        new_path.unlink(missing_ok=True)
        raise
    session.refresh(video)

    delete_thumbnail_file(previous_custom, custom_only=True)
    return _thumbnail_state(video)


@router.delete("/videos/{video_id}/thumbnail")
async def reset_video_thumbnail(
    video_id: int,
    current_user: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    """Discard the uploaded thumbnail and restore the original YouTube one."""
    video = session.get(Video, video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video tidak ditemui")

    if not video.is_custom_thumbnail:
        return _thumbnail_state(video)  # already the default; nothing to do

    original = video.original_thumbnail_path
    if original:
        original_fs = thumbnail_fs_path(original)
        if not original_fs or not original_fs.is_file():
            raise HTTPException(status_code=404, detail="Thumbnail asal tidak ditemui.")

    custom = video.thumbnail_path
    video.thumbnail_path = original
    video.original_thumbnail_path = None
    video.is_custom_thumbnail = False
    session.add(video)
    session.commit()
    session.refresh(video)

    delete_thumbnail_file(custom, custom_only=True)
    return _thumbnail_state(video)


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


@router.delete("/speakers/{speaker_id}")
async def delete_speaker(
    speaker_id: int,
    current_user: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    speaker = session.get(Speaker, speaker_id)
    if not speaker:
        raise HTTPException(status_code=404, detail="Penceramah tidak ditemui")

    video_count = session.exec(select(func.count(Video.id)).where(Video.speaker_id == speaker_id)).one()
    collection_count = session.exec(select(func.count(Collection.id)).where(Collection.speaker_id == speaker_id)).one()
    if video_count or collection_count:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Tidak boleh memadam penceramah ini kerana masih ada {video_count} ceramah dan "
                f"{collection_count} koleksi kitab terikat. Sila alihkan atau gabungkan penceramah terlebih dahulu."
            )
        )

    # Users' "penceramah kegemaran" marks go with the speaker.
    session.exec(delete(UserFavoriteSpeaker).where(UserFavoriteSpeaker.speaker_id == speaker_id))
    session.delete(speaker)
    session.commit()
    return {"status": "success", "message": "Penceramah berjaya dipadam."}


@router.post("/speakers/merge")
async def merge_speakers(
    payload: SpeakerMergeRequest,
    current_user: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    if payload.source_speaker_id == payload.target_speaker_id:
        raise HTTPException(status_code=400, detail="Penceramah sumber dan sasaran tidak boleh sama.")

    source = session.get(Speaker, payload.source_speaker_id)
    target = session.get(Speaker, payload.target_speaker_id)
    if not source or not target:
        raise HTTPException(status_code=404, detail="Penceramah sumber atau sasaran tidak ditemui")

    # Bulk UPDATEs, not per-row ORM changes: deleting `source` afterwards would otherwise null the
    # speaker_id of every row still listed in its relationships (same trap as merge_collections).
    moved_count = session.exec(
        update(Video).where(Video.speaker_id == source.id).values(speaker_id=target.id)
    ).rowcount
    session.exec(
        update(Collection).where(Collection.speaker_id == source.id).values(speaker_id=target.id)
    )

    # Favourites move to the target, except for users who already favourited it (unique per user+speaker).
    already_on_target = select(UserFavoriteSpeaker.user_id).where(UserFavoriteSpeaker.speaker_id == target.id)
    session.exec(
        update(UserFavoriteSpeaker)
        .where(UserFavoriteSpeaker.speaker_id == source.id, UserFavoriteSpeaker.user_id.not_in(already_on_target))
        .values(speaker_id=target.id)
    )
    session.exec(delete(UserFavoriteSpeaker).where(UserFavoriteSpeaker.speaker_id == source.id))

    session.delete(source)
    session.commit()
    session.refresh(target)

    return {
        "status": "success",
        "message": f"{moved_count} ceramah dipindahkan ke '{target.name}'.",
        "moved_count": moved_count,
        "target": target,
    }


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
        new_name = payload.title.strip()
        retitle_collection_videos(session, collection.id, collection.title, new_name)
        collection.title = new_name
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

    # Auto-generated titles follow their videos into the target (before the videos are moved).
    retitle_collection_videos(session, source.id, source.title, target.title)

    # A bulk UPDATE, not per-video ORM changes: deleting `source` afterwards would otherwise
    # null the collection_id of every video still listed in `source.videos`.
    moved_count = session.exec(
        update(Video).where(Video.collection_id == source.id).values(collection_id=target.id)
    ).rowcount

    session.delete(source)
    session.commit()
    session.refresh(target)

    return {
        "status": "success",
        "message": f"{moved_count} ceramah dipindahkan ke '{target.title}'.",
        "moved_count": moved_count,
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

            # Canonical title (spec §8.6) when the Koleksi Kitab and the Siri are both known.
            scan_series = parse_series_number(title)
            if collection_obj is None:
                collection_obj, _, _ = link_from_title(session, title)
            title = canonical_title(collection_obj.title if collection_obj else None, scan_series) or title

            new_vid = Video(
                youtube_url="local://" + file_path.name,
                youtube_id=file_path.stem[:30],
                title=title,
                series_number=scan_series,
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

