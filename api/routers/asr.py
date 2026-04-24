"""
ASR Validation router
"""

import io
import tempfile
from typing import List

import pandas as pd
from fastapi import APIRouter, File, Form, UploadFile, HTTPException

from api.utils import save_uploads, excel_response, sanitize
from powertech_tools.utils.file_parser import read_headers_only, load_table_allow_duplicate_headers
from powertech_tools.data.asr_validator import validate_asr_temperature

router = APIRouter()


@router.post("/headers")
async def get_headers(files: List[UploadFile] = File(...)):
    tmpdir = tempfile.mkdtemp(prefix="jerry_asr_")
    try:
        paths = await save_uploads(files, tmpdir)
        headers, _, _, _ = read_headers_only(paths[0])
        return {"headers": headers}
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/validate")
async def validate(
    files: List[UploadFile] = File(...),
    time_col: str = Form(...),
    temp_col: str = Form(...),
    params_json: str = Form(...),   # JSON: [{label, temp_min, temp_max, target_hours}]
    time_unit: str = Form("seconds"),
):
    """Run ASR validation for each parameter band."""
    import json

    tmpdir = tempfile.mkdtemp(prefix="jerry_asr_")
    try:
        paths = await save_uploads(files, tmpdir)
        params = json.loads(params_json)

        df = load_table_allow_duplicate_headers(paths[0])

        results = []
        detail_sheets = {}

        for p in params:
            label     = p.get("label", f"{p['temp_min']}–{p['temp_max']}°C")
            temp_min  = float(p["temp_min"])
            temp_max  = float(p["temp_max"])
            target_h  = float(p.get("target_hours", 0))

            stats, detail_df = validate_asr_temperature(
                df, time_col, temp_col, temp_min, temp_max, time_unit
            )

            hours_in = stats["time_in_band"] / 3600.0
            pct      = (hours_in / target_h * 100) if target_h > 0 else None

            results.append({
                "label":         label,
                "temp_min":      temp_min,
                "temp_max":      temp_max,
                "target_hours":  target_h,
                "hours_in_band": round(hours_in, 4),
                "pct_complete":  round(pct, 2) if pct is not None else None,
                "pass":          (hours_in >= target_h) if target_h > 0 else None,
                "excursions":       stats.get("excursion_count", 0),
                "temp_min_obs":     stats.get("temp_stats", {}).get("min"),
                "temp_max_obs":     stats.get("temp_stats", {}).get("max"),
                "temp_mean":        stats.get("temp_stats", {}).get("mean"),
                "temp_in_band_avg": stats.get("temp_stats", {}).get("in_band_mean"),
            })
            detail_sheets[label] = detail_df

        # Build Excel
        buf = io.BytesIO()
        with pd.ExcelWriter(buf, engine="openpyxl") as writer:
            summary_df = pd.DataFrame(results)
            summary_df.to_excel(writer, sheet_name="Summary", index=False)
            for label, ddf in detail_sheets.items():
                safe = label[:31]
                ddf.to_excel(writer, sheet_name=safe, index=False)

        return sanitize({
            "results": results,
            "excel_available": True,
        })

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/validate/excel")
async def validate_excel(
    files: List[UploadFile] = File(...),
    time_col: str = Form(...),
    temp_col: str = Form(...),
    params_json: str = Form(...),
    time_unit: str = Form("seconds"),
):
    """Same as /validate but returns the Excel file directly."""
    import json

    tmpdir = tempfile.mkdtemp(prefix="jerry_asr_")
    try:
        paths = await save_uploads(files, tmpdir)
        params = json.loads(params_json)
        df = load_table_allow_duplicate_headers(paths[0])

        buf = io.BytesIO()
        rows = []
        with pd.ExcelWriter(buf, engine="openpyxl") as writer:
            for p in params:
                label    = p.get("label", f"{p['temp_min']}–{p['temp_max']}°C")
                temp_min = float(p["temp_min"])
                temp_max = float(p["temp_max"])
                target_h = float(p.get("target_hours", 0))

                stats, detail_df = validate_asr_temperature(
                    df, time_col, temp_col, temp_min, temp_max, time_unit
                )
                hours_in = stats["time_in_band"] / 3600.0
                pct = (hours_in / target_h * 100) if target_h > 0 else None
                rows.append({
                    "Band":          label,
                    "Target (h)":    target_h,
                    "Actual (h)":    round(hours_in, 4),
                    "% Complete":    round(pct, 2) if pct is not None else "",
                    "Pass":          "PASS" if target_h > 0 and hours_in >= target_h else ("FAIL" if target_h > 0 else "N/A"),
                    "Excursions":    stats.get("excursion_count", 0),
                })
                detail_df.to_excel(writer, sheet_name=label[:31], index=False)

            pd.DataFrame(rows).to_excel(writer, sheet_name="Summary", index=False)

        return excel_response(buf, "asr_validation.xlsx")

    except Exception as e:
        raise HTTPException(500, str(e))
