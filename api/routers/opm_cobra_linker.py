"""
OPM Cobra <-> Unicycle Linker - FastAPI router.
Ported from the standalone Flask app in the opm-cobra-unicycle-linker repo.
"""

import io
import os
import zipfile
import traceback
import numpy as np
import pandas as pd
from fastapi import APIRouter, File, UploadFile, HTTPException
from fastapi.responses import StreamingResponse

router = APIRouter()

# ---------------------------------------------------------------------------
# Load the resistance->temperature lookup table once at startup
# ---------------------------------------------------------------------------
_LOOKUP_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "powertech_tools", "data", "resistance_temp_lookup.xlsx",
)


def _load_lookup():
    df = pd.read_excel(_LOOKUP_PATH)
    df = df.sort_values("Resistance (kOhm)").reset_index(drop=True)
    return df["Resistance (kOhm)"].to_numpy(), df["Temperature (°C)"].to_numpy()


LOOKUP_RESISTANCE, LOOKUP_TEMP = _load_lookup()


# ---------------------------------------------------------------------------
# Parsing helpers
# ---------------------------------------------------------------------------

def parse_unicycle(raw_bytes: bytes) -> pd.DataFrame:
    """Parse a Unicycle .txt file (tab-separated, 5-line header)."""
    text = raw_bytes.decode("utf-8", errors="replace")
    lines = text.splitlines()

    col_map: dict[int, str] = {}
    for i, c in enumerate(lines[4].split("\t")):
        cl = c.strip().lower()
        if "date" in cl and "time" in cl:
            col_map[i] = "date_time"
        elif cl == "elapsed":
            col_map[i] = "elapsed"
        elif cl == "v3":
            col_map[i] = "v3_ohm"
        elif "cycle sync" in cl:
            col_map[i] = "cycle_sync"

    rows = []
    for line in lines[5:]:
        if not line.strip():
            continue
        parts = line.split("\t")
        row: dict[str, object] = {}
        for idx, name in col_map.items():
            if idx < len(parts):
                v = parts[idx].strip()
                if name == "date_time":
                    row[name] = v
                else:
                    try:
                        row[name] = float(v)
                    except ValueError:
                        row[name] = None
        if len(row) == len(col_map):
            rows.append(row)

    df = pd.DataFrame(rows)
    numeric_cols = [c for c in ["elapsed", "v3_ohm", "cycle_sync"] if c in df.columns]
    return df.dropna(subset=numeric_cols)


def parse_cobra(raw_bytes: bytes) -> tuple[pd.DataFrame, list[str]]:
    """Parse a Cobra .txt file. Returns (DataFrame, column_names)."""
    text = raw_bytes.decode("utf-8", errors="replace")
    lines = text.splitlines()

    header_idx = None
    for i, line in enumerate(lines):
        parts = [p.strip() for p in line.split("\t")]
        if "Time" in parts and "cycle sync" in parts:
            header_idx = i
            break

    if header_idx is None:
        raise ValueError(
            "Could not find column headers in Cobra file. "
            "Expected a row containing 'Time' and 'cycle sync'."
        )

    log_rate = 0.1
    for line in lines[:header_idx]:
        if "log rate" in line.strip().lower():
            try:
                log_rate = float(line.split("=")[1].strip())
            except (ValueError, IndexError):
                pass

    col_names = [c.strip() for c in lines[header_idx].split("\t")]
    col_names = [c for c in col_names if c]

    rows = []
    for line in lines[header_idx + 1:]:
        if not line.strip():
            continue
        parts = line.split("\t")
        if len(parts) < len(col_names):
            continue
        row: dict[str, object] = {}
        for c, v in zip(col_names, parts):
            sv = v.strip()
            try:
                row[c] = float(sv)
            except ValueError:
                row[c] = sv
        rows.append(row)

    df = pd.DataFrame(rows)

    if df.empty or "cycle sync" not in df.columns:
        raise ValueError(
            f"Header found at line {header_idx} but 'cycle sync' missing from DataFrame. "
            f"Columns: {list(df.columns) if not df.empty else 'none - 0 rows'}."
        )

    df["Time"] = np.round(np.arange(len(df)) * log_rate, 6)

    if "DateTime" in df.columns:
        df = df.rename(columns={"DateTime": "Cobra DateTime"})
        col_names = ["Cobra DateTime" if c == "DateTime" else c for c in col_names]

    return df, col_names


