# File parsing and header detection utilities

import os
import re
from io import StringIO
from typing import List, Tuple, Dict
import pandas as pd

from .helpers import make_unique_names


def detect_delimiter(lines: List[str]) -> str:
    """Detect the delimiter used in a file"""
    sample = "".join(lines[:80])
    if "\t" in sample:
        return "\t"
    if "," in sample:
        return ","
    if ";" in sample:
        return ";"
    return "  "


def smart_split(line: str, delim: str) -> List[str]:
    """Split a line by delimiter, handling multiple spaces"""
    s = line.strip("\n").rstrip()
    if not s:
        return []
    if delim == "  ":
        return [p for p in re.split(r"\s{2,}", s.strip()) if p != ""]
    return [p.strip() for p in s.split(delim)]


def is_numberish(x: str) -> bool:
    """Check if string looks like a number"""
    x = x.strip()
    if x == "":
        return False
    try:
        float(x)
        return True
    except Exception:
        return False


def is_timeish(x: str) -> bool:
    """Check if string looks like a time value"""
    x = x.strip()
    if not x:
        return False
    if ":" in x:
        return True
    if "/" in x and ":" in x:
        return True
    return False


def header_score(parts: List[str]) -> float:
    """Score a line for how header-like it is"""
    if len(parts) < 3:
        return -1e9
    lower = [p.lower() for p in parts]
    texty = sum(1 for p in parts if any(ch.isalpha() for ch in p))
    numeric = sum(1 for p in parts if is_numberish(p))

    keywords = ["time", "date", "elapsed", "cycle", "step", "ptank", "tamb", "tfluid", "tskin", "pit", "pitleak"]
    key_hits = 0
    for p in lower:
        for k in keywords:
            if p == k or p.startswith(k):
                key_hits += 1

    return (texty * 2.0) + (key_hits * 3.0) - (numeric * 3.0) - (0.5 if len(parts) < 6 else 0.0)


def data_score(parts: List[str]) -> float:
    """Score a line for how data-like it is"""
    if len(parts) < 3:
        return -1e9
    first = parts[0].strip()
    numish = sum(1 for p in parts[1:] if is_numberish(p))
    nonnum = (len(parts) - 1) - numish
    return (10.0 if is_timeish(first) else 0.0) + (numish * 1.0) - (nonnum * 0.5)


def find_header_line_index(path: str, max_lines: int = 400) -> Tuple[int, str, List[str]]:
    """Find the header line in a file by scoring potential headers"""
    with open(path, "r", errors="ignore") as f:
        lines = []
        for _ in range(max_lines):
            ln = f.readline()
            if ln == "":
                break
            lines.append(ln)

    if not lines:
        raise RuntimeError(f"Empty file: {path}")

    delim = detect_delimiter(lines)

    best_idx = None
    best_total = -1e18

    for i in range(len(lines)):
        raw = lines[i].strip()
        if not raw:
            continue

        low = raw.lower()
        if (low.startswith("log rate") or low.startswith("powertech test log")
                or low.startswith("time step") or low.startswith("cycle test")
                or low.startswith("name") or low.startswith("title")
                or low.startswith("author") or low.startswith("start time")):
            continue

        parts = smart_split(lines[i], delim)
        if len(parts) < 3:
            continue

        hs = header_score(parts)

        look = []
        for j in range(i + 1, min(i + 25, len(lines))):
            if not lines[j].strip():
                continue
            pj = smart_split(lines[j], delim)
            if len(pj) < 3:
                continue
            look.append(data_score(pj))
            if len(look) >= 3:
                break

        if not look:
            continue

        ds = sum(sorted(look, reverse=True)[:2])
        total = hs + ds

        if total > best_total:
            best_total = total
            best_idx = i

    if best_idx is None:
        raise RuntimeError(f"Could not detect header line in: {os.path.basename(path)}")

    return best_idx, delim, lines


def read_headers_only(path: str) -> Tuple[List[str], str, int, List[str]]:
    """Read only the headers from a file"""
    header_idx, delim, lines = find_header_line_index(path)
    headers = smart_split(lines[header_idx], delim)
    return headers, delim, header_idx, lines


def load_table_allow_duplicate_headers(path: str) -> pd.DataFrame:
    """Load a table from file, allowing duplicate column headers"""
    headers, delim, header_idx, lines = read_headers_only(path)

    # Read the ENTIRE file, not just the first 400 lines
    with open(path, "r", errors="ignore") as f:
        all_lines = f.readlines()

    # Use all data lines after the header
    data_text = "".join(all_lines[header_idx + 1:])

    parse_headers = make_unique_names(headers)

    if delim == "  ":
        sep = r"\s{2,}"
        engine = "python"
    else:
        sep = delim
        engine = "c"

    df = pd.read_csv(
        StringIO(data_text),
        sep=sep,
        engine=engine,
        names=parse_headers,
        header=None,
        low_memory=False
    )

    df.columns = headers

    # Convert MM:SS.f time format (e.g. "16:56.1") to elapsed seconds
    time_col = next((c for c in df.columns if c.lower() in ("time", "elapsed")), None)
    if time_col and df[time_col].dtype == object:
        converted = _parse_mmssf(df[time_col])
        if converted is not None:
            df[time_col] = converted

    return df


def _parse_mmssf(series: "pd.Series") -> "pd.Series | None":
    """Convert MM:SS.f strings to elapsed seconds. Returns None if not that format."""
    sample = series.dropna().head(5).astype(str)
    if not sample.str.match(r"^\d+:\d+(\.\d+)?$").all():
        return None
    def to_seconds(v: str) -> float:
        try:
            mins, rest = v.split(":")
            return float(mins) * 60 + float(rest)
        except Exception:
            return float("nan")
    elapsed = series.astype(str).apply(to_seconds)
    # Make relative (start from 0)
    first = elapsed.dropna().iloc[0] if not elapsed.dropna().empty else 0
    return elapsed - first


def build_minmax_display_map(headers: List[str]) -> Tuple[List[str], Dict[str, str], Dict[str, str]]:
    """Build mapping for min/max column pairs"""
    internal = make_unique_names(headers)
    internal_to_display: Dict[str, str] = {}
    internal_kind: Dict[str, str] = {}

    for i, raw in enumerate(headers):
        internal_to_display[internal[i]] = raw
        internal_kind[internal[i]] = "other"

    start = 2 if len(headers) >= 2 else 0
    i = start
    while i + 1 < len(headers):
        a = headers[i]
        b = headers[i + 1]
        if a == b:
            internal_to_display[internal[i]] = f"{a} (Min)"
            internal_to_display[internal[i + 1]] = f"{b} (Max)"
            internal_kind[internal[i]] = "min"
            internal_kind[internal[i + 1]] = "max"
            i += 2
        else:
            i += 1

    return internal, internal_to_display, internal_kind


def load_maxmin_for_plot(path: str) -> Tuple[pd.DataFrame, List[str], Dict[str, str], Dict[str, str]]:
    """Load a max/min file for plotting"""
    raw_df = load_table_allow_duplicate_headers(path)
    raw_headers = list(raw_df.columns)

    internal, internal_to_display, internal_kind = build_minmax_display_map(raw_headers)
    raw_df.columns = internal
    return raw_df, internal, internal_to_display, internal_kind
