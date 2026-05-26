"""Tests for the opaque pagination cursor in app/util/cursor.py.

These exercise the small invariants the /performance and /anomalies endpoints
rely on: a roundtrip preserves the dict, and malformed input becomes a 400
rather than crashing the request handler.
"""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.util.cursor import decode_cursor, encode_cursor


def test_encode_decode_roundtrip_preserves_dict():
    payload = {"d": "2026-05-20", "c": "apple"}
    assert decode_cursor(encode_cursor(payload)) == payload


def test_encode_strips_padding():
    # The format claims URL-safe base64 without trailing '='. Decoder still
    # has to accept it (we re-pad internally), but the wire format stays clean.
    encoded = encode_cursor({"d": "2026-05-20", "c": "apple"})
    assert "=" not in encoded


def test_decode_garbage_raises_400():
    with pytest.raises(HTTPException) as exc:
        decode_cursor("!!!not-valid-base64!!!")
    assert exc.value.status_code == 400


def test_decode_non_dict_raises_400():
    # A valid base64 JSON value that isn't an object (list, number, string)
    # must be rejected so endpoints can safely treat the result as a dict.
    import base64
    import json
    raw = json.dumps([1, 2, 3]).encode()
    cursor_of_list = base64.urlsafe_b64encode(raw).decode().rstrip("=")

    with pytest.raises(HTTPException) as exc:
        decode_cursor(cursor_of_list)
    assert exc.value.status_code == 400
