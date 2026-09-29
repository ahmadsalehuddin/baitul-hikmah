import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

import jwt
from fastapi import Request, Depends, HTTPException, status
from jwt import PyJWKClient
from sqlmodel import Session, select

from app.core.config import CF_ACCESS_AUD, CF_ACCESS_EXTRA_ISSUERS, CF_ACCESS_TEAM_DOMAIN, IS_PRODUCTION
from app.core.database import get_session
from app.models.schema import User, Role

logger = logging.getLogger(__name__)

# Local development only (ENVIRONMENT != production).
DEV_FALLBACK_EMAIL = "admin@example.com"
LOGIN_REFRESH_INTERVAL = timedelta(hours=1)

CF_JWT_ENABLED = bool(CF_ACCESS_TEAM_DOMAIN and CF_ACCESS_AUD)
_CF_ISSUER = f"https://{CF_ACCESS_TEAM_DOMAIN}"
_CF_ISSUERS = [_CF_ISSUER, *CF_ACCESS_EXTRA_ISSUERS]
_jwks_client: Optional[PyJWKClient] = None

if IS_PRODUCTION and not CF_JWT_ENABLED:
    logger.warning(
        "ENVIRONMENT=production but CF_ACCESS_TEAM_DOMAIN / CF_ACCESS_AUD are not set: the Cloudflare Access "
        "JWT is NOT being verified; identity is taken from Cf-Access-Authenticated-User-Email only."
    )


def _normalise(email: Optional[str]) -> Optional[str]:
    email = (email or "").strip().lower()
    return email or None


def _signing_key(token: str):
    global _jwks_client
    if _jwks_client is None:
        _jwks_client = PyJWKClient(f"{_CF_ISSUER}/cdn-cgi/access/certs", cache_keys=True, lifespan=3600)
    return _jwks_client.get_signing_key_from_jwt(token).key


def _verified_cf_email(token: str) -> Optional[str]:
    """Email from a Cloudflare Access JWT whose signature, issuer, audience and expiry are valid, else None."""
    try:
        claims = jwt.decode(
            token,
            _signing_key(token),
            algorithms=["RS256"],
            audience=CF_ACCESS_AUD,
            issuer=_CF_ISSUERS,
            options={"require": ["exp", "iss", "aud"]},
        )
    except Exception as exc:  # bad signature/expired/wrong audience, or the key set is unreachable
        logger.warning("Cloudflare Access JWT rejected: %s", exc)
        return None
    return _normalise(claims.get("email"))


_logged_unverified_claims = False


def _log_unverified_claims_once(token: Optional[str]) -> None:
    """Header-only mode: log the token's public iss/aud once, to help fill in CF_ACCESS_* correctly."""
    global _logged_unverified_claims
    if _logged_unverified_claims or not token:
        return
    _logged_unverified_claims = True
    try:
        claims = jwt.decode(token, options={"verify_signature": False})
        logger.warning("Cloudflare Access JWT seen (unverified): iss=%s aud=%s", claims.get("iss"), claims.get("aud"))
    except Exception as exc:
        logger.warning("Cloudflare Access JWT header present but unreadable: %s", exc)


def _extract_email(request: Request) -> Optional[str]:
    cf_email = _normalise(request.headers.get("Cf-Access-Authenticated-User-Email"))

    if not IS_PRODUCTION:
        return cf_email or _normalise(request.headers.get("X-Dev-User-Email")) or DEV_FALLBACK_EMAIL

    # Production: only Cloudflare Access identifies people. X-Dev-User-Email is never read.
    if not CF_JWT_ENABLED:
        _log_unverified_claims_once(request.headers.get("Cf-Access-Jwt-Assertion"))
        return cf_email

    token = request.headers.get("Cf-Access-Jwt-Assertion")
    verified = _verified_cf_email(token) if token else None
    if not verified:
        return None
    if cf_email and cf_email != verified:
        logger.warning("Cf-Access-Authenticated-User-Email does not match the verified JWT; rejecting.")
        return None
    return verified


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
        # In production an unidentified request is not a "guest": refuse it. (In development the
        # fallback identity means this branch is never reached.)
        if IS_PRODUCTION:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Log masuk diperlukan.")
        return None
    return _get_or_provision_user(session, email)


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != Role.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akses ditolak: Hanya pentadbir dibenarkan.",
        )
    return current_user
