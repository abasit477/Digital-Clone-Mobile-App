"""
Validate Cognito JWTs on every authenticated request.
Downloads the JWKS from Cognito's public endpoint and verifies the token
without needing to call AWS (pure local validation).
"""
import httpx
from functools import lru_cache
from jose import jwt, JWTError
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from .config import get_settings

bearer_scheme = HTTPBearer()


@lru_cache
def _get_jwks() -> dict:
    settings = get_settings()
    url = (
        f"https://cognito-idp.{settings.AWS_REGION}.amazonaws.com/"
        f"{settings.COGNITO_USER_POOL_ID}/.well-known/jwks.json"
    )
    resp = httpx.get(url, timeout=10)
    resp.raise_for_status()
    return resp.json()


def _decode_token(token_str: str) -> dict:
    """Decode and verify a raw JWT string. Raises ValueError on failure."""
    settings = get_settings()
    try:
        jwks = _get_jwks()
        unverified_header = jwt.get_unverified_header(token_str)
        rsa_key = next(
            (k for k in jwks["keys"] if k["kid"] == unverified_header["kid"]),
            None,
        )
        if rsa_key is None:
            raise ValueError("Invalid token key")
        return jwt.decode(
            token_str,
            rsa_key,
            algorithms=["RS256"],
            audience=settings.COGNITO_CLIENT_ID,
        )
    except JWTError as e:
        raise ValueError(f"Token validation failed: {e}")


def verify_token(credentials: HTTPAuthorizationCredentials = Security(bearer_scheme)) -> dict:
    """FastAPI dependency — returns decoded token payload or raises 401."""
    try:
        return _decode_token(credentials.credentials)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))


def verify_token_string(token_str: str) -> dict:
    """Validate a raw JWT string — for use in WebSocket endpoints."""
    try:
        return _decode_token(token_str)
    except ValueError as e:
        raise ValueError(str(e))
