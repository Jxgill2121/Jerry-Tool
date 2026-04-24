"""
TDMS to Cycle Files router
"""

import io
import os
import tempfile
import zipfile
from typing import List, Optional

import numpy as np
from fastapi import APIRouter, File, Form, UploadFile, HTTPException
from nptdms import TdmsFile

from api.utils import save_uploads, zip_response, sanitize
from powertech_tools.data.tdms_converter import read_tdms_structure, convert_tdms_files_to_cycles

router = APIRouter()


@router.post("/structure")
async def get_structure(files: List[UploadFile] = File(...)):
    """Upload TDMS files and return their group/channel structure."""
    tmpdir = tempfile.mkdtemp(prefix="jerry_merge_")
    try:
        paths = await save_uploads(files, tmpdir)
        if not paths:
            raise HTTPException(400, "No files uploaded")

        groups, channels = read_tdms_structure(paths[0])

        # Build per-channel preview stats from first file
        preview: dict = {}
        try:
            tf = TdmsFile.read(paths[0])
            for grp in tf.groups():
                preview[grp.name] = {}
                for ch in grp.channels():
                    data = ch[:]
                    numeric = data[~np.isnan(data.astype(float))] if data.dtype.kind in "fiu" else np.array([])
                    unit = ch.properties.get("unit_string") or ch.properties.get("NI_UnitDescription") or ""
                    samples = [round(float(v), 4) for v in data[:5].tolist()] if len(data) else []
                    preview[grp.name][ch.name] = {
                        "unit": unit,
                        "samples": samples,
                        "min": round(float(np.min(numeric)), 4) if len(numeric) else None,
                        "max": round(float(np.max(numeric)), 4) if len(numeric) else None,
                        "mean": round(float(np.mean(numeric)), 4) if len(numeric) else None,
                        "count": int(len(data)),
                    }
        except Exception:
            pass  # preview is optional

        return sanitize({
            "file_count": len(paths),
            "filenames": [os.path.basename(p) for p in paths],
            "groups": groups,
            "channels": channels,
            "preview": preview,
        })
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/convert")
async def convert(
    files: List[UploadFile] = File(...),
    group_name: str = Form(...),
    selected_channels: str = Form(...),   # JSON array string
    add_time_column: bool = Form(True),
    time_step: float = Form(0.10),
    add_datetime_column: bool = Form(True),
):
    """Convert TDMS files to cycle TXT files and return as ZIP."""
    import json

    tmpdir = tempfile.mkdtemp(prefix="jerry_merge_")
    out_dir = os.path.join(tmpdir, "cycles")
    os.makedirs(out_dir, exist_ok=True)

    try:
        paths = await save_uploads(files, tmpdir)
        channels = json.loads(selected_channels)

        created = convert_tdms_files_to_cycles(
            filepaths=paths,
            output_dir=out_dir,
            group_name=group_name,
            selected_channels=channels,
            add_time_column=add_time_column,
            time_step=time_step,
            add_datetime_column=add_datetime_column,
        )

        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for fp in created:
                zf.write(fp, os.path.basename(fp))

        return zip_response(buf, "cycle_files.zip")

    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(500, str(e))


@router.post("/concatenate-txt")
async def concatenate_txt(
    files: List[UploadFile] = File(...),
    time_col: str = Form("Time"),
    output_name: str = Form("merged.txt"),
):
    """Concatenate multiple TXT cycle files into one, offsetting time to be continuous."""
    import pandas as pd

    tmpdir = tempfile.mkdtemp(prefix="jerry_cat_")
    try:
        paths = await save_uploads(files, tmpdir)
        if len(paths) < 2:
            raise HTTPException(400, "Upload at least 2 files to concatenate")

        from powertech_tools.utils.file_parser import read_headers_only, load_table_allow_duplicate_headers
        from fastapi.responses import StreamingResponse as SR

        frames = []
        time_offset = 0.0
        meta_lines = []
        captured_meta = False

        for p in paths:
            headers, delim, header_idx, lines = read_headers_only(p)
            if not captured_meta:
                meta_lines = [l.rstrip("\n") for l in lines[:header_idx] if l.strip()]
                captured_meta = True

            df = load_table_allow_duplicate_headers(p)

            if time_col in df.columns:
                t = pd.to_numeric(df[time_col], errors="coerce")
                if not t.isna().all():
                    t0 = float(t.dropna().iloc[0])
                    t_end = float(t.dropna().iloc[-1])
                    df[time_col] = t - t0 + time_offset
                    time_offset += (t_end - t0) + 1.0

            frames.append(df)

        merged = pd.concat(frames, ignore_index=True)

        text = io.StringIO()
        for ml in meta_lines:
            text.write(ml + "\n")
        text.write("\n")
        text.write("\t".join(str(c) for c in merged.columns) + "\n")
        merged.to_csv(text, sep="\t", index=False, header=False, lineterminator="\n")

        buf = io.BytesIO(text.getvalue().encode("utf-8"))
        buf.seek(0)
        safe_name = output_name if output_name.endswith(".txt") else output_name + ".txt"
        return SR(buf, media_type="text/plain; charset=utf-8",
                  headers={"Content-Disposition": f'attachment; filename="{safe_name}"'})

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))
