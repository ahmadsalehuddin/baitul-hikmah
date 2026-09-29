from fastapi import APIRouter, Depends

from app.core.auth import get_current_user
from app.models.schema import User

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "display_name": current_user.display_name,
        "role": current_user.role,
        "avatar_url": current_user.avatar_url,
    }
