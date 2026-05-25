"""Opaque cursor encode/decode for cursor-based pagination.

A cursor is an opaque base64 string the server hands back as `next_cursor`.
The client passes it on the next request and the server uses its decoded
contents to position the next page.

Format under the hood: URL-safe base64 of a compact JSON object. Per-endpoint
contents (e.g. `{"d": "2026-05-20", "c": "apple"}` for /performance) are
defined by the endpoint and should be considered opaque by callers.

Not HMAC-signed — clients could decode and tamper. That's fine here because
the cursor only positions a query that's already tenant-scoped; tampering can
skip rows you'd see anyway, not reveal another tenant's data. Add signing if
the cursor ever encodes anything sensitive.
"""

from __future__ import annotations

import base64
import json

from fastapi import HTTPException, status


def encode_cursor(data: dict) -> str:
    """Encode a small dict as a URL-safe base64 string (no padding)."""
    raw = json.dumps(data, separators=(",", ":"), default=str).encode()
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def decode_cursor(cursor: str) -> dict:
    """Decode a cursor produced by `encode_cursor`. Raises HTTP 400 on garbage."""
    try:
        # Re-pad to a multiple of 4 for the base64 decoder.
        padding = (-len(cursor)) % 4
        raw = base64.urlsafe_b64decode((cursor + "=" * padding).encode())
        data = json.loads(raw)
    except (ValueError, json.JSONDecodeError) as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid cursor: {e}",
        )
    if not isinstance(data, dict):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid cursor: expected an object.",
        )
    return data
