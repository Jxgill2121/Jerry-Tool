# Data processing and computation utilities

import os
from typing import List, Dict, Tuple, Optional

import pandas as pd

from powertech_tools.utils.file_parser import read_headers_only
from powertech_tools.utils.helpers import natural_sort_key


def compute_maxmin_from_multiple_files(
    filepaths: List[str],
    time_col: str,
    min_points_per_file: int = 10
) -> pd.DataFrame:
    """
    Compute min/max template from multiple cycle files.

    Each file represents one cycle. Computes min/max for all parameters
    in each file and outputs one row per file.

    Args:
        filepaths: List of file paths, each containing one cycle of data
        time_col: Name of the time column (can be None or empty string to skip)
        min_points_per_file: Minimum data points required per file (default 10)

    Returns:
        DataFrame with Date Time, Cycle, and alternating min/max columns

    Raises:
        RuntimeError: If files cannot be processed
    """
    if not filepaths:
        raise RuntimeError("No files provided")

    # Sort files naturally by basename
    filepaths = sorted(filepaths, key=lambda p: natural_sort_key(os.path.basename(p)))

    all_rows = []
    value_cols = None
    actual_cycle_num = 0  # Track actual cycle number (increments only for valid files)
    skipped_files = []

    for file_idx, fp in enumerate(filepaths, start=1):
        # Load the file - read entire file instead of just first 400 lines
        headers, delim, header_idx, _ = read_headers_only(fp)

        # Now read the ENTIRE file to get all data
        with open(fp, "r", encoding="utf-8", errors="ignore") as f:
            all_lines = f.readlines()

        print(f"\n=== DEBUG: Processing {os.path.basename(fp)} (File {file_idx}/{len(filepaths)}) ===")
        print(f"Headers detected: {headers}")
        print(f"Delimiter: {repr(delim)}")
        print(f"Header at line: {header_idx}")
        print(f"Total lines in file: {len(all_lines)}")

        # Verify time column exists if specified
        time_col_valid = time_col and time_col.strip() and time_col in headers

        # Parse the data from all lines after the header
        data_text = "".join(all_lines[header_idx + 1:])

        if delim == "  ":
            sep = r"\s{2,}"
            engine = "python"
        else:
            sep = delim
            engine = "c"

        from io import StringIO
        df = pd.read_csv(
            StringIO(data_text),
            sep=sep,
            engine=engine,
            names=headers,
            header=None,
            low_memory=False
        )

        if df.empty:
            print(f"  SKIPPED: Empty file")
            skipped_files.append((os.path.basename(fp), "empty"))
            continue

        # Skip files with too few data points
        if min_points_per_file > 0 and len(df) < min_points_per_file:
            print(f"  SKIPPED: Only {len(df)} data points (min required: {min_points_per_file})")
            skipped_files.append((os.path.basename(fp), f"{len(df)} points"))
            continue

        # Increment cycle number for valid files
        actual_cycle_num += 1
        print(f"  Assigned Cycle: {actual_cycle_num}")

        # Fix column mismatch: if 'Elapsed' is in headers but data has one fewer column
        # This happens when the header line has a phantom 'Elapsed' column
        if len(df.columns) < len(headers):
            print(f"  WARNING: Header has {len(headers)} columns but data has {len(df.columns)}")
            if 'Elapsed' in headers and len(headers) == len(df.columns) + 1:
                print(f"  Removing phantom 'Elapsed' column from headers")
                # Remove 'Elapsed' from headers and reassign column names
                headers_fixed = [h for h in headers if h != 'Elapsed']
                df.columns = headers_fixed
                print(f"  Fixed headers: {headers_fixed}")

        # Get value columns (all except time and cycle)
        if value_cols is None:
            exclude_cols = []
            if time_col_valid:
                exclude_cols.append(time_col)
            # Exclude 'Elapsed' as it may be a phantom header column
            value_cols = [c for c in headers if c not in exclude_cols and c.lower() != 'cycle' and c.lower() != 'elapsed']
            print(f"Value columns set from first file: {value_cols}")

        # Convert value columns to numeric
        for c in value_cols:
            if c in df.columns:
                df[c] = pd.to_numeric(df[c], errors="coerce")

        # Get last timestamp
        if time_col_valid:
            last_time = df[time_col].iloc[-1] if len(df) > 0 else ""
        else:
            last_time = ""

        # Compute min/max for this file (this cycle)
        row = [last_time, actual_cycle_num]
        print(f"Computing min/max for {len(value_cols)} value columns...")
        for col in value_cols:
            if col in df.columns:
                col_data = df[col].dropna()
                if len(col_data) > 0:
                    min_val = col_data.min()
                    max_val = col_data.max()
                    print(f"  {col}: min={min_val:.6f}, max={max_val:.6f}, rows={len(col_data)}")
                else:
                    min_val = ""
                    max_val = ""
                    print(f"  {col}: NO DATA")
            else:
                min_val = ""
                max_val = ""
                print(f"  {col}: COLUMN NOT FOUND")
            row.append(min_val)
            row.append(max_val)

        all_rows.append(row)

    # Report summary
    print(f"\n=== PROCESSING SUMMARY ===")
    print(f"Total files: {len(filepaths)}")
    print(f"Valid cycles: {actual_cycle_num}")
    print(f"Skipped files: {len(skipped_files)}")
    if skipped_files:
        for fname, reason in skipped_files[:10]:
            print(f"  - {fname}: {reason}")
        if len(skipped_files) > 10:
            print(f"  ... and {len(skipped_files) - 10} more")

    if not all_rows:
        raise RuntimeError("No valid data found in any files")

    if not value_cols:
        raise RuntimeError("No value columns found to analyze")

    # Build headers
    out_headers = ["Date  Time", "Cycle"]
    for col in value_cols:
        out_headers.append(col)  # Min column
        out_headers.append(col)  # Max column

    out_df = pd.DataFrame(all_rows, columns=out_headers)
    return out_df


