from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.core.auth import get_current_user
from app.core.database import get_session
from app.models.schema import User, UserPreferencesRequest

router = APIRouter(prefix="/auth", tags=["Auth"])


def _user_payload(user: User):
    return {
        "id": user.id,
        "email": user.email,
        "display_name": user.display_name,
        "role": user.role,
        "avatar_url": user.avatar_url,
        "text_size": user.text_size,
    }


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return _user_payload(current_user)


@router.put("/me/preferences")
async def update_my_preferences(
    payload: UserPreferencesRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    # Always the caller's own record (never an id from the body), so any signed-in user may call it.
    if payload.text_size is not None:
        current_user.text_size = payload.text_size
        session.add(current_user)
        session.commit()
        session.refresh(current_user)
    return _user_payload(current_user)
