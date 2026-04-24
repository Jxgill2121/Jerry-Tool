"""
Cycle Averages & Stats router
"""

import io
import os
import tempfile
from typing import List

import numpy as np
import pandas as pd
from fastapi import APIRouter, File, Form, UploadFile, HTTPException

from api.utils import save_uploads, excel_response
from powertech_tools.utils.file_parser import read_headers_only, load_table_allow_duplicate_headers

router = APIRouter()


@router.post("/headers")
async def get_headers(files: List[UploadFile] = File(...)):
    tmpdir = tempfile.mkdtemp(prefix="jerry_avg_")
    try:
        paths = await save_uploads(files, tmpdir)
        headers, _, _, _ = read_headers_only(paths[0])
        return {"headers": headers, "file_count": len(paths)}
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/process")
async def process(
    files: List[UploadFile] = File(...),
    selected_cols: str = Form(...),   # JSON array of column names
    time_col: str = Form(""),
):
    """Compute per-cycle averages and return Excel."""
    import json

    tmpdir = tempfile.mkdtemp(prefix="jerry_avg_")
    try:
        paths = await save_uploads(files, tmpdir)
        cols = json.loads(selected_cols)

        all_rows = []
        signal_data: dict = {c: [] for c in cols}

        for i, fp in enumerate(paths, start=1):
            df = load_table_allow_duplicate_headers(fp)
            row = {"File": os.path.basename(fp), "Cycle": i}
            for c in cols:
                if c in df.columns:
                    vals = pd.to_numeric(df[c], errors="coerce").dropna()
                    avg = float(vals.mean()) if len(vals) > 0 else None
                    std = float(vals.std())  if len(vals) > 0 else None
                    row[f"{c} Avg"] = avg
                    row[f"{c} Std"] = std
                    if avg is not None:
                        signal_data[c].append(avg)
            all_rows.append(row)

        result_df = pd.DataFrame(all_rows)

        # Summary stats per signal
        summary_rows = []
        for c in cols:
            vals = signal_data[c]
            if vals:
                summary_rows.append({
                    "Signal": c,
                    "Mean of Averages": float(np.mean(vals)),
                    "Std of Averages":  float(np.std(vals)),
                    "Min Avg":          float(np.min(vals)),
                    "Max Avg":          float(np.max(vals)),
                    "N Cycles":         len(vals),
                })
        summary_df = pd.DataFrame(summary_rows)

        buf = io.BytesIO()
        with pd.ExcelWriter(buf, engine="openpyxl") as writer:
            result_df.to_excel(writer, sheet_name="Per Cycle", index=False)
            summary_df.to_excel(writer, sheet_name="Summary", index=False)

        return excel_response(buf, "cycle_averages.xlsx")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))