def compute_maxmin_template(
    df_raw: pd.DataFrame,
    time_col: str,
    cycle_col: str,
    min_points_per_cycle: int = 10,
    skip_cycle_zero: bool = True
) -> pd.DataFrame:
    """
    Compute min/max template from raw data.

    Groups data by cycle and computes minimum and maximum values for each column.
    Creates output with alternating min/max columns for each value column.

    Args:
        df_raw: Raw DataFrame with time, cycle, and value columns
        time_col: Name of the time column
        cycle_col: Name of the cycle column
        min_points_per_cycle: Minimum data points required per cycle (default 10)
        skip_cycle_zero: Skip cycle 0 if present (often a partial cycle)

    Returns:
        DataFrame with Date Time, Cycle, and alternating min/max columns

    Raises:
        RuntimeError: If no valid cycle data is found or grouping fails
    """
    df = df_raw.copy()

    # Validate input
    if df.empty:
        raise RuntimeError("Input DataFrame is empty")

    if cycle_col not in df.columns:
        raise RuntimeError(f"Cycle column '{cycle_col}' not found in data")

    if time_col not in df.columns:
        raise RuntimeError(f"Time column '{time_col}' not found in data")

    # Convert cycle column to numeric
    df[cycle_col] = pd.to_numeric(df[cycle_col], errors="coerce")

    # Count valid cycles before filtering
    valid_cycles_before = df[cycle_col].notna().sum()
    if valid_cycles_before == 0:
        raise RuntimeError(f"No valid numeric cycle values found in column '{cycle_col}'")

    # Filter out rows with NaN cycles
    df = df[df[cycle_col].notna()].reset_index(drop=True)

    # Get unique cycles for validation
    unique_cycles = sorted(df[cycle_col].unique())
    num_unique_cycles_raw = len(unique_cycles)

    if num_unique_cycles_raw == 0:
        raise RuntimeError("No cycles found after filtering")

    # Filter out cycle 0 if requested (often a partial cycle at start)
    skipped_cycles = []
    if skip_cycle_zero and 0 in unique_cycles:
        count_zero = len(df[df[cycle_col] == 0])
        skipped_cycles.append(f"Cycle 0 ({count_zero} points)")
        df = df[df[cycle_col] != 0].reset_index(drop=True)
        unique_cycles = [c for c in unique_cycles if c != 0]

    # Filter out cycles with too few data points
    if min_points_per_cycle > 0:
        cycle_counts = df.groupby(cycle_col).size()
        valid_cycles = cycle_counts[cycle_counts >= min_points_per_cycle].index.tolist()
        invalid_cycles = cycle_counts[cycle_counts < min_points_per_cycle]

        for cyc, count in invalid_cycles.items():
            skipped_cycles.append(f"Cycle {int(cyc)} ({count} points < {min_points_per_cycle} min)")

        if len(invalid_cycles) > 0:
            df = df[df[cycle_col].isin(valid_cycles)].reset_index(drop=True)
            unique_cycles = sorted(valid_cycles)

    # Report skipped cycles
    if skipped_cycles:
        print(f"\n=== CYCLE VALIDATION ===")
        print(f"Original cycle count: {num_unique_cycles_raw}")
        print(f"Skipped {len(skipped_cycles)} cycles:")
        for s in skipped_cycles[:20]:  # Limit output
            print(f"  - {s}")
        if len(skipped_cycles) > 20:
            print(f"  ... and {len(skipped_cycles) - 20} more")
        print(f"Valid cycles remaining: {len(unique_cycles)}")

    if len(unique_cycles) == 0:
        raise RuntimeError("No valid cycles remaining after filtering")

    # Get value columns (all except time and cycle)
    value_cols = [c for c in df.columns if c not in (time_col, cycle_col)]

    if not value_cols:
        raise RuntimeError("No value columns found for min/max computation")

    # Convert value columns to numeric
    for c in value_cols:
        df[c] = pd.to_numeric(df[c], errors="coerce")

    # Group by cycle
    g = df.groupby(cycle_col, sort=False)

    # Get time for each cycle (last timestamp in the cycle)
    time_last = g[time_col].last().reset_index()
    time_last.columns = ["Cycle", "Date  Time"]

    # Compute min and max for each value column per cycle
    mins = g[value_cols].min().reset_index()
    maxs = g[value_cols].max().reset_index()

    # Create lookup maps
    mins_map = mins.set_index(cycle_col)
    maxs_map = maxs.set_index(cycle_col)

    cycles = time_last["Cycle"].tolist()
    time_map = dict(zip(time_last["Cycle"], time_last["Date  Time"]))

    # Build output rows: one row per cycle with alternating min/max for each parameter
    out_rows = []
    for cyc in cycles:
        row = [time_map.get(cyc, ""), cyc]
        for col in value_cols:
            min_val = mins_map.loc[cyc, col] if cyc in mins_map.index else ""
            max_val = maxs_map.loc[cyc, col] if cyc in maxs_map.index else ""
            row.append(min_val)
            row.append(max_val)
        out_rows.append(row)

    # Build headers: Date Time, Cycle, then alternating column names for min/max pairs
    out_headers = ["Date  Time", "Cycle"]
    for col in value_cols:
        out_headers.append(col)  # Min column
        out_headers.append(col)  # Max column

    out_df = pd.DataFrame(out_rows, columns=out_headers)

    return out_df


