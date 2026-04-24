"""
Max/Min Converter router
"""

import io
import os
import tempfile
import traceback
from typing import List

from fastapi import APIRouter, File, Form, UploadFile, HTTPException

from api.utils import save_uploads, text_response
from powertech_tools.utils.file_parser import read_headers_only
from powertech_tools.data.processor import compute_maxmin_from_multiple_files, compute_maxmin_template
from powertech_tools.utils.file_parser import load_table_allow_duplicate_headers

router = APIRouter()


@router.post("/headers")
async def get_headers(files: List[UploadFile] = File(...)):
    """Return headers from the first uploaded file."""
    tmpdir = tempfile.mkdtemp(prefix="jerry_mm_")
    try:
        paths = await save_uploads(files, tmpdir)
        headers, _, _, _ = read_headers_only(paths[0])
        return {"headers": headers, "file_count": len(paths)}
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/process")
async def process(
    files: List[UploadFile] = File(...),
    mode: str = Form("multiple"),       # "multiple" | "single_cycle" | "single_template"
    time_col: str = Form(""),
    cycle_col: str = Form(""),
):
    """Run max/min conversion and return result as downloadable txt."""
    tmpdir = tempfile.mkdtemp(prefix="jerry_mm_")
    try:
        paths = await save_uploads(files, tmpdir)

        if mode == "multiple":
            df = compute_maxmin_from_multiple_files(paths, time_col or None)
        elif mode in ("single_cycle", "single_template"):
            raw_df = load_table_allow_duplicate_headers(paths[0])
            df = compute_maxmin_template(
                raw_df,
                time_col=time_col,
                cycle_col=cycle_col,
            )
        else:
            raise HTTPException(400, f"Unknown mode: {mode}")

        out = io.StringIO()
        df.to_csv(out, sep="\t", index=False)
        return text_response(out.getvalue(), "maxmin_output.txt")

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, str(e))
