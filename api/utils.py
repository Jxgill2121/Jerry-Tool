"""
Shared API utilities: session management, file upload helpers, response helpers
"""

import io
import os
import shutil
import tempfile
import uuid
from typing import Any, Dict, List, Optional

from fastapi import UploadFile
from fastapi.responses import StreamingResponse

# ── In-memory session store ───────────────────────────────────────────────────
# Maps session_id → {"tmpdir": str, "files": [str], "data": dict}
_sessions: Dict[str, Dict[str, Any]] = {}


def create_session() -> str:
    sid = str(uuid.uuid4())
    tmpdir = tempfile.mkdtemp(prefix="jerry_")
    _sessions[sid] = {"tmpdir": tmpdir, "files": [], "data": {}}
    return sid


def get_session(sid: str) -> Optional[Dict[str, Any]]:
    return _sessions.get(sid)


def cleanup_session(sid: str) -> None:
    session = _sessions.pop(sid, None)
    if session:
        shutil.rmtree(session["tmpdir"], ignore_errors=True)


async def save_upload(file: UploadFile, tmpdir: str) -> str:
    """Save an UploadFile to tmpdir and return the path."""
    filename = os.path.basename(file.filename or "upload")
    path = os.path.join(tmpdir, filename)
    content = await file.read()
    with open(path, "wb") as fh:
        fh.write(content)
    return path


async def save_uploads(files: List[UploadFile], tmpdir: str) -> List[str]:
    paths = []
    for f in files:
        paths.append(await save_upload(f, tmpdir))
    return paths


def bytes_response(buf: io.BytesIO, filename: str, media_type: str) -> StreamingResponse:
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def text_response(text: str, filename: str) -> StreamingResponse:
    buf = io.BytesIO(text.encode("utf-8"))
    return bytes_response(buf, filename, "text/plain; charset=utf-8")


def excel_response(buf: io.BytesIO, filename: str) -> StreamingResponse:
    return bytes_response(
        buf,
        filename,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


def zip_response(buf: io.BytesIO, filename: str) -> StreamingResponse:
    return bytes_response(buf, filename, "application/zip")


def sanitize(obj: Any) -> Any:
    """Recursively convert numpy scalars / NaN / Inf to JSON-safe Python types."""
    import math
    import numpy as np
    if isinstance(obj, dict):
        return {k: sanitize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [sanitize(v) for v in obj]
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        v = float(obj)
        return None if (math.isnan(v) or math.isinf(v)) else v
    if isinstance(obj, (np.bool_,)):
        return bool(obj)
    if isinstance(obj, np.ndarray):
        return sanitize(obj.tolist())
    if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
        return None
    return obj