def parse_time_to_seconds(series: pd.Series) -> pd.Series:
    """
    Parse a series of time values to seconds.

    Handles multiple formats:
    - Numeric values (already in seconds)
    - DateTime objects (converted to Unix timestamp)
    - MM:SS format
    - HH:MM:SS format

    Args:
        series: Series with time values in various formats

    Returns:
        Series with time values converted to seconds (float)
    """
    s = series.astype(str).str.strip()

    out_num = pd.to_numeric(s, errors="coerce")
    if out_num.notna().any():
        return out_num

    dt = pd.to_datetime(s, errors="coerce")
    if dt.notna().any():
        return dt.astype("int64") / 1e9

    def one(x: str):
        x = (x or "").strip()
        if not x or ":" not in x:
            return None
        parts = x.split(":")
        try:
            if len(parts) == 2:
                mm = float(parts[0])
                ss = float(parts[1])
                return mm * 60.0 + ss
            if len(parts) == 3:
                hh = float(parts[0])
                mm = float(parts[1])
                ss = float(parts[2])
                return hh * 3600.0 + mm * 60.0 + ss
        except Exception:
            return None
        return None

    parsed = s.apply(one)
    return pd.to_numeric(parsed, errors="coerce")


def stream_file_means(path: str, cols: List[str], chunksize: int = 50000) -> Tuple[Dict[str, Optional[float]], Dict[str, int]]:
    """
    Compute means for specified columns by streaming through file.

    Reads file in chunks to handle large files efficiently.

    Args:
        path: Path to the data file
        cols: List of column names to compute means for
        chunksize: Number of rows to read per chunk

    Returns:
        Tuple of (means dict, counts dict) where means maps column name to mean value
        and counts maps column name to number of valid values

    Raises:
        RuntimeError: If any specified columns are missing from the file
    """
    headers, delim, header_idx, _lines = read_headers_only(path)
    missing = [c for c in cols if c not in headers]
    if missing:
        raise RuntimeError(f"Missing columns in {os.path.basename(path)}: {missing}")

    if delim == "  ":
        sep = r"\s{2,}"
        engine = "python"
    else:
        sep = delim
        engine = "c"

    skip = header_idx + 1
    sums = {c: 0.0 for c in cols}
    counts = {c: 0 for c in cols}

    for chunk in pd.read_csv(
        path, sep=sep, engine=engine, skiprows=skip, names=headers,
        usecols=cols, header=None, low_memory=False, chunksize=chunksize
    ):
        for c in cols:
            s = pd.to_numeric(chunk[c], errors="coerce")
            valid = s.dropna()
            if not valid.empty:
                sums[c] += float(valid.sum())
                counts[c] += int(valid.shape[0])

    means = {c: (sums[c] / counts[c] if counts[c] > 0 else None) for c in cols}
    return means, counts


