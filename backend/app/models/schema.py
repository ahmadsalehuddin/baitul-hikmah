from typing import Optional, List
from datetime import datetime, timezone
from enum import Enum
from sqlalchemy import UniqueConstraint
from sqlmodel import SQLModel, Field, Relationship

class VideoStatus(str, Enum):
    pending = "pending"
    downloading = "downloading"
    completed = "completed"
    failed = "failed"

class Role(str, Enum):
    admin = "admin"
    viewer = "viewer"

class TextSize(str, Enum):
    kecil = "kecil"              # 87.5%
    biasa = "biasa"              # 100% (default)
    besar = "besar"              # 112.5%
    sangat_besar = "sangat_besar"  # 125%

class UserBase(SQLModel):
    email: str = Field(unique=True, index=True, max_length=255)
    display_name: str = Field(max_length=200)
    role: Role = Field(default=Role.viewer)
    avatar_url: Optional[str] = None

class User(UserBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_login_at: Optional[datetime] = None
    text_size: TextSize = Field(default=TextSize.biasa)

    added_videos: List["Video"] = Relationship(back_populates="added_by_user")
    progress_records: List["UserVideoProgress"] = Relationship(back_populates="user")
    favorite_speakers: List["UserFavoriteSpeaker"] = Relationship(back_populates="user")

class SpeakerBase(SQLModel):
    name: str = Field(index=True, max_length=200)
    avatar_url: Optional[str] = None
    bio: Optional[str] = None

class Speaker(SpeakerBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    collections: List["Collection"] = Relationship(back_populates="speaker")
    videos: List["Video"] = Relationship(back_populates="speaker")
    favorited_by: List["UserFavoriteSpeaker"] = Relationship(back_populates="speaker")

class CollectionBase(SQLModel):
    title: str = Field(index=True, max_length=255)
    description: Optional[str] = None
    speaker_id: Optional[int] = Field(default=None, foreign_key="speaker.id")

class Collection(CollectionBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    speaker: Optional[Speaker] = Relationship(back_populates="collections")
    videos: List["Video"] = Relationship(back_populates="collection")

class VideoBase(SQLModel):
    youtube_url: str = Field(index=True)
    youtube_id: Optional[str] = Field(default=None, index=True)
    title: str = Field(index=True, max_length=500)
    channel_name: Optional[str] = None
    channel_id: Optional[str] = None
    duration_seconds: int = Field(default=0)
    file_size_bytes: int = Field(default=0)
    speaker_id: Optional[int] = Field(default=None, foreign_key="speaker.id")
    collection_id: Optional[int] = Field(default=None, foreign_key="collection.id")
    series_number: Optional[int] = None
    added_by_user_id: Optional[int] = Field(default=None, foreign_key="user.id")

class Video(VideoBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    file_path: Optional[str] = None
    audio_path: Optional[str] = None
    thumbnail_path: Optional[str] = None
    # Set only while an admin-uploaded thumbnail is active: `thumbnail_path` then points at the
    # custom WebP and `original_thumbnail_path` remembers the YouTube one so it can be restored.
    is_custom_thumbnail: bool = Field(default=False)
    original_thumbnail_path: Optional[str] = None
    resolution_height: Optional[int] = Field(default=720, index=True)
    is_max_quality: bool = Field(default=False)
    status: VideoStatus = Field(default=VideoStatus.pending, index=True)
    progress_percent: float = Field(default=0.0)
    download_speed: Optional[str] = None
    eta_seconds: Optional[int] = None
    error_message: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    speaker: Optional[Speaker] = Relationship(back_populates="videos")
    collection: Optional[Collection] = Relationship(back_populates="videos")
    added_by_user: Optional[User] = Relationship(back_populates="added_videos")
    progress_records: List["UserVideoProgress"] = Relationship(back_populates="video")

class UserVideoProgressBase(SQLModel):
    user_id: int = Field(foreign_key="user.id")
    video_id: int = Field(foreign_key="video.id")
    watch_progress_seconds: int = Field(default=0)
    is_watched: bool = Field(default=False)
    is_favorite: bool = Field(default=False)
    last_watched_at: Optional[datetime] = None

class UserVideoProgress(UserVideoProgressBase, table=True):
    __table_args__ = (
        UniqueConstraint("user_id", "video_id", name="uq_user_video_progress"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)

    user: Optional[User] = Relationship(back_populates="progress_records")
    video: Optional[Video] = Relationship(back_populates="progress_records")

class UserFavoriteSpeakerBase(SQLModel):
    user_id: int = Field(foreign_key="user.id")
    speaker_id: int = Field(foreign_key="speaker.id")

class UserFavoriteSpeaker(UserFavoriteSpeakerBase, table=True):
    __table_args__ = (
        UniqueConstraint("user_id", "speaker_id", name="uq_user_favorite_speaker"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    user: Optional[User] = Relationship(back_populates="favorite_speakers")
    speaker: Optional[Speaker] = Relationship(back_populates="favorited_by")

# Pydantic schemas for API inputs & outputs
class BatchFetchRequest(SQLModel):
    urls: List[str]

class VideoUpdateRequest(SQLModel):
    title: Optional[str] = None
    speaker_id: Optional[int] = None
    speaker_name: Optional[str] = None
    collection_id: Optional[int] = None
    collection_title: Optional[str] = None
    # Only applied when the key is present in the request body; an explicit null clears it.
    series_number: Optional[int] = Field(default=None, ge=1, le=9999)

class UserPreferencesRequest(SQLModel):
    text_size: Optional[TextSize] = None

class SpeakerCreateRequest(SQLModel):
    name: str
    bio: Optional[str] = None
    avatar_url: Optional[str] = None

class SpeakerUpdateRequest(SQLModel):
    name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None

class CollectionCreateRequest(SQLModel):
    title: str
    description: Optional[str] = None
    speaker_id: Optional[int] = None

class CollectionUpdateRequest(SQLModel):
    title: Optional[str] = None
    description: Optional[str] = None
    speaker_id: Optional[int] = None

class CollectionMergeRequest(SQLModel):
    source_collection_id: int
    target_collection_id: int
