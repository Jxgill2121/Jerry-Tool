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
# PL-06159.02 resistance (kOhm) -> temperature (degC) lookup table
# Covers -79 degC to 169 degC at 1-degree steps.
# ---------------------------------------------------------------------------
_LOOKUP_RESISTANCE = np.array([0.6873, 0.6913, 0.6953, 0.6993, 0.7033, 0.7073, 0.7113, 0.7153, 0.7193, 0.7233, 0.7273, 0.7313, 0.7353, 0.7393, 0.7433, 0.7473, 0.7513, 0.7553, 0.7593, 0.7633, 0.7673, 0.7712, 0.7752, 0.7792, 0.7832, 0.7872, 0.7911, 0.7951, 0.7991, 0.8031, 0.8070, 0.8110, 0.8150, 0.8189, 0.8229, 0.8269, 0.8308, 0.8348, 0.8387, 0.8427, 0.8467, 0.8506, 0.8546, 0.8585, 0.8625, 0.8664, 0.8704, 0.8743, 0.8783, 0.8822, 0.8862, 0.8901, 0.8940, 0.8980, 0.9019, 0.9059, 0.9098, 0.9137, 0.9177, 0.9216, 0.9255, 0.9295, 0.9334, 0.9373, 0.9412, 0.9452, 0.9491, 0.9530, 0.9569, 0.9609, 0.9648, 0.9687, 0.9726, 0.9765, 0.9804, 0.9844, 0.9883, 0.9922, 0.9961, 1.0000, 1.0039, 1.0078, 1.0117, 1.0156, 1.0195, 1.0234, 1.0273, 1.0312, 1.0351, 1.0390, 1.0429, 1.0468, 1.0507, 1.0546, 1.0585, 1.0624, 1.0663, 1.0702, 1.0740, 1.0779, 1.0818, 1.0857, 1.0896, 1.0935, 1.0973, 1.1012, 1.1051, 1.1090, 1.1129, 1.1167, 1.1206, 1.1245, 1.1283, 1.1322, 1.1361, 1.1400, 1.1438, 1.1477, 1.1515, 1.1554, 1.1593, 1.1631, 1.1670, 1.1708, 1.1747, 1.1786, 1.1824, 1.1863, 1.1901, 1.1940, 1.1978, 1.2017, 1.2055, 1.2094, 1.2132, 1.2171, 1.2209, 1.2247, 1.2286, 1.2324, 1.2363, 1.2401, 1.2439, 1.2478, 1.2516, 1.2554, 1.2593, 1.2631, 1.2669, 1.2708, 1.2746, 1.2784, 1.2822, 1.2861, 1.2899, 1.2937, 1.2975, 1.3013, 1.3052, 1.3090, 1.3128, 1.3166, 1.3204, 1.3242, 1.3280, 1.3318, 1.3357, 1.3395, 1.3433, 1.3471, 1.3509, 1.3547, 1.3585, 1.3623, 1.3661, 1.3699, 1.3737, 1.3775, 1.3813, 1.3851, 1.3888, 1.3926, 1.3964, 1.4002, 1.4040, 1.4088, 1.4116, 1.4154, 1.4191, 1.4229, 1.4267, 1.4305, 1.4343, 1.4380, 1.4418, 1.4456, 1.4494, 1.4531, 1.4569, 1.4607, 1.4644, 1.4682, 1.4720, 1.4757, 1.4795, 1.4833, 1.4870, 1.4908, 1.4946, 1.4983, 1.5021, 1.5058, 1.5096, 1.5133, 1.5171, 1.5208, 1.5246, 1.5283, 1.5321, 1.5358, 1.5396, 1.5433, 1.5471, 1.5508, 1.5546, 1.5583, 1.5620, 1.5658, 1.5695, 1.5733, 1.5770, 1.5807, 1.5845, 1.5882, 1.5919, 1.5956, 1.5994, 1.6031, 1.6068, 1.6105, 1.6143, 1.6181, 1.6218, 1.6255, 1.6292, 1.6329, 1.6366, 1.6403, 1.6440])
_LOOKUP_TEMP       = np.array([-79, -78, -77, -76, -75, -74, -73, -72, -71, -70, -69, -68, -67, -66, -65, -64, -63, -62, -61, -60, -59, -58, -57, -56, -55, -54, -53, -52, -51, -50, -49, -48, -47, -46, -45, -44, -43, -42, -41, -40, -39, -38, -37, -36, -35, -34, -33, -32, -31, -30, -29, -28, -27, -26, -25, -24, -23, -22, -21, -20, -19, -18, -17, -16, -15, -14, -13, -12, -11, -10, -9, -8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169])


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
    return float(np.interp(ohms / 1000.0, _LOOKUP_RESISTANCE, _LOOKUP_TEMP))


def _find_first_sync_rise(df: pd.DataFrame, sync_col: str, time_col: str) -> float:
    rising = df[df[sync_col] >= 0.9]
    if rising.empty:
        raise ValueError(f"No sync signal found in column '{sync_col}'.")
    return float(rising.iloc[0][time_col])


def process_pair(cobra_bytes: bytes, unicycle_bytes: bytes) -> bytes:
    uni_df = parse_unicycle(unicycle_bytes)
    cobra_df, cobra_col_names = parse_cobra(cobra_bytes)

    cobra_sync_time  = _find_first_sync_rise(cobra_df, "cycle sync", "Time")
    uni_sync_elapsed = _find_first_sync_rise(uni_df,   "cycle_sync", "elapsed")

    cobra_times = cobra_df["Time"].to_numpy()
    uni_elapsed = uni_df["elapsed"].to_numpy()
    uni_v3      = uni_df["v3_ohm"].to_numpy()

    aligned_uni_elapsed = uni_sync_elapsed + (cobra_times - cobra_sync_time)
    v3_interp = np.interp(aligned_uni_elapsed, uni_elapsed, uni_v3)
    temps     = np.array([_ohms_to_temperature(v) for v in v3_interp])

    nearest_idx = np.clip(
        np.searchsorted(uni_elapsed, aligned_uni_elapsed),
        0, len(uni_elapsed) - 1,
    )
    if "date_time" in uni_df.columns:
        unicycle_dt = uni_df["date_time"].to_numpy()[nearest_idx]
    else:
        unicycle_dt = [""] * len(cobra_times)

    out_df = cobra_df.copy()
    out_df["cycle sync"]        = out_df["cycle sync"].round().astype(int)
    out_df["Unicycle DateTime"] = unicycle_dt
    out_df["V3 (Ohm)"]         = v3_interp
    out_df["Ttank"]             = np.round(temps, 4)

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
    cobra_files:    list[UploadFile] = File(...),
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
    errors:  list[str] = []

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