def stream_file_duration_seconds(path: str, mode: str, col: str, chunksize: int = 50000) -> Optional[float]:
    """
    Compute file duration in seconds by streaming through file.

    Finds the first and last valid time values and computes the difference.

    Args:
        path: Path to the data file
        mode: Time mode - "Elapsed" for numeric seconds, or other for parsed time
        col: Name of the time column
        chunksize: Number of rows to read per chunk

    Returns:
        Duration in seconds, or None if duration cannot be computed

    Raises:
        RuntimeError: If the time column is not found in the file
    """
    headers, delim, header_idx, _lines = read_headers_only(path)
    if col not in headers:
        raise RuntimeError(f"Duration column '{col}' not found in {os.path.basename(path)}")

    if delim == "  ":
        sep = r"\s{2,}"
        engine = "python"
    else:
        sep = delim
        engine = "c"

    skip = header_idx + 1
    first_val = None
    last_val = None

    for chunk in pd.read_csv(
        path, sep=sep, engine=engine, skiprows=skip, names=headers,
        usecols=[col], header=None, low_memory=False, chunksize=chunksize
    ):
        if mode == "Elapsed":
            v = pd.to_numeric(chunk[col], errors="coerce").dropna()
        else:
            v = parse_time_to_seconds(chunk[col]).dropna()

        if v.empty:
            continue
        if first_val is None:
            first_val = float(v.iloc[0])
        last_val = float(v.iloc[-1])

    if first_val is None or last_val is None:
        return None

    dur = last_val - first_val
    if dur < 0:
        return None
    return float(dur)