# ---------------------------------------------------------------------------
# Core processing
# ---------------------------------------------------------------------------

def _ohms_to_temperature(ohms: float) -> float:
    return float(np.interp(ohms / 1000.0, LOOKUP_RESISTANCE, LOOKUP_TEMP))


def _find_first_sync_rise(df: pd.DataFrame, sync_col: str, time_col: str) -> float:
    rising = df[df[sync_col] >= 0.9]
    if rising.empty:
        raise ValueError(f"No sync signal found in column '{sync_col}'.")
    return float(rising.iloc[0][time_col])


def process_pair(cobra_bytes: bytes, unicycle_bytes: bytes) -> bytes:
    uni_df = parse_unicycle(unicycle_bytes)
    cobra_df, cobra_col_names = parse_cobra(cobra_bytes)

    cobra_sync_time = _find_first_sync_rise(cobra_df, "cycle sync", "Time")
    uni_sync_elapsed = _find_first_sync_rise(uni_df, "cycle_sync", "elapsed")

    cobra_times = cobra_df["Time"].to_numpy()
    uni_elapsed = uni_df["elapsed"].to_numpy()
    uni_v3 = uni_df["v3_ohm"].to_numpy()

    aligned_uni_elapsed = uni_sync_elapsed + (cobra_times - cobra_sync_time)
    v3_interp = np.interp(aligned_uni_elapsed, uni_elapsed, uni_v3)
    temps = np.array([_ohms_to_temperature(v) for v in v3_interp])

    nearest_idx = np.clip(
        np.searchsorted(uni_elapsed, aligned_uni_elapsed),
        0, len(uni_elapsed) - 1,
    )
    if "date_time" in uni_df.columns:
        unicycle_dt = uni_df["date_time"].to_numpy()[nearest_idx]
    else:
        unicycle_dt = [""] * len(cobra_times)

    out_df = cobra_df.copy()
    out_df["cycle sync"] = out_df["cycle sync"].round().astype(int)
    out_df["Unicycle DateTime"] = unicycle_dt
    out_df["V3 (Ohm)"] = v3_interp
    out_df["Ttank"] = np.round(temps, 4)

    out_df = out_df[out_df["cycle sync"] >= 0.9].reset_index(drop=True)

    other_cobra = [c for c in cobra_col_names if c not in ("Time", "Cobra DateTime")]
    has_cobra_dt = "Cobra DateTime" in out_df.columns
    new_cols = (
        ["Time"]
        + (["Cobra DateTime"] if has_cobra_dt else [])
        + ["Unicycle DateTime"]
        + other_cobra
        + ["V3 (Ohm)", "Ttank"]
    )
    out_df = out_df[new_cols]

    buf = io.StringIO()
    out_df.to_csv(buf, index=False)
    return buf.getvalue().encode("utf-8-sig")


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------

@router.post("/process")
async def process(
    cobra_files: list[UploadFile] = File(...),
    unicycle_files: list[UploadFile] = File(...),
):
    if not cobra_files or not cobra_files[0].filename:
        raise HTTPException(400, "Please upload at least one Cobra file.")
    if not unicycle_files or not unicycle_files[0].filename:
        raise HTTPException(400, "Please upload at least one Unicycle file.")
    if len(cobra_files) != len(unicycle_files):
        raise HTTPException(
            400,
            f"File count mismatch: {len(cobra_files)} Cobra vs {len(unicycle_files)} Unicycle.",
        )

    results: list[tuple[str, bytes]] = []
    errors: list[str] = []

    for i, (cobra_file, unicycle_file) in enumerate(zip(cobra_files, unicycle_files)):
        try:
            result_bytes = process_pair(
                await cobra_file.read(),
                await unicycle_file.read(),
            )
            stem = os.path.splitext(cobra_file.filename or f"pair_{i + 1}")[0]
            results.append((f"{stem}_with_temp.csv", result_bytes))
        except Exception as exc:
            errors.append(
                f"Pair {i + 1} ({cobra_file.filename}): {exc}\n{traceback.format_exc()}"
            )

    if errors:
        raise HTTPException(422, detail="\n".join(errors))

    if len(results) == 1:
        name, data = results[0]
        return StreamingResponse(
            io.BytesIO(data),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{name}"'},
        )

    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for name, data in results:
            zf.writestr(name, data)
    zip_buf.seek(0)

    return StreamingResponse(
        zip_buf,
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="processed_cycles.zip"'},
    )
