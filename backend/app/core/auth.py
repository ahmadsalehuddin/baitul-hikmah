from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import Request, Depends, HTTPException, status
from sqlmodel import Session, select

from app.core.database import get_session
from app.models.schema import User, Role

DEV_FALLBACK_EMAIL = "admin@example.com"
LOGIN_REFRESH_INTERVAL = timedelta(hours=1)


def _extract_email(request: Request) -> Optional[str]:
    email = (
        request.headers.get("Cf-Access-Authenticated-User-Email")
        or request.headers.get("X-Dev-User-Email")
        or DEV_FALLBACK_EMAIL
    )
    return email.strip().lower() if email else None


def _get_or_provision_user(session: Session, email: str) -> User:
    user = session.exec(select(User).where(User.email == email)).first()
    now = datetime.now(timezone.utc)

    if user:
        if not user.last_login_at or (now - user.last_login_at) > LOGIN_REFRESH_INTERVAL:
            user.last_login_at = now
            session.add(user)
            session.commit()
            session.refresh(user)
        return user

    display_name = email.split("@")[0].capitalize()
    user = User(
        email=email,
        display_name=display_name,
        role=Role.viewer,
        last_login_at=now,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def get_current_user(request: Request, session: Session = Depends(get_session)) -> User:
    email = _extract_email(request)
    if not email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Log masuk diperlukan.")
    return _get_or_provision_user(session, email)


def get_optional_user(request: Request, session: Session = Depends(get_session)) -> Optional[User]:
    email = _extract_email(request)
    if not email:
        return None
    return _get_or_provision_user(session, email)


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != Role.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akses ditolak: Hanya pentadbir dibenarkan.",
        )
    return current_user