def stream_ptank_initial_ramp_stats(
    path: str,
    time_mode: str,
    time_col: str,
    ptank_col: str,
    start_dp: float = 1.0,
    window_minutes: float = 5.0,
    window_dp: float = 20.0,
    min_points: int = 30,
    dt_min: float = 0.02,
    dt_max: float = 2.0,
    ramp_cap_mpa_min: float = 50.0,
    chunksize: int = 50000
) -> tuple[Optional[float], Optional[float]]:
    """
    Compute initial ramp statistics for Ptank pressure data.

    Detects the initial pressure ramp and computes:
    1. Linear regression slope (MPa/min)
    2. Maximum instantaneous ramp rate (MPa/min)

    Args:
        path: Path to the data file
        time_mode: Time mode - "Elapsed" for numeric seconds, or other for parsed time
        time_col: Name of the time column
        ptank_col: Name of the Ptank pressure column
        start_dp: Pressure rise (MPa) to trigger ramp detection
        window_minutes: Maximum time window (minutes) for ramp analysis
        window_dp: Maximum pressure change (MPa) for ramp analysis
        min_points: Minimum number of data points required
        dt_min: Minimum acceptable time step (seconds)
        dt_max: Maximum acceptable time step (seconds)
        ramp_cap_mpa_min: Cap for instantaneous ramp rates (MPa/min)
        chunksize: Number of rows to read per chunk

    Returns:
        Tuple of (linear_slope_mpa_min, max_instantaneous_ramp_mpa_min)
        Both values are None if ramp cannot be detected

    Raises:
        RuntimeError: If required columns are not found in the file
    """
    headers, delim, header_idx, _lines = read_headers_only(path)
    for c in [time_col, ptank_col]:
        if c not in headers:
            raise RuntimeError(f"Ramp: column '{c}' not found in {os.path.basename(path)}")

    if delim == "  ":
        sep = r"\s{2,}"
        engine = "python"
    else:
        sep = delim
        engine = "c"

    skip = header_idx + 1

    seg_t: List[float] = []
    seg_p: List[float] = []

    baseline_p = None
    ramp_started = False
    ramp_start_t = None
    ramp_start_p = None

    seg_inst_ramps_mpa_min: List[float] = []

    prev_t = None
    prev_p = None

    max_seg_seconds = window_minutes * 60.0

    def time_series_from_chunk(chunk: pd.DataFrame) -> pd.Series:
        if time_mode == "Elapsed":
            return pd.to_numeric(chunk[time_col], errors="coerce")
        return parse_time_to_seconds(chunk[time_col])

    for chunk in pd.read_csv(
        path,
        sep=sep,
        engine=engine,
        skiprows=skip,
        names=headers,
        usecols=[time_col, ptank_col],
        header=None,
        low_memory=False,
        chunksize=chunksize
    ):
        t = time_series_from_chunk(chunk)
        p = pd.to_numeric(chunk[ptank_col], errors="coerce")
        df_tp = pd.DataFrame({"t": t, "p": p}).dropna()
        if df_tp.empty:
            continue

        tvals = df_tp["t"].astype(float).values
        pvals = df_tp["p"].astype(float).values

        if baseline_p is None and len(pvals) > 0:
            baseline_p = float(pvals[0])

        for i in range(len(tvals)):
            ti = float(tvals[i])
            pi = float(pvals[i])

            if prev_t is not None:
                dt = ti - prev_t
                dp = pi - prev_p

                if dt <= 0 or dt < dt_min or dt > dt_max:
                    prev_t, prev_p = ti, pi
                    continue

                if (not ramp_started) and baseline_p is not None:
                    if (pi - baseline_p) >= start_dp and dp > 0:
                        ramp_started = True
                        ramp_start_t = ti
                        ramp_start_p = pi
                        seg_t = [ti]
                        seg_p = [pi]
                        seg_inst_ramps_mpa_min = []
                        prev_t, prev_p = ti, pi
                        continue

                if ramp_started:
                    if ramp_start_t is not None and (ti - ramp_start_t) > max_seg_seconds:
                        break
                    if ramp_start_p is not None and (pi - ramp_start_p) > window_dp:
                        break

                    seg_t.append(ti)
                    seg_p.append(pi)

                    if dp > 0:
                        ramp_mpa_min = (dp / dt) * 60.0
                        if ramp_mpa_min <= ramp_cap_mpa_min:
                            seg_inst_ramps_mpa_min.append(ramp_mpa_min)

            prev_t, prev_p = ti, pi

        if ramp_started and ramp_start_t is not None and len(seg_t) > 0:
            last_t = seg_t[-1]
            if (last_t - ramp_start_t) > max_seg_seconds:
                break
            if ramp_start_p is not None and (seg_p[-1] - ramp_start_p) > window_dp:
                break

    if not ramp_started or len(seg_t) < min_points:
        return None, None

    t0 = seg_t[0]
    x = [tt - t0 for tt in seg_t]
    y = seg_p

    x_mean = sum(x) / len(x)
    y_mean = sum(y) / len(y)
    num = sum((x[i] - x_mean) * (y[i] - y_mean) for i in range(len(x)))
    den = sum((x[i] - x_mean) ** 2 for i in range(len(x)))

    if den <= 0:
        return None, None

    slope_mpa_s = num / den
    slope_mpa_min = slope_mpa_s * 60.0

    max_ramp_mpa_min = max(seg_inst_ramps_mpa_min) if seg_inst_ramps_mpa_min else None

    return float(slope_mpa_min), (float(max_ramp_mpa_min) if max_ramp_mpa_min is not None else None)
